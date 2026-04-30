#!/usr/bin/env node
import fs from "node:fs";

function read(path) {
	return fs.readFileSync(path, "utf8");
}

const overlay = read("src/renderer/Overlay.tsx");
const voice = read("src/renderer/Voice.tsx");

let failures = 0;
function check(name, ok, detail = "") {
	if (ok) {
		console.log(`SIM_PASS ${name}`);
	} else {
		failures += 1;
		console.log(`SIM_FAIL ${name}${detail ? ` ${detail}` : ""}`);
	}
}

function makePlayer(id, overrides = {}) {
	return {
		id,
		clientId: 100 + id,
		colorId: id,
		isDead: false,
		disconnected: false,
		isLocal: false,
		...overrides,
	};
}

function sortedMeetingPlayerIds(players) {
	return players
		.map((player, index) => ({ player, index }))
		.sort((a, b) => {
			const aDead = a.player.isDead ? 1 : 0;
			const bDead = b.player.isDead ? 1 : 0;
			if (aDead !== bDead) return aDead - bDead;
			return a.index - b.index;
		})
		.map((entry) => entry.player.id);
}

function appendMissingMeetingPlayers(frozenIds, players) {
	const seen = new Set(frozenIds);
	const missingIds = sortedMeetingPlayerIds(players).filter(
		(id) => !seen.has(id),
	);
	return missingIds.length === 0 ? frozenIds : [...frozenIds, ...missingIds];
}

function hasMissingMeetingPlayers(frozenIds, players) {
	const seen = new Set(frozenIds);
	return players.some((player) => !seen.has(player.id));
}

function rawMeetingPlayerIds(players) {
	return players.map((player) => player.id);
}

function initialMeetingPlayerIdsForMode(oldGameState, players, aleLuduMode) {
	if (aleLuduMode || oldGameState !== "TASKS") {
		return rawMeetingPlayerIds(players);
	}
	return sortedMeetingPlayerIds(players);
}

function updateFrozenOrder(frozen, players) {
	if (!frozen) return sortedMeetingPlayerIds(players);
	if (
		players.length > frozen.length ||
		hasMissingMeetingPlayers(frozen, players)
	) {
		return appendMissingMeetingPlayers(frozen, players);
	}
	return frozen;
}

function overlaySlots(frozen, players) {
	const byId = new Map(players.map((player) => [player.id, player]));
	return frozen.map((id, slotIndex) => ({
		slotIndex,
		player: byId.get(id) ?? null,
	}));
}

function isVisibleAleLuduMeetingPlayer(player) {
	return !player.disconnected && !player.bugged && !player.isDummy;
}

function overlaySlotsAleLudu(frozen, players) {
	const byId = new Map(players.map((player) => [player.id, player]));
	return frozen
		.map((id) => byId.get(id) ?? null)
		.filter((player) => player && isVisibleAleLuduMeetingPlayer(player))
		.map((player, slotIndex) => ({ slotIndex, player }));
}

function expectedFreshConnection(player, voiceState, now) {
	if (player.isLocal) return true;
	const connection = voiceState.clientConnections?.[player.clientId];
	return Boolean(
		(connection?.lastSeenAt && now - connection.lastSeenAt <= 2000) ||
			(connection?.lastAudioAt && now - connection.lastAudioAt <= 1500),
	);
}

function expectedMeetingTalking(player, voiceState, now = Date.now()) {
	if (!player.isLocal && player.disconnected) {
		return false;
	}
	const playerDead =
		player.isDead || Boolean(voiceState.otherDead[player.clientId]);
	if (voiceState.localIsAlive && !player.isLocal && playerDead) {
		return false;
	}
	if (!expectedFreshConnection(player, voiceState, now)) {
		return false;
	}
	return Boolean(
		voiceState.otherTalking[player.clientId] ||
			(player.isLocal && voiceState.localTalking),
	);
}

function betterCrewLinkPan(me, other) {
	return [other.x - me.x, other.y - me.y, -0.5];
}

function smoothValue(current, target, time, timeConstant) {
	return target + (current - target) * Math.exp(-time / timeConstant);
}

function effectiveVisionDistance(visionHearing, maxDistance, lightRadius) {
	return visionHearing ? Math.min(maxDistance, lightRadius) : maxDistance;
}

const basePlayers = Array.from({ length: 10 }, (_, id) => makePlayer(id));
const initialOrder = updateFrozenOrder(null, basePlayers);
const midMeetingBootstrapPlayers = basePlayers.map((player) =>
	[1, 2, 6].includes(player.id) ? { ...player, isDead: true } : player,
);
check(
	"meeting_mid_round_bootstrap_keeps_reader_order",
	JSON.stringify(rawMeetingPlayerIds(midMeetingBootstrapPlayers)) ===
		JSON.stringify(basePlayers.map((player) => player.id)),
);
const preDeadTransitionPlayers = basePlayers.map((player) =>
	[1, 6].includes(player.id) ? { ...player, isDead: true } : player,
);
check(
	"meeting_aleludu_predead_transition_keeps_reader_order",
	JSON.stringify(
		initialMeetingPlayerIdsForMode("TASKS", preDeadTransitionPlayers, true),
	) === JSON.stringify(basePlayers.map((player) => player.id)),
);
check(
	"meeting_vanilla_predead_transition_sorts_alive_first",
	JSON.stringify(
		initialMeetingPlayerIdsForMode(
			"TASKS",
			preDeadTransitionPlayers,
			false,
		).slice(-2),
	) === JSON.stringify([1, 6]),
);

const killedPlayers = basePlayers.map((player) =>
	player.id === 2 ? { ...player, isDead: true } : player,
);
const afterDeath = updateFrozenOrder(initialOrder, killedPlayers);
check(
	"meeting_death_keeps_slot_order",
	JSON.stringify(afterDeath) === JSON.stringify(initialOrder),
);

const disconnectedPlayers = basePlayers.filter((player) => player.id !== 3);
const disconnectSlots = overlaySlots(
	updateFrozenOrder(initialOrder, disconnectedPlayers),
	disconnectedPlayers,
);
check(
	"meeting_disconnect_keeps_placeholder",
	disconnectSlots[3]?.player === null && disconnectSlots[4]?.player?.id === 4,
);
const aleLuduDisconnectSlots = overlaySlotsAleLudu(
	initialOrder,
	disconnectedPlayers,
);
check(
	"meeting_aleludu_disconnect_compacts_missing_slot",
	aleLuduDisconnectSlots[3]?.player?.id === 4 &&
		aleLuduDisconnectSlots[3]?.slotIndex === 3,
);
const hiddenAleLuduPlayers = basePlayers.map((player) =>
	player.id === 3 ? { ...player, disconnected: true, bugged: true } : player,
);
const hiddenAleLuduSlots = overlaySlotsAleLudu(
	initialOrder,
	hiddenAleLuduPlayers,
);
check(
	"meeting_aleludu_hidden_players_do_not_shift_edges",
	hiddenAleLuduSlots[3]?.player?.id === 4 &&
		hiddenAleLuduSlots[3]?.slotIndex === 3,
);

const replacementPlayers = basePlayers
	.filter((player) => player.id !== 3)
	.concat(makePlayer(99, { clientId: 199, colorId: 6 }));
const replacementOrder = updateFrozenOrder(initialOrder, replacementPlayers);
const replacementSlots = overlaySlots(replacementOrder, replacementPlayers);
check(
	"meeting_same_length_replacement_appends",
	replacementSlots[3]?.player === null &&
		replacementSlots.at(-1)?.player?.id === 99,
);

const swappedColors = basePlayers.map((player) => {
	if (player.id === 1) return { ...player, colorId: 8 };
	if (player.id === 8) return { ...player, colorId: 1 };
	return player;
});
const swappedSlots = overlaySlots(
	updateFrozenOrder(initialOrder, swappedColors),
	swappedColors,
);
const swappedSpeakerSlot = swappedSlots.find(
	(slot) => slot.player?.clientId === 108,
);
check(
	"meeting_color_swap_keeps_identity_slot",
	swappedSpeakerSlot?.slotIndex === 8 &&
		swappedSpeakerSlot.player.colorId === 1,
);

const deadSpeaker = makePlayer(5, { isDead: true });
check(
	"meeting_dead_remote_not_highlighted_for_alive_local",
	expectedMeetingTalking(deadSpeaker, {
		localIsAlive: true,
		localTalking: false,
		otherTalking: { [deadSpeaker.clientId]: true },
		otherDead: { [deadSpeaker.clientId]: true },
		clientConnections: {
			[deadSpeaker.clientId]: { lastSeenAt: Date.now() },
		},
	}) === false,
);
check(
	"meeting_dead_remote_can_highlight_for_dead_local",
	expectedMeetingTalking(deadSpeaker, {
		localIsAlive: false,
		localTalking: false,
		otherTalking: { [deadSpeaker.clientId]: true },
		otherDead: { [deadSpeaker.clientId]: true },
		clientConnections: {
			[deadSpeaker.clientId]: { lastSeenAt: Date.now() },
		},
	}) === true,
);
const staleSpeaker = makePlayer(4);
check(
	"meeting_stale_persisted_voice_state_not_highlighted",
	expectedMeetingTalking(
		staleSpeaker,
		{
			localIsAlive: true,
			localTalking: false,
			otherTalking: { [staleSpeaker.clientId]: true },
			otherDead: {},
			clientConnections: {
				[staleSpeaker.clientId]: {
					connected: true,
					lastSeenAt: 1,
					lastAudioAt: 1,
				},
			},
		},
		10000,
	) === false,
);
const disconnectedSpeaker = makePlayer(6, { disconnected: true });
check(
	"meeting_disconnected_remote_never_highlighted",
	expectedMeetingTalking(disconnectedSpeaker, {
		localIsAlive: false,
		localTalking: false,
		otherTalking: { [disconnectedSpeaker.clientId]: true },
		otherDead: {},
		clientConnections: {
			[disconnectedSpeaker.clientId]: { lastSeenAt: Date.now() },
		},
	}) === false,
);

check(
	"audio_right_maps_to_positive_x",
	JSON.stringify(betterCrewLinkPan({ x: 0, y: 0 }, { x: 2, y: 0 })) ===
		JSON.stringify([2, 0, -0.5]),
);
check(
	"audio_up_maps_to_positive_y_fixed_depth",
	JSON.stringify(betterCrewLinkPan({ x: 0, y: 0 }, { x: 0, y: 3 })) ===
		JSON.stringify([0, 3, -0.5]),
);
check(
	"audio_diagonal_preserves_bettercrewlink_xy_distance",
	Math.hypot(
		...[
			betterCrewLinkPan({ x: 1, y: 1 }, { x: 4, y: 5 })[0],
			betterCrewLinkPan({ x: 1, y: 1 }, { x: 4, y: 5 })[1],
		],
	) === 5,
);
const smoothed = smoothValue(0, 10, 0.08, 0.04);
check(
	"audio_smoothing_moves_toward_target_without_overshoot",
	smoothed > 0 && smoothed < 10,
);
check(
	"audio_vision_hearing_caps_to_light_radius",
	effectiveVisionDistance(true, 5, 2) === 2 &&
		effectiveVisionDistance(true, 1.5, 2) === 1.5 &&
		effectiveVisionDistance(false, 5, 2) === 5,
);

check(
	"source_meeting_highlight_filters_dead_for_alive_local",
	/function isMeetingPlayerTalking/.test(overlay) &&
		/voiceState\.localIsAlive/.test(overlay) &&
		/voiceState\.otherDead\[player\.clientId\]/.test(overlay) &&
		/player\.isDead/.test(overlay) &&
		/player\.disconnected/.test(overlay),
);
check(
	"source_meeting_highlight_filters_disconnected_remote",
	/if \(!player\.isLocal && player\.disconnected\) \{\s*return false;\s*\}/.test(
		overlay,
	),
);
check(
	"source_meeting_bootstrap_uses_reader_order_when_mid_round",
	/function initialMeetingPlayerIds/.test(overlay) &&
		/gameState\.oldGameState !== GameState\.TASKS/.test(overlay) &&
		/players\.map\(\(player\) => player\.id\)/.test(overlay),
);
check(
	"source_meeting_highlight_requires_fresh_voice_state",
	/function isClientVoiceStateFresh/.test(overlay) &&
		/lastSeenAt/.test(overlay) &&
		/lastAudioAt/.test(overlay) &&
		/isClientVoiceStateFresh\(player, voiceState/.test(overlay),
);
check(
	"source_meeting_aleludu_compacts_missing_slots",
	/if \(aleLuduColumns > 0\) \{[\s\S]*?slotIndex: index/.test(overlay) &&
		!/if \(aleLuduColumns > 0 \|\| !order\)/.test(overlay),
);
check(
	"source_meeting_aleludu_skips_hidden_players",
	/function isVisibleAleLuduMeetingPlayer/.test(overlay) &&
		/!player\.disconnected/.test(overlay) &&
		/!player\.bugged/.test(overlay) &&
		/!player\.isDummy/.test(overlay) &&
		/renderPlayers\.filter\(isVisibleAleLuduMeetingPlayer\)/.test(overlay),
);
check(
	"source_meeting_aleludu_initial_order_uses_reader_order",
	/function initialMeetingPlayerIds\(gameState: AmongUsState, players: Player\[], aleLuduMode/.test(
		overlay,
	) &&
		/if \(aleLuduMode \|\| gameState\.oldGameState !== GameState\.TASKS\)/.test(
			overlay,
		) &&
		/initialMeetingPlayerIds\(gameState, src, aleLuduColumns > 0\)/.test(
			overlay,
		),
);
check(
	"source_audio_uses_bettercrewlink_xy_fixed_depth_axes",
	/pan\.positionX/.test(voice) &&
		/pan\.positionY/.test(voice) &&
		/pan\.positionZ/.test(voice) &&
		/setSmoothedAudioParam\(pan\.positionY, panPos\[1\]/.test(voice) &&
		/setSmoothedAudioParam\(pan\.positionZ, -0\.5/.test(voice),
);
check(
	"source_audio_smooths_pan_and_gain",
	/AUDIO_PARAM_SMOOTHING_SECONDS/.test(voice) &&
		/function setSmoothedAudioParam/.test(voice) &&
		/setSmoothedAudioParam\(pan\.positionX/.test(voice) &&
		/setSmoothedAudioParam\(pan\.positionY, panPos\[1\]/.test(voice) &&
		/setSmoothedAudioParam\(pan\.positionZ, -0\.5/.test(voice) &&
		/function setSmoothedGain/.test(voice) &&
		/setSmoothedGain\(audio\.gain, gain\)/.test(voice) &&
		/setSmoothedGain\(audio\.gain, 0\)/.test(voice),
);
check(
	"source_audio_uses_bettercrewlink_equalpower_panning",
	/pan\.panningModel = ['"]equalpower['"]/.test(voice) &&
		!/pan\.panningModel = ['"]HRTF['"]/.test(voice),
);
check(
	"source_audio_uses_effective_maxdistance",
	/pan\.maxDistance = maxdistance;/.test(voice),
);
check(
	"source_audio_uses_bettercrewlink_ref_distance",
	/pan\.refDistance = 0\.1/.test(voice),
);
check(
	"source_audio_smooths_muffle_filter",
	/setSmoothedAudioParam\(muffle\.frequency/.test(voice) &&
		/setSmoothedAudioParam\(muffle\.Q/.test(voice) &&
		!/muffle\.frequency\.value =/.test(voice) &&
		!/muffle\.Q\.value =/.test(voice),
);
const ventMuffleBlock =
	voice.match(/\/\/ Muffling in vents[\s\S]*?if \(endGain === 1\)/)?.[0] ?? "";
check(
	"source_audio_sets_vent_camera_lowpass_type",
	/muffle\.type = ['"]lowpass['"]/.test(ventMuffleBlock),
);
check(
	"source_audio_vision_hearing_caps_to_light_radius",
	/Math\.min\(lobbySettings\.maxDistance, gameState\.lightRadius\)/.test(
		voice,
	) && !/gameState\.lightRadius \+ 0\.5/.test(voice),
);
check(
	"source_audio_muffle_q_is_non_resonant",
	/AUDIO_MUFFLE_Q/.test(voice) &&
		!/isOnCamera \? -15 : 20/.test(voice) &&
		!/setSmoothedAudioParam\(muffle\.Q, 10/.test(voice),
);
check(
	"source_audio_not_overfocused_directionally",
	!/AUDIO_DIRECTIONAL_FOCUS/.test(voice) &&
		/pan\.rolloffFactor = 1/.test(voice) &&
		!/maxdistance \* AUDIO_DIRECTIONAL_FOCUS/.test(voice),
);
check(
	"source_audio_rebuilds_single_effect_chain",
	/function updateAudioEffectChain/.test(voice) &&
		/gain\.disconnect\(\)/.test(voice) &&
		/muffle\.disconnect\(\)/.test(voice) &&
		/reverb\.disconnect\(\)/.test(voice) &&
		/audio\.muffleConnected/.test(voice) &&
		/audio\.reverbConnected/.test(voice) &&
		!/function applyEffect/.test(voice) &&
		!/function restoreEffect/.test(voice),
);
check(
	"source_audio_separates_radio_and_environment_muffle",
	/radioMuffle/.test(voice) &&
		/radioMuffleConnected/.test(voice) &&
		/radioMuffle\.type = ['"]highpass['"]/.test(voice) &&
		/muffle\.type = ['"]lowpass['"]/.test(voice) &&
		!/muffle\.type = ['"]highpass['"]/.test(voice),
);
check(
	"source_audio_keeps_muffles_in_permanent_chain",
	/AUDIO_MUFFLE_OFF_FREQUENCY/.test(voice) &&
		/gain\.connect\(radioMuffle\)/.test(voice) &&
		/radioMuffle\.connect\(muffle\)/.test(voice) &&
		(/muffle\.connect\(destination\)/.test(voice) ||
			(/muffle\.connect\(limiter\)/.test(voice) &&
				/limiter\.connect\(destination\)/.test(voice))) &&
		!/if \(audio\.muffleConnected\) \{\s*output\.connect\(muffle\)/.test(voice),
);
check(
	"source_audio_has_output_limiter",
	/createDynamicsCompressor/.test(voice) &&
		/limiter\.threshold\.value/.test(voice) &&
		/limiter\.ratio\.value/.test(voice) &&
		/limiter\.connect\(destination\)/.test(voice),
);
check(
	"source_voice_activity_requires_mapped_socket",
	/const mappedClient = socketClientsRef\.current\[data\.socketId\]/.test(
		voice,
	) &&
		/if \(!mappedClient\)/.test(voice) &&
		/const activeClientId = socketClientsRef\.current\[peer\]\?\.clientId;/.test(
			voice,
		) &&
		/if \(activeClientId === undefined\)/.test(voice),
);

console.log(`METRIC simulation_failures=${failures}`);

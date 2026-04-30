import React, {
	useEffect,
	useMemo,
	useRef,
	useState,
	CSSProperties,
} from "react";
import { bridge } from "./bridge";
import {
	AmongUsState,
	GameState,
	Player,
	VoiceState,
} from "../common/AmongUsState";
import { IpcOverlayMessages, IpcMessages } from "../common/ipc-messages";
import ReactDOM from "react-dom";
import makeStyles from "@mui/styles/makeStyles";
import "./css/overlay.css";
import Avatar from "./Avatar";
import {
	AleLuduColumnTuning,
	AleLuduTuning,
	ISettings,
} from "../common/ISettings";
import { DEFAULT_PLAYERCOLORS } from "../common/playerColors";
import { OVERLAY_STATE_KEYS, readOverlayState } from "../common/overlay-state";
import SettingsStore from "./settings/SettingsStore";
import { CameraLocation, MapType } from "../common/AmongusMap";

interface UseStylesProps {
	height: number;
	width: number;
	oldHud: boolean;
	aleLuduMode: boolean;
	aleLuduColumns: number;
	aleLuduRows: number;
	aleLuduContainerHeight: string;
	// aleLudu-only: explicit meetingHud rect overrides (% of viewport)
	mhLeftPct: number;
	mhTopPct: number;
	mhWidthPct: number;
	mhHeightPct: number;
	// aleLudu-only: tablet rect override (% of meetingHud)
	tabletLeftPct: number;
	tabletTopPct: number;
	tabletWidthPct: number;
	tabletHeightPct: number;
}

export interface playerContainerCss extends CSSProperties {
	"--size": string;
}

const useStyles = makeStyles(() => ({
	meetingHud: {
		position: "absolute",
		// aleLudu-mode: explicit rect as % of viewport (tunable in Settings panel).
		// legacy / non-aleLudu: keep centered-with-computed-pixel-size behavior.
		top: ({ aleLuduMode, mhTopPct }: UseStylesProps) =>
			aleLuduMode ? `${mhTopPct}%` : "50%",
		left: ({ aleLuduMode, mhLeftPct }: UseStylesProps) =>
			aleLuduMode ? `${mhLeftPct}%` : "50%",
		width: ({ aleLuduMode, mhWidthPct, width }: UseStylesProps) =>
			aleLuduMode ? `${mhWidthPct}%` : width,
		height: ({ aleLuduMode, mhHeightPct, height }: UseStylesProps) =>
			aleLuduMode ? `${mhHeightPct}%` : height,
		transform: ({ aleLuduMode }: UseStylesProps) =>
			aleLuduMode ? "none" : "translate(-50%, -50%)",
	},
	tabletContainer: {
		width: ({ oldHud, aleLuduMode, tabletWidthPct }: UseStylesProps) =>
			oldHud ? "88.45%" : aleLuduMode ? `${tabletWidthPct}%` : "100%",
		height: ({ aleLuduMode, oldHud, tabletHeightPct }: UseStylesProps) =>
			oldHud ? "10.5%" : aleLuduMode ? `${tabletHeightPct}%` : "10.5%",
		left: ({ oldHud, aleLuduMode, tabletLeftPct }: UseStylesProps) =>
			oldHud ? "4.7%" : aleLuduMode ? `${tabletLeftPct}%` : "0.4%",
		top: ({ oldHud, aleLuduMode, tabletTopPct }: UseStylesProps) =>
			oldHud ? "18.4703%" : aleLuduMode ? `${tabletTopPct}%` : "15%",
		position: "absolute",
		display: ({ aleLuduMode }: UseStylesProps) =>
			aleLuduMode ? "block" : "flex",
		flexWrap: ({ aleLuduMode }: UseStylesProps) =>
			aleLuduMode ? undefined : "wrap",
	},
	playerContainer: {
		width: ({ aleLuduMode, oldHud }: UseStylesProps) =>
			oldHud ? "46.41%" : aleLuduMode ? "100%" : "30%",
		height: ({ aleLuduMode, oldHud }: UseStylesProps) =>
			oldHud ? "100%" : aleLuduMode ? "100%" : "109%",
		borderRadius: ({ height }: UseStylesProps) => height / 100,
		transition: "opacity .1s linear",
		marginBottom: ({ aleLuduMode, oldHud }: UseStylesProps) =>
			oldHud ? "2%" : aleLuduMode ? 0 : "1.9%",
		marginRight: ({ aleLuduMode, oldHud }: UseStylesProps) =>
			oldHud ? "2.34%" : aleLuduMode ? 0 : "0.23%",
		marginLeft: ({ aleLuduMode, oldHud }: UseStylesProps) =>
			oldHud ? "0%" : aleLuduMode ? 0 : "2.4%",
		boxSizing: "border-box",
	},
}));

function useWindowSize() {
	const [windowSize, setWindowSize] = useState<[number, number]>([0, 0]);

	useEffect(() => {
		const onResize = () => {
			setWindowSize([window.innerWidth, window.innerHeight]);
		};
		const onVisibilityChange = () => {
			onResize();
		};

		window.addEventListener("resize", onResize);
		window.addEventListener("focus", onResize);
		document.addEventListener("visibilitychange", onVisibilityChange);
		onResize();

		return () => {
			window.removeEventListener("resize", onResize);
			window.removeEventListener("focus", onResize);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, []);
	return windowSize;
}

const iPadRatio = 854 / 579;

const ALE_LUDU_COLUMNS = 4;

// Default tuning — matches the SettingsStore default. Live values come from
// settings.aleLuduTuning (user-tunable in the Settings page). The mod's actual
// world-space formula is:
//    pos = VoteOrigin + (dx*col*0.75 - 0.375, dy*row*0.75, z)  with scale = 0.75
// We don't have VoteOrigin / VoteButtonOffsets at runtime, so the user dials
// the equivalent %-of-meetingHud values plus the meetingHud/tablet rect
// overrides (% of viewport / % of meetingHud respectively) in the Settings panel.
// Live-calibrated defaults from the in-game AleLudu meeting overlay session.
// The legacy single-knob fields below are kept for the resolveColumnTuning fallback
// (when a saved config predates per-column data); the actual source-of-truth
// positions live in BASE_ALE_LUDU_COLUMNS and are hand-tuned per column because
// column pitch is NOT perfectly uniform (24.1 → 24.5 between neighbours).
const BASE_ALE_LUDU_TUNING = {
	col0CenterPct: 13.8,
	colPitchPct: 24.0,
	colWidthPct: 22.6,
	row0CenterPct: 5.0,
	rowHeight: 10.0,
	rowGap: 2.4,
	mhLeftPct: 8.05,
	mhTopPct: 11.95,
	mhWidthPct: 83.9,
	mhHeightPct: 76.1,
	tabletLeftPct: 0.0,
	tabletTopPct: 12.0,
	tabletWidthPct: 100.0,
	tabletHeightPct: 100.0,
};

// Exact per-column values dialed in live so the magenta calibration grid lines up
// with the AleLudu mod's tablet slots. Widths + row metrics are constant across
// columns; centres are non-uniform.
const BASE_ALE_LUDU_COLUMNS: AleLuduColumnTuning[] = [
	{
		centerPct: 13.8,
		widthPct: 22.6,
		row0CenterPct: 5.0,
		rowHeight: 10.0,
		rowGap: 2.4,
	},
	{
		centerPct: 38.3,
		widthPct: 22.5,
		row0CenterPct: 5.0,
		rowHeight: 10.0,
		rowGap: 2.4,
	},
	{
		centerPct: 62.4,
		widthPct: 22.6,
		row0CenterPct: 5.0,
		rowHeight: 10.0,
		rowGap: 2.4,
	},
	{
		centerPct: 86.9,
		widthPct: 22.6,
		row0CenterPct: 5.0,
		rowHeight: 10.0,
		rowGap: 2.4,
	},
];

function defaultColumnTuning(index: number): AleLuduColumnTuning {
	// Clamp index into the hand-calibrated array; out-of-range should never happen
	// since ALE_LUDU_COLUMNS === BASE_ALE_LUDU_COLUMNS.length, but guard anyway so a
	// future ALE_LUDU_COLUMNS bump doesn't produce an undefined entry.
	const src =
		BASE_ALE_LUDU_COLUMNS[index] ??
		BASE_ALE_LUDU_COLUMNS[BASE_ALE_LUDU_COLUMNS.length - 1];
	return { ...src };
}

export const DEFAULT_ALE_LUDU_TUNING: AleLuduTuning = {
	...BASE_ALE_LUDU_TUNING,
	showDebug: false,
	columns: Array.from({ length: ALE_LUDU_COLUMNS }, (_, i) =>
		defaultColumnTuning(i),
	),
};

function resolveColumnTuning(
	tuning: AleLuduTuning,
	column: number,
): AleLuduColumnTuning {
	const existing = tuning.columns?.[column];
	if (existing) {
		return existing;
	}
	// Legacy fallback when `columns` is missing (pre-migration settings). Mirrors the
	// historical single-set-of-knobs behavior so old saved configs keep working.
	// Note: legacy code ignored tuning.row0CenterPct for positioning, so we default
	// row 0 center to rowHeight/2 here to keep row 0 top pinned at 0 like before.
	return {
		centerPct: tuning.col0CenterPct + column * tuning.colPitchPct,
		widthPct: tuning.colWidthPct,
		row0CenterPct: tuning.rowHeight / 2,
		rowHeight: tuning.rowHeight,
		rowGap: tuning.rowGap,
	};
}

function getAleLuduCardStyle(
	index: number,
	tuning: AleLuduTuning,
): CSSProperties {
	const column = index % ALE_LUDU_COLUMNS;
	const row = Math.floor(index / ALE_LUDU_COLUMNS);
	const col = resolveColumnTuning(tuning, column);
	const topCenter = col.row0CenterPct + row * (col.rowHeight + col.rowGap);

	return {
		position: "absolute",
		left: `${col.centerPct - col.widthPct / 2}%`,
		top: `${topCenter - col.rowHeight / 2}%`,
		width: `${col.widthPct}%`,
		height: `${col.rowHeight}%`,
	};
}

interface MeasuredRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

function measureRect(element: HTMLElement | null): MeasuredRect | null {
	if (!element) {
		return null;
	}

	const { left, top, width, height } = element.getBoundingClientRect();
	return {
		left: Number(left.toFixed(1)),
		top: Number(top.toFixed(1)),
		width: Number(width.toFixed(1)),
		height: Number(height.toFixed(1)),
	};
}

function formatRect(rect: MeasuredRect | null): string {
	if (!rect) {
		return "n/a";
	}

	return `${rect.left},${rect.top} ${rect.width}x${rect.height}`;
}

function truncateName(name: string, maxLength = 14): string {
	if (name.length <= maxLength) {
		return name;
	}

	return `${name.slice(0, maxLength - 1)}…`;
}

function sortedMeetingPlayerIds(players: Player[]): number[] {
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

function initialMeetingPlayerIds(
	gameState: AmongUsState,
	players: Player[],
	aleLuduMode: boolean,
	meetingStartPlayers?: Player[] | null,
): number[] {
	if (
		aleLuduMode &&
		gameState.oldGameState === GameState.TASKS &&
		meetingStartPlayers?.length
	) {
		return sortedMeetingPlayerIds(meetingStartPlayers);
	}
	if (gameState.oldGameState !== GameState.TASKS) {
		return players.map((player) => player.id);
	}

	return sortedMeetingPlayerIds(players);
}

function appendMissingMeetingPlayers(
	frozenIds: number[],
	players: Player[],
): number[] {
	const seen = new Set(frozenIds);
	const missingIds = sortedMeetingPlayerIds(players).filter(
		(id) => !seen.has(id),
	);
	return missingIds.length === 0 ? frozenIds : [...frozenIds, ...missingIds];
}

function hasMissingMeetingPlayers(
	frozenIds: number[],
	players: Player[],
): boolean {
	const seen = new Set(frozenIds);
	return players.some((player) => !seen.has(player.id));
}

const EMPTY_GAME_STATE: AmongUsState = {
	gameState: GameState.UNKNOWN,
	oldGameState: GameState.UNKNOWN,
	lobbyCodeInt: -1,
	lobbyCode: "MENU",
	players: [],
	isHost: false,
	clientId: 0,
	hostId: 0,
	comsSabotaged: false,
	currentCamera: CameraLocation.NONE,
	map: MapType.UNKNOWN,
	lightRadius: 0,
	lightRadiusChanged: false,
	closedDoors: [],
	currentServer: "",
	currentServerLabel: "",
	maxPlayers: 0,
	mod: "NONE",
	oldMeetingHud: false,
};

const EMPTY_VOICE_STATE: VoiceState = {
	otherTalking: {},
	otherDead: {},
	clientConnections: {},
	impostorRadioClientId: -1,
	localTalking: false,
	localIsAlive: true,
	muted: false,
	deafened: false,
	mod: "NONE",
};

function normalizeVoiceState(
	nextState: Partial<VoiceState> | null | undefined,
): VoiceState {
	return {
		...EMPTY_VOICE_STATE,
		...(nextState ?? {}),
		otherTalking: nextState?.otherTalking ?? {},
		otherDead: nextState?.otherDead ?? {},
		clientConnections: nextState?.clientConnections ?? {},
	};
}

const OVERLAY_ROSTER_GRACE_MS = 2000;
const OVERLAY_VOICE_ACTIVITY_GRACE_MS = 1500;

interface StableOverlayPlayer {
	player: Player;
	firstSeenAt: number;
	lastSeenAt: number;
}

const Overlay: React.FC = function () {
	const [gameState, setGameState] = useState<AmongUsState>(
		() =>
			readOverlayState<AmongUsState>(OVERLAY_STATE_KEYS.gameState) ??
			EMPTY_GAME_STATE,
	);
	const [voiceState, setVoiceState] = useState<VoiceState>(() =>
		normalizeVoiceState(
			readOverlayState<VoiceState>(OVERLAY_STATE_KEYS.voiceState),
		),
	);
	const [settings, setSettings] = useState<ISettings>(
		() =>
			readOverlayState<ISettings>(OVERLAY_STATE_KEYS.settings) ??
			SettingsStore.store,
	);
	const [playerColors, setColors] = useState<string[][]>(
		() =>
			readOverlayState<string[][]>(OVERLAY_STATE_KEYS.playerColors) ??
			DEFAULT_PLAYERCOLORS,
	);
	const lastTaskPlayersRef = useRef<Player[] | null>(null);

	function rememberTaskPlayers(nextState: AmongUsState) {
		if (nextState.gameState === GameState.TASKS && nextState.players?.length) {
			lastTaskPlayersRef.current = nextState.players.map((player) => ({
				...player,
			}));
		} else if (
			nextState.gameState === GameState.LOBBY ||
			nextState.gameState === GameState.MENU ||
			nextState.gameState === GameState.UNKNOWN
		) {
			lastTaskPlayersRef.current = null;
		}
	}

	useEffect(() => {
		let initRequests = 0;
		const requestInitValues = () => {
			bridge.send(
				IpcMessages.SEND_TO_MAINWINDOW,
				IpcOverlayMessages.REQUEST_INITVALUES,
			);
		};
		const requestInitValuesOnVisibilityChange = () => {
			requestInitValues();
		};

		const onState = (_: unknown, newState: AmongUsState) => {
			rememberTaskPlayers(newState);
			setGameState(newState);
		};
		const onVoiceState = (_: unknown, newState: VoiceState) => {
			setVoiceState(normalizeVoiceState(newState));
		};
		const onSettings = (_: unknown, newState: ISettings) => {
			console.log("Recieved settings..");

			setSettings(newState);
		};
		const onColorChange = (_: unknown, colors: string[][]) => {
			setColors(colors);
		};
		const onStorage = (event: StorageEvent) => {
			if (!event.key) {
				return;
			}

			if (event.key === OVERLAY_STATE_KEYS.gameState) {
				const nextGameState = readOverlayState<AmongUsState>(
					OVERLAY_STATE_KEYS.gameState,
				);
				if (nextGameState) {
					rememberTaskPlayers(nextGameState);
					setGameState(nextGameState);
				}
				return;
			}

			if (event.key === OVERLAY_STATE_KEYS.voiceState) {
				const nextVoiceState = readOverlayState<VoiceState>(
					OVERLAY_STATE_KEYS.voiceState,
				);
				if (nextVoiceState) {
					setVoiceState(normalizeVoiceState(nextVoiceState));
				}
				return;
			}

			if (event.key === OVERLAY_STATE_KEYS.settings) {
				const nextSettings = readOverlayState<ISettings>(
					OVERLAY_STATE_KEYS.settings,
				);
				if (nextSettings) {
					setSettings(nextSettings);
				}
				return;
			}

			if (event.key === OVERLAY_STATE_KEYS.playerColors) {
				const nextPlayerColors = readOverlayState<string[][]>(
					OVERLAY_STATE_KEYS.playerColors,
				);
				if (nextPlayerColors) {
					setColors(nextPlayerColors);
				}
			}
		};

		bridge.on(IpcOverlayMessages.NOTIFY_GAME_STATE_CHANGED, onState);
		bridge.on(IpcOverlayMessages.NOTIFY_VOICE_STATE_CHANGED, onVoiceState);
		bridge.on(IpcOverlayMessages.NOTIFY_SETTINGS_CHANGED, onSettings);
		bridge.on(IpcOverlayMessages.NOTIFY_PLAYERCOLORS_CHANGED, onColorChange);
		window.addEventListener("storage", onStorage);
		window.addEventListener("focus", requestInitValues);
		document.addEventListener(
			"visibilitychange",
			requestInitValuesOnVisibilityChange,
		);
		requestInitValues();
		const initInterval = window.setInterval(() => {
			initRequests += 1;
			requestInitValues();
			if (initRequests >= 10) {
				window.clearInterval(initInterval);
			}
		}, 300);

		return () => {
			window.clearInterval(initInterval);
			window.removeEventListener("storage", onStorage);
			window.removeEventListener("focus", requestInitValues);
			document.removeEventListener(
				"visibilitychange",
				requestInitValuesOnVisibilityChange,
			);
			bridge.off(IpcOverlayMessages.NOTIFY_GAME_STATE_CHANGED, onState);
			bridge.off(IpcOverlayMessages.NOTIFY_VOICE_STATE_CHANGED, onVoiceState);
			bridge.off(IpcOverlayMessages.NOTIFY_SETTINGS_CHANGED, onSettings);
			bridge.off(IpcOverlayMessages.NOTIFY_PLAYERCOLORS_CHANGED, onColorChange);
		};
	}, []);

	useEffect(() => {
		rememberTaskPlayers(gameState);
	}, [gameState]);

	if (
		!settings ||
		!voiceState ||
		!gameState ||
		!settings.enableOverlay ||
		gameState.gameState == GameState.MENU ||
		gameState.gameState == GameState.UNKNOWN
	)
		return null;
	return (
		<>
			{settings.meetingOverlay &&
				gameState.gameState === GameState.DISCUSSION && (
					<MeetingHud
						gameState={gameState}
						voiceState={voiceState}
						playerColors={playerColors}
						aleLuduMode={settings.aleLuduMode}
						tuning={settings.aleLuduTuning ?? DEFAULT_ALE_LUDU_TUNING}
						meetingStartPlayers={lastTaskPlayersRef.current}
					/>
				)}
			{settings.overlayPosition !== "hidden" && (
				<AvatarOverlay
					voiceState={voiceState}
					gameState={gameState}
					position={settings.overlayPosition}
					compactOverlay={settings.compactOverlay}
					alwaysShowPlayers={settings.alwaysShowOverlayPlayers}
					playerColors={playerColors}
				/>
			)}
		</>
	);
};

interface AvatarOverlayProps {
	voiceState: VoiceState;
	gameState: AmongUsState;
	position: ISettings["overlayPosition"];
	compactOverlay: boolean;
	alwaysShowPlayers: boolean;
	playerColors: string[][];
}

const AvatarOverlay: React.FC<AvatarOverlayProps> = ({
	voiceState,
	gameState,
	position,
	compactOverlay,
	alwaysShowPlayers,
	playerColors,
}: AvatarOverlayProps) => {
	const positionParse = position.replace("1", "");
	const [nowTick, setNowTick] = useState(() => Date.now());
	const [stablePlayers, setStablePlayers] = useState<
		Record<number, StableOverlayPlayer>
	>({});
	const previousLobbyCodeRef = useRef(gameState.lobbyCode);

	const avatars: JSX.Element[] = [];
	const isOnSide = positionParse == "right" || positionParse == "left";
	const showName =
		isOnSide &&
		(!compactOverlay || position === "right1" || position === "left1");
	const classnames: string[] = ["overlay-wrapper"];
	if (
		gameState.gameState == GameState.UNKNOWN ||
		gameState.gameState == GameState.MENU
	) {
		classnames.push("gamestate_menu");
	} else {
		classnames.push("gamestate_game");
		classnames.push("overlay_postion_" + positionParse);
		if (
			compactOverlay ||
			position === "right1" ||
			position === "left1" ||
			position === "top"
		) {
			classnames.push("compactoverlay");
		}
		if (position === "left1" || position === "right1" || position === "top1") {
			classnames.push("overlay_postion_" + position);
		}
	}

	useEffect(() => {
		const tickId = window.setInterval(() => {
			setNowTick(Date.now());
		}, 250);

		return () => {
			window.clearInterval(tickId);
		};
	}, []);

	useEffect(() => {
		if (previousLobbyCodeRef.current === gameState.lobbyCode) {
			return;
		}

		previousLobbyCodeRef.current = gameState.lobbyCode;
		setStablePlayers({});
	}, [gameState.lobbyCode]);

	useEffect(() => {
		if (
			gameState.gameState === GameState.MENU ||
			gameState.gameState === GameState.UNKNOWN
		) {
			setStablePlayers({});
			return;
		}

		setStablePlayers((old) => {
			const next: Record<number, StableOverlayPlayer> = { ...old };
			const liveClientIds = new Set<number>();

			for (const player of gameState.players ?? []) {
				liveClientIds.add(player.clientId);
				next[player.clientId] = {
					player,
					firstSeenAt: old[player.clientId]?.firstSeenAt ?? nowTick,
					lastSeenAt: nowTick,
				};
			}

			for (const key of Object.keys(next)) {
				const clientId = Number(key);
				if (liveClientIds.has(clientId)) {
					continue;
				}

				const slot = next[clientId];
				const recentlyConnected = isClientVoiceStateFresh(
					slot.player,
					voiceState,
					nowTick,
				);
				const recentlyTalking =
					recentlyConnected &&
					(Boolean(voiceState.otherTalking[clientId]) ||
						(slot.player.isLocal && voiceState.localTalking));

				if (
					recentlyConnected ||
					recentlyTalking ||
					nowTick - slot.lastSeenAt <= OVERLAY_ROSTER_GRACE_MS
				) {
					continue;
				}

				delete next[clientId];
			}

			return next;
		});
	}, [
		gameState.gameState,
		gameState.players,
		nowTick,
		voiceState.clientConnections,
		voiceState.localTalking,
		voiceState.otherTalking,
	]);

	const players = useMemo(() => {
		const sourcePlayers = Object.values(stablePlayers).map(
			(entry) => entry.player,
		);
		if (sourcePlayers.length === 0) return null;
		const playerss = sourcePlayers
			.filter(
				(o) =>
					!voiceState.localIsAlive ||
					!(voiceState.otherDead[o.clientId] && !o.isLocal),
			)
			.slice()
			.sort((a, b) => {
				if (
					(a.disconnected || voiceState.otherDead[a.clientId]) &&
					(b.disconnected || voiceState.otherDead[b.clientId])
				) {
					return a.id - b.id;
				} else if (a.disconnected || voiceState.otherDead[a.clientId]) {
					return 1000;
				} else if (b.disconnected || voiceState.otherDead[b.clientId]) {
					return -1000;
				}
				return a.id - b.id;
			});

		return playerss;
	}, [stablePlayers, voiceState.localIsAlive, voiceState.otherDead]);

	if (!players) return null;

	// const myPLayer = useMemo(() => {
	// 	if (!gameState.players) return null;
	// 	return gameState.players.find(o => o.isLocal && (!o.disconnected || !o.bugged))
	// }, [gameState.players]);

	players?.forEach((player) => {
		const talking =
			!player.inVent &&
			(voiceState.otherTalking[player.clientId] ||
				(player.isLocal && voiceState.localTalking));
		if (!alwaysShowPlayers && !talking) {
			return;
		}
		const connected = isClientVoiceStateFresh(player, voiceState, nowTick);
		if (!connected && !player.isLocal) {
			return;
		}
		avatars.push(
			<div key={player.id} className="player_wrapper">
				<div>
					<Avatar
						key={player.id}
						// connectionState={!connected ? 'disconnected' : audio ? 'connected' : 'novoice'}
						player={player}
						showborder={isOnSide && !compactOverlay}
						muted={voiceState.muted && player.isLocal}
						deafened={voiceState.deafened && player.isLocal}
						connectionState={"connected"}
						talking={talking}
						borderColor={
							!player.isLocal || player.shiftedColor == -1 ? "#2ecc71" : "gray"
						}
						isUsingRadio={voiceState.impostorRadioClientId == player.clientId}
						isAlive={
							!voiceState.otherDead[player.clientId] ||
							(player.isLocal && !player.isDead)
						}
						size={100}
						lookLeft={
							!(positionParse === "left" || positionParse === "bottom_left")
						}
						overflow={isOnSide && !showName}
						showHat={true}
						mod={voiceState.mod}
						playerColors={playerColors}
					/>
				</div>
				{showName && (
					<span
						className="playername"
						style={{
							opacity:
								(position === "right1" || position === "left1") && !talking
									? 0
									: 1,
						}}
					>
						<small>{player.name}</small>
					</span>
				)}
			</div>,
		);
	});
	if (avatars.length === 0) return null;
	const playerContainerStyle = {
		"--size": 7.5 * (10 / avatars.length) + "vh",
	} as playerContainerCss;
	return (
		<div>
			<div className={classnames.join(" ")} style={playerContainerStyle}>
				<div className="otherplayers">
					<div className="players_container playerContainerBack">{avatars}</div>
				</div>
			</div>
			{/* {(voiceState.muted || voiceState.deafened) && (
				<div className="volumeicons">{voiceState.deafened ? <VolumeOff /> : <MicOff />}</div>
			)} */}
		</div>
	);
};

interface MeetingHudProps {
	gameState: AmongUsState;
	voiceState: VoiceState;
	playerColors: string[][];
	aleLuduMode: boolean;
	tuning: AleLuduTuning;
	meetingStartPlayers?: Player[] | null;
}

interface MeetingOverlaySlot {
	key: string;
	slotIndex: number;
	player: Player | null;
}

function isVisibleAleLuduMeetingPlayer(player: Player): boolean {
	return !player.disconnected && !player.bugged && !player.isDummy;
}

function isClientVoiceStateFresh(
	player: Player,
	voiceState: VoiceState,
	now: number,
): boolean {
	if (player.isLocal) {
		return true;
	}

	const connection = voiceState.clientConnections[player.clientId];
	return Boolean(
		(Boolean(connection?.lastSeenAt) &&
			now - connection.lastSeenAt <= OVERLAY_ROSTER_GRACE_MS) ||
			(Boolean(connection?.lastAudioAt) &&
				now - connection.lastAudioAt <= OVERLAY_VOICE_ACTIVITY_GRACE_MS),
	);
}

function isMeetingPlayerTalking(
	player: Player,
	voiceState: VoiceState,
	now = Date.now(),
): boolean {
	if (!player.isLocal && player.disconnected) {
		return false;
	}
	const playerDead =
		player.isDead || Boolean(voiceState.otherDead[player.clientId]);
	if (voiceState.localIsAlive && !player.isLocal && playerDead) {
		return false;
	}
	if (!isClientVoiceStateFresh(player, voiceState, now)) {
		return false;
	}
	return Boolean(
		voiceState.otherTalking[player.clientId] ||
			(player.isLocal && voiceState.localTalking),
	);
}

const MeetingHud: React.FC<MeetingHudProps> = ({
	voiceState,
	gameState,
	playerColors,
	aleLuduMode,
	tuning,
	meetingStartPlayers,
}: MeetingHudProps) => {
	const [windowWidth, windowheight] = useWindowSize();
	const meetingHudRef = useRef<HTMLDivElement | null>(null);
	const tabletContainerRef = useRef<HTMLDivElement | null>(null);
	const overlayRefs = useRef<Record<number, HTMLDivElement | null>>({});
	// Frozen player slot order captured on the first render of this MeetingHud instance.
	// The vanilla tablet only sorts alive-first when the meeting starts — it does NOT
	// re-shuffle slots when a player dies mid-meeting (guess / Jailor execute / etc.).
	// Without this freeze, our overlay re-sorts on every `gameState.players` push and the
	// coloured card boxes jump to the wrong tiles for the rest of the meeting.
	// MeetingHud unmounts when discussion ends, so the ref is re-initialised per meeting.
	const frozenMeetingOrderRef = useRef<number[] | null>(null);
	const aleLuduColumns =
		!gameState.oldMeetingHud && aleLuduMode ? ALE_LUDU_COLUMNS : 0;
	const showAleLuduDebug =
		!gameState.oldMeetingHud && aleLuduMode && tuning.showDebug;
	const [debugRects, setDebugRects] = useState<{
		meetingHud: MeasuredRect | null;
		tablet: MeasuredRect | null;
		overlays: Record<number, MeasuredRect | null>;
	}>({
		meetingHud: null,
		tablet: null,
		overlays: {},
	});
	const [width, height] = useMemo(() => {
		if (gameState.oldMeetingHud) {
			let hudWidth = 0,
				hudHeight = 0;
			if (windowWidth / (windowheight * 0.96) > iPadRatio) {
				hudHeight = windowWidth * 0.96;
				hudWidth = hudHeight * iPadRatio;
			} else {
				hudWidth = windowWidth;
				hudHeight = windowWidth * (1 / iPadRatio);
			}
			return [hudWidth, hudHeight];
		}

		let resultW;
		const ratio_diff = Math.abs(windowWidth / windowheight - 1.7);

		if (ratio_diff < 0.25) {
			resultW = windowWidth / 1.192;
		} else if (ratio_diff < 0.5) {
			resultW = windowWidth / 1.146;
		} else {
			resultW = windowWidth / 1.591;
		}

		const resultH = resultW / (aleLuduMode ? 1.96 : 1.72);

		return [resultW, resultH];
	}, [windowWidth, windowheight, gameState.oldMeetingHud, aleLuduMode]);

	const players = useMemo(() => {
		if (!gameState.players || gameState.players.length === 0) return null;
		const src = gameState.players;

		// AleLudu's MeetingHudBehaviour orders targets with
		//   playerStates.OrderBy(p => p.AmDead)
		// which is a *stable* sort run once when the meeting Start()s — alive players
		// first in their original playerStates index order, then dead players in their
		// original order. The Rust reader walks GameData.Instance.AllPlayers
		// sequentially, so gameState.players[i] matches meetingHud.playerStates[i].
		//
		// CRITICAL: the vanilla tablet does NOT re-sort when someone dies mid-meeting
		// (guess / Jailor execute / etc.). The dead player keeps their slot, they just
		// get the "DEAD" overlay. If we re-sort on every render the way we used to, the
		// card positions jump the instant isDead flips and every tile after the newly
		// dead player renders on the wrong face. We freeze the order on first render and
		// reuse it for the rest of the meeting (MeetingHud remounts each new meeting,
		// clearing the ref).
		if (gameState.gameState === GameState.DISCUSSION) {
			if (frozenMeetingOrderRef.current === null) {
				frozenMeetingOrderRef.current = initialMeetingPlayerIds(
					gameState,
					src,
					aleLuduColumns > 0,
					meetingStartPlayers,
				);
			} else if (
				src.length > frozenMeetingOrderRef.current.length ||
				hasMissingMeetingPlayers(frozenMeetingOrderRef.current, src)
			) {
				frozenMeetingOrderRef.current = appendMissingMeetingPlayers(
					frozenMeetingOrderRef.current,
					src,
				);
			}

			const frozen = frozenMeetingOrderRef.current;
			const byId = new Map<number, Player>();
			for (const player of src) {
				byId.set(player.id, player);
			}

			const ordered: Player[] = [];
			const seen = new Set<number>();
			for (const id of frozen) {
				const player = byId.get(id);
				if (player) {
					ordered.push(player);
					seen.add(id);
				}
			}
			// Late joiners or replacement players that weren't in the frozen snapshot
			// get appended at the end rather than dropped (extremely rare, but safe).
			for (const player of src) {
				if (!seen.has(player.id)) {
					ordered.push(player);
				}
			}
			return ordered;
		}

		return src.slice().sort((a, b) => {
			if ((a.disconnected || a.isDead) && (b.disconnected || b.isDead)) {
				return a.id - b.id;
			} else if (a.disconnected || a.isDead) {
				return 1000;
			} else if (b.disconnected || b.isDead) {
				return -1000;
			}
			return a.id - b.id;
		});
	}, [
		aleLuduColumns,
		gameState.gameState,
		gameState.players,
		meetingStartPlayers,
	]);
	const renderPlayers = players ?? [];
	const aleLuduRenderPlayers = renderPlayers.filter(
		isVisibleAleLuduMeetingPlayer,
	);
	// Stable card-slot index per player ID, captured at meeting start via frozenMeetingOrderRef.
	// Using this instead of `renderPlayers.map`'s array index means that if TOU removes a player
	// from gameState.players mid-meeting (guess / Jailor execute can drop the entry entirely,
	// not just flip isDead), the remaining players keep their original column/row positions
	// — the dead player's slot just renders empty instead of shifting everything after it up.
	const frozenCardIndexById: Map<number, number> = (() => {
		const order = frozenMeetingOrderRef.current;
		const map = new Map<number, number>();
		if (order) {
			order.forEach((id, idx) => map.set(id, idx));
		}
		return map;
	})();
	const overlaySlots: MeetingOverlaySlot[] = (() => {
		const order = frozenMeetingOrderRef.current;
		if (aleLuduColumns > 0) {
			return aleLuduRenderPlayers.map((player, index) => ({
				key: `player-${player.id}`,
				player,
				slotIndex: index,
			}));
		}

		if (!order) {
			return renderPlayers.map((player, index) => ({
				key: `player-${player.id}`,
				player,
				slotIndex: index,
			}));
		}

		const playerById = new Map(
			renderPlayers.map((player) => [player.id, player]),
		);
		return order.map((id, index) => {
			const player = playerById.get(id) ?? null;
			return {
				key: player
					? `player-${player.id}`
					: `meetingPlaceholder-${id}-${index}`,
				player,
				slotIndex: index,
			};
		});
	})();
	const canRenderMeetingHud =
		gameState.gameState === GameState.DISCUSSION && renderPlayers.length > 0;
	const aleLuduSlotCount =
		aleLuduColumns > 0
			? aleLuduRenderPlayers.length
			: (frozenMeetingOrderRef.current?.length ?? renderPlayers.length);
	const aleLuduRows =
		aleLuduColumns > 0
			? Math.max(1, Math.ceil(aleLuduSlotCount / aleLuduColumns))
			: 0;
	const aleLuduContainerHeight =
		aleLuduRows > 0
			? `${aleLuduRows * tuning.rowHeight + Math.max(0, aleLuduRows - 1) * tuning.rowGap}%`
			: "0%";

	useEffect(() => {
		if (!showAleLuduDebug) {
			setDebugRects({
				meetingHud: null,
				tablet: null,
				overlays: {},
			});
			return;
		}

		const frameId = window.requestAnimationFrame(() => {
			const nextOverlayRects: Record<number, MeasuredRect | null> = {};
			for (const player of aleLuduColumns > 0
				? aleLuduRenderPlayers
				: renderPlayers) {
				nextOverlayRects[player.id] = measureRect(
					overlayRefs.current[player.id] ?? null,
				);
			}

			setDebugRects({
				meetingHud: measureRect(meetingHudRef.current),
				tablet: measureRect(tabletContainerRef.current),
				overlays: nextOverlayRects,
			});
		});

		return () => {
			window.cancelAnimationFrame(frameId);
		};
	}, [
		showAleLuduDebug,
		aleLuduColumns,
		aleLuduRenderPlayers,
		renderPlayers,
		windowWidth,
		windowheight,
		aleLuduContainerHeight,
		voiceState.localTalking,
		voiceState.otherTalking,
	]);

	const classes = useStyles({
		width: width,
		height: height,
		oldHud: gameState.oldMeetingHud,
		aleLuduMode: !gameState.oldMeetingHud && aleLuduMode,
		aleLuduColumns,
		aleLuduRows,
		aleLuduContainerHeight,
		mhLeftPct: tuning.mhLeftPct,
		mhTopPct: tuning.mhTopPct,
		mhWidthPct: tuning.mhWidthPct,
		mhHeightPct: tuning.mhHeightPct,
		tabletLeftPct: tuning.tabletLeftPct,
		tabletTopPct: tuning.tabletTopPct,
		tabletWidthPct: tuning.tabletWidthPct,
		tabletHeightPct: tuning.tabletHeightPct,
	});
	const debugGuidePlayers =
		aleLuduColumns > 0 ? aleLuduRenderPlayers : renderPlayers;
	const debugGuides = showAleLuduDebug
		? debugGuidePlayers.map((player, index) => {
				const cardIndex =
					aleLuduColumns > 0
						? index
						: (frozenCardIndexById.get(player.id) ?? index);
				const fallbackStyle = getAleLuduCardStyle(cardIndex, tuning);

				return (
					<div
						key={`debug-${player.id}`}
						style={{
							...fallbackStyle,
							position: "absolute",
							boxSizing: "border-box",
							border: "3px solid rgba(255, 0, 255, 1)",
							background: "rgba(255, 0, 255, 0.35)",
							pointerEvents: "none",
							zIndex: 1,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "white",
							fontFamily: "monospace",
							fontSize: 18,
							fontWeight: "bold",
							textShadow: "0 0 4px #000, 0 0 4px #000",
						}}
					>
						#{index} {truncateName(player.name, 10)}
					</div>
				);
			})
		: null;

	const overlays = overlaySlots.map(({ player, slotIndex, key }) => {
		if (!player) {
			return (
				<div
					key={key}
					className={classes.playerContainer}
					style={{ opacity: 0, pointerEvents: "none" }}
				/>
			);
		}

		const color = playerColors[player.colorId]
			? playerColors[player.colorId][0]
			: "#C51111";
		const aleLuduCardStyle =
			!gameState.oldMeetingHud && aleLuduMode
				? getAleLuduCardStyle(slotIndex, tuning)
				: undefined;
		const talking = isMeetingPlayerTalking(player, voiceState);

		return (
			<div
				key={key}
				className={classes.playerContainer}
				ref={(element) => {
					overlayRefs.current[player.id] = element;
				}}
				style={{
					...aleLuduCardStyle,
					opacity: talking ? 1 : 0,
					border: "solid",
					borderWidth: "2px",
					borderColor: "#00000037",
					boxShadow: `0 0 ${height / 100}px ${height / 100}px ${color}`,
					transition: "opacity 400ms",
				}}
			/>
		);
	});
	if (!canRenderMeetingHud) return null;

	return (
		<>
			<div
				ref={meetingHudRef}
				className={classes.meetingHud}
				style={
					showAleLuduDebug
						? {
								outline: "2px dashed rgba(255, 86, 86, 0.9)",
							}
						: undefined
				}
			>
				{showAleLuduDebug && (
					<div
						style={{
							position: "absolute",
							top: -18,
							left: 0,
							padding: "1px 6px",
							background: "rgba(0,0,0,0.82)",
							color: "#ff8f8f",
							fontFamily: "monospace",
							fontSize: 11,
							lineHeight: 1.2,
							pointerEvents: "none",
							zIndex: 10,
						}}
					>
						MEETING HUD
					</div>
				)}
				<div
					ref={tabletContainerRef}
					className={classes.tabletContainer}
					style={
						showAleLuduDebug
							? {
									outline: "2px dashed rgba(255, 224, 102, 0.92)",
								}
							: undefined
					}
				>
					{showAleLuduDebug && (
						<div
							style={{
								position: "absolute",
								top: -18,
								left: 0,
								padding: "1px 6px",
								background: "rgba(0,0,0,0.82)",
								color: "#ffe066",
								fontFamily: "monospace",
								fontSize: 11,
								lineHeight: 1.2,
								pointerEvents: "none",
								zIndex: 10,
							}}
						>
							TABLET
						</div>
					)}
					{debugGuides}
					{overlays}
				</div>
			</div>
			{showAleLuduDebug && (
				<div
					style={{
						position: "fixed",
						right: 10,
						bottom: 10,
						width: 420,
						maxHeight: "42vh",
						overflow: "auto",
						padding: 10,
						background: "rgba(0, 0, 0, 0.88)",
						color: "#f5f7fa",
						border: "1px solid rgba(127, 252, 255, 0.35)",
						fontFamily: "monospace",
						fontSize: 11,
						lineHeight: 1.35,
						pointerEvents: "none",
						zIndex: 9999,
						whiteSpace: "pre-wrap",
					}}
				>
					<div>ALELUDU DEBUG</div>
					<div>
						viewport: {windowWidth}x{windowheight}
					</div>
					<div>meetingHud: {formatRect(debugRects.meetingHud)}</div>
					<div>tablet: {formatRect(debugRects.tablet)}</div>
					<div>players: {renderPlayers.length}</div>
					<div>containerHeight: {aleLuduContainerHeight}</div>
					<div>order: normal meeting overlay sort</div>
					<div>legend: magenta=deterministic AleLudu slot</div>
					<div style={{ marginTop: 8 }}>
						{renderPlayers.map((player, index) => {
							const talking = isMeetingPlayerTalking(player, voiceState);

							return (
								<div key={`debug-line-${player.id}`}>
									{index.toString().padStart(2, "0")}{" "}
									{truncateName(player.name, 16)} p{player.id}/c
									{player.clientId} dead={player.isDead ? 1 : 0} talk=
									{talking ? 1 : 0} box=
									{formatRect(debugRects.overlays[player.id] ?? null)}
								</div>
							);
						})}
					</div>
				</div>
			)}
		</>
	);
};

ReactDOM.render(<Overlay />, document.getElementById("app"));

export default Overlay;

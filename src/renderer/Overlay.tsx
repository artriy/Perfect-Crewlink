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
import { ISettings } from "../common/ISettings";
import { DEFAULT_PLAYERCOLORS } from "../common/playerColors";
import { OVERLAY_STATE_KEYS, readOverlayState } from "../common/overlay-state";
import SettingsStore from "./settings/SettingsStore";
import { CameraLocation, MapType } from "../common/AmongusMap";

interface UseStylesProps {
	height: number;
	width: number;
	oldHud: boolean;
}

export interface playerContainerCss extends CSSProperties {
	"--size": string;
}

const useStyles = makeStyles(() => ({
	meetingHud: {
		position: "absolute",
		top: "50%",
		left: "50%",
		width: ({ width }: UseStylesProps) => width,
		height: ({ height }: UseStylesProps) => height,
		transform: "translate(-50%, -50%)",
	},
	tabletContainer: {
		width: ({ oldHud }: UseStylesProps) => (oldHud ? "88.45%" : "100%"),
		height: "10.5%",
		left: ({ oldHud }: UseStylesProps) => (oldHud ? "4.7%" : "0.4%"),
		top: ({ oldHud }: UseStylesProps) => (oldHud ? "18.4703%" : "15%"),
		position: "absolute",
		display: "flex",
		flexWrap: "wrap",
	},
	playerContainer: {
		width: ({ oldHud }: UseStylesProps) => (oldHud ? "46.41%" : "30%"),
		height: ({ oldHud }: UseStylesProps) => (oldHud ? "100%" : "109%"),
		borderRadius: ({ height }: UseStylesProps) => height / 100,
		transition: "opacity .1s linear",
		marginBottom: ({ oldHud }: UseStylesProps) => (oldHud ? "2%" : "1.9%"),
		marginRight: ({ oldHud }: UseStylesProps) => (oldHud ? "2.34%" : "0.23%"),
		marginLeft: ({ oldHud }: UseStylesProps) => (oldHud ? "0%" : "2.4%"),
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
	meetingStartPlayers?: Player[] | null,
): number[] {
	if (
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
	meetingStartPlayers?: Player[] | null;
}

interface MeetingOverlaySlot {
	key: string;
	player: Player | null;
}

function isVisibleMeetingPlayer(player: Player): boolean {
	return !player.disconnected && !player.bugged && !player.isDummy;
}

function visibleMeetingSlotPlayer(player: Player | null): Player | null {
	if (!player) return null;
	return isVisibleMeetingPlayer(player) ? player : null;
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
	meetingStartPlayers,
}: MeetingHudProps) => {
	const [windowWidth, windowheight] = useWindowSize();
	// Frozen player slot order captured on the first render of this MeetingHud instance.
	// The vanilla tablet only sorts alive-first when the meeting starts — it does NOT
	// re-shuffle slots when a player dies mid-meeting (guess / Jailor execute / etc.).
	// Without this freeze, our overlay re-sorts on every `gameState.players` push and the
	// coloured card boxes jump to the wrong tiles for the rest of the meeting.
	// MeetingHud unmounts when discussion ends, so the ref is re-initialised per meeting.
	const frozenMeetingOrderRef = useRef<number[] | null>(null);
	const [width, height] = useMemo(
		() => [windowWidth, windowheight],
		[windowWidth, windowheight],
	);

	const players = useMemo(() => {
		if (!gameState.players || gameState.players.length === 0) return null;
		const src = gameState.players;

		// The meeting tablet orders alive players before dead players when the meeting
		// starts. Rust meetingHud.cards is preferred below, but this frozen fallback
		// keeps the generic overlay stable when direct card data is unavailable.
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
		gameState.gameState,
		gameState.players,
		meetingStartPlayers,
	]);
	const renderPlayers = players ?? [];
	const rustMeetingCards =
		gameState.gameState === GameState.DISCUSSION
			? gameState.meetingHud?.cards
			: undefined;
	const overlaySlots: MeetingOverlaySlot[] = (() => {
		const playerById = new Map(
			renderPlayers.map((player) => [player.id, player]),
		);
		if (rustMeetingCards?.length) {
			return rustMeetingCards.map((card, index) => {
				const player = card.visible
					? (playerById.get(card.playerId) ?? null)
					: null;
				return {
					key: player
						? `meetingCard-${card.playerId}`
						: `meetingCardPlaceholder-${card.playerId}-${index}`,
					player,
				};
			});
		}

		const order = frozenMeetingOrderRef.current;
		if (!order) {
			return renderPlayers.map((player, index) => ({
				key: `player-${player.id}-${index}`,
				player: visibleMeetingSlotPlayer(player),
			}));
		}

		return order.map((id, index) => {
			const player = visibleMeetingSlotPlayer(playerById.get(id) ?? null);
			return {
				key: player
					? `player-${player.id}`
					: `meetingPlaceholder-${id}-${index}`,
				player,
			};
		});
	})();
	const canRenderMeetingHud =
		gameState.gameState === GameState.DISCUSSION && renderPlayers.length > 0;
	const classes = useStyles({
		width,
		height,
		oldHud: gameState.oldMeetingHud,
	});
	const overlays = overlaySlots.map(({ player, key }) => {
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
		const talking = isMeetingPlayerTalking(player, voiceState);

		return (
			<div
				key={key}
				className={classes.playerContainer}
				style={{
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
		<div className={classes.meetingHud}>
			<div className={classes.tabletContainer}>{overlays}</div>
		</div>
	);
};

ReactDOM.render(<Overlay />, document.getElementById("app"));

export default Overlay;

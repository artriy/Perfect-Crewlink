import React, { Dispatch, SetStateAction, Suspense, lazy, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { StyledEngineProvider, Theme, ThemeProvider } from '@mui/material/styles';
import makeStyles from '@mui/styles/makeStyles';
import { ThemeProvider as LegacyThemeProvider } from '@mui/styles';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import LinearProgress from '@mui/material/LinearProgress';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import SettingsIcon from '@mui/icons-material/Settings';
import RefreshSharpIcon from '@mui/icons-material/RefreshSharp';
import PublicIcon from '@mui/icons-material/Public';
import CloseIcon from '@mui/icons-material/Close';
import prettyBytes from 'pretty-bytes';
import { useTranslation } from 'react-i18next';
import Menu from './Menu';
import SettingsStore, { setLobbySetting, setSetting } from './settings/SettingsStore';
import { GameStateContext, HostSettingsContext, PlayerColorContext, SettingsContext } from './contexts';
import {
	AutoUpdaterState,
	IpcHandlerMessages,
	IpcOverlayMessages,
	IpcMessages,
	IpcRendererMessages,
} from '../common/ipc-messages';
import { AmongUsState, GameState } from '../common/AmongUsState';
import { CameraLocation, MapType } from '../common/AmongusMap';
import { DEFAULT_PLAYERCOLORS } from '../common/playerColors';
import { OVERLAY_STATE_KEYS, writeOverlayState } from '../common/overlay-state';
import { getInitialGameState, getPlayerColors, startGameSession } from '../common/tauri-game';
import { getAppVersion, getInitialAppVersion } from '../common/appVersion';
import { ISettings } from '../common/ISettings';
import { bridge } from './bridge';
import theme from './theme';
import './css/index.css';
import './language/i18n';
import 'source-code-pro/source-code-pro.css';
import 'typeface-varela/index.css';

const Voice = lazy(() => import('./Voice'));
const Settings = lazy(() => import('./settings/Settings'));

function sleep(milliseconds: number) {
	return new Promise((resolve) => {
		window.setTimeout(resolve, milliseconds);
	});
}

function hasResolvedGameState(nextState: AmongUsState | null | undefined): nextState is AmongUsState {
	return Boolean(nextState) && nextState.gameState !== GameState.UNKNOWN;
}

const EMPTY_GAME_STATE: AmongUsState = {
	gameState: GameState.UNKNOWN,
	oldGameState: GameState.UNKNOWN,
	lobbyCodeInt: -1,
	lobbyCode: 'MENU',
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
	currentServer: '',
	maxPlayers: 0,
	mod: 'NONE',
	oldMeetingHud: false,
};

declare module '@mui/styles/defaultTheme' {
	interface DefaultTheme extends Theme {}
}

const useStyles = makeStyles(() => ({
	root: {
		position: 'absolute',
		width: '100vw',
		height: theme.spacing(3),
		backgroundColor: '#1d1a23',
		top: 0,
		WebkitAppRegion: 'drag',
		zIndex: 100,
	},
	title: {
		width: '100%',
		textAlign: 'center',
		display: 'block',
		height: theme.spacing(3),
		lineHeight: theme.spacing(3),
		color: theme.palette.primary.main,
	},
	button: {
		WebkitAppRegion: 'no-drag',
		marginLeft: 'auto',
		padding: 0,
		position: 'absolute',
		top: 0,
	},
}));

interface TitleBarProps {
	appVersion: string;
	settingsOpen: boolean;
	setSettingsOpen: Dispatch<SetStateAction<boolean>>;
}

const RawTitleBar: React.FC<TitleBarProps> = function ({ appVersion, settingsOpen, setSettingsOpen }: TitleBarProps) {
	const classes = useStyles();
	return (
		<div className={classes.root}>
			<span className={classes.title} style={{ marginLeft: 10 }}>
				Perfect Crewlink{appVersion ? ` v${appVersion}` : ''}
			</span>
			<IconButton className={classes.button} style={{ left: 0 }} size="small" onClick={() => setSettingsOpen(!settingsOpen)}>
				<SettingsIcon htmlColor="#777" />
			</IconButton>
			<IconButton className={classes.button} style={{ left: 22 }} size="small" onClick={() => bridge.send('reload')}>
				<RefreshSharpIcon htmlColor="#777" />
			</IconButton>
			<IconButton
				className={classes.button}
				style={{ left: 44 }}
				size="small"
				title="Public lobbies"
				onClick={() => bridge.send(IpcHandlerMessages.OPEN_LOBBYBROWSER)}
			>
				<PublicIcon htmlColor="#777" fontSize="small" />
			</IconButton>
			<IconButton className={classes.button} style={{ right: 0 }} size="small" onClick={() => bridge.send('QUIT_CREWLINK')}>
				<CloseIcon htmlColor="#777" />
			</IconButton>
		</div>
	);
};

const TitleBar = React.memo(RawTitleBar);

enum AppState {
	MENU,
	VOICE,
}

function shouldRenderOverlayWindow(
	settings: ISettings,
	state: AppState,
	currentGameState: GameState | undefined,
) {
	if (!settings.enableOverlay || state !== AppState.VOICE || currentGameState === undefined) {
		return false;
	}

	const showMeetingOverlay = settings.meetingOverlay && currentGameState === GameState.DISCUSSION;
	const showAvatarOverlay =
		settings.overlayPosition !== 'hidden' &&
		(currentGameState === GameState.LOBBY ||
			currentGameState === GameState.TASKS ||
			currentGameState === GameState.DISCUSSION);

	return showMeetingOverlay || showAvatarOverlay;
}

export default function App(): JSX.Element {
	const { t } = useTranslation();
	const [state, setState] = useState<AppState>(AppState.MENU);
	const [appVersion, setAppVersion] = useState(getInitialAppVersion());
	const [gameState, setGameState] = useState<AmongUsState>(EMPTY_GAME_STATE);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [diaOpen, setDiaOpen] = useState(true);
	const [error, setError] = useState('');
	const [updaterState, setUpdaterState] = useState<AutoUpdaterState>({ state: 'unavailable' });
	const [playerColors, setPlayerColorsState] = useState<string[][]>(DEFAULT_PLAYERCOLORS);
	const playerColorsRef = useRef(playerColors);
	const playerColorSyncInFlight = useRef(false);
	const syncInFlight = useRef(false);
	const mainWindowShown = useRef(false);
	const gameOpenRef = useRef(false);
	const [settings, setSettings] = useState(SettingsStore.store);
	const [hostLobbySettings, setHostLobbySettings] = useState(settings.localLobbySettings);
	const settingsRef = useRef(settings);
	const gameStateRef = useRef(gameState);

	const sendOverlayBootstrap = () => {
		writeOverlayState(OVERLAY_STATE_KEYS.playerColors, playerColorsRef.current);
		writeOverlayState(OVERLAY_STATE_KEYS.settings, settingsRef.current);
		writeOverlayState(OVERLAY_STATE_KEYS.gameState, gameStateRef.current);
		bridge.send(IpcMessages.SEND_TO_OVERLAY, IpcOverlayMessages.NOTIFY_PLAYERCOLORS_CHANGED, playerColorsRef.current);
		bridge.send(IpcMessages.SEND_TO_OVERLAY, IpcOverlayMessages.NOTIFY_SETTINGS_CHANGED, settingsRef.current);
		bridge.send(IpcMessages.SEND_TO_OVERLAY, IpcOverlayMessages.NOTIFY_GAME_STATE_CHANGED, gameStateRef.current);
	};

	useEffect(() => {
		let isMounted = true;
		void getAppVersion().then((version) => {
			if (isMounted) {
				setAppVersion(version);
			}
		});

		return () => {
			isMounted = false;
		};
	}, []);

	useEffect(() => {
		if (mainWindowShown.current) {
			return;
		}

		mainWindowShown.current = true;
		window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => {
				bridge.send('showWindow', 'main');
			});
		});
	}, []);

	useEffect(() => {
		return SettingsStore.onDidAnyChange((newValue) => {
			setSettings(newValue as ISettings);
		});
	}, []);

	useEffect(() => {
		settingsRef.current = settings;
	}, [settings]);

	useEffect(() => {
		playerColorsRef.current = playerColors;
	}, [playerColors]);

	useEffect(() => {
		gameStateRef.current = gameState;
	}, [gameState]);

	const ensurePlayerColors = async (candidateState?: AmongUsState | null) => {
		const stateToCheck = candidateState ?? gameStateRef.current;
		const maxColorId = Math.max(
			-1,
			...(stateToCheck?.players ?? [])
				.map((player) => player.colorId)
				.filter((colorId) => colorId >= 0)
		);

		if (maxColorId < 0 || maxColorId < playerColorsRef.current.length || playerColorSyncInFlight.current) {
			return;
		}

		playerColorSyncInFlight.current = true;
		try {
			const colors = await getPlayerColors();
			if (colors?.length) {
				playerColorsRef.current = colors;
				setPlayerColorsState(colors);
				writeOverlayState(OVERLAY_STATE_KEYS.playerColors, colors);
				bridge.send(IpcMessages.SEND_TO_OVERLAY, IpcOverlayMessages.NOTIFY_PLAYERCOLORS_CHANGED, colors);
			}
		} finally {
			playerColorSyncInFlight.current = false;
		}
	};

	useEffect(() => {
		let shouldInit = true;

		const syncGameSessionState = async () => {
			if (!shouldInit || syncInFlight.current) {
				return;
			}

			syncInFlight.current = true;

			try {
				const session = await startGameSession();
				if (!shouldInit) {
					return;
				}

				if (!session.isGameOpen) {
					gameOpenRef.current = false;
					bridge.send('hideWindow', true);
					setState(AppState.MENU);
					setGameState(EMPTY_GAME_STATE);
					setError('');
					return;
				}

				let nextState = session.state ?? (await getInitialGameState());
				for (let attempt = 0; attempt < 20 && !hasResolvedGameState(nextState) && shouldInit; attempt += 1) {
					await sleep(250);
					nextState = await getInitialGameState();
				}

				if (!shouldInit) {
					return;
				}

				if (hasResolvedGameState(nextState)) {
					gameOpenRef.current = true;
					setState(AppState.VOICE);
					setGameState(nextState);
					void ensurePlayerColors(nextState);
					setError('');
				}
			} catch (sessionError) {
				if (!shouldInit) {
					return;
				}

				setError(sessionError instanceof Error ? sessionError.message : String(sessionError));
			} finally {
				syncInFlight.current = false;
			}
		};

		const onOpen = (_: unknown, isOpen: boolean) => {
			gameOpenRef.current = isOpen;
			if (!isOpen) {
				bridge.send('hideWindow', true);
				setState(AppState.MENU);
				setGameState(EMPTY_GAME_STATE);
				setError('');
				return;
			}

			void syncGameSessionState();
		};
		const onState = (_: unknown, newState: AmongUsState) => {
			if (!gameOpenRef.current) {
				return;
			}
			setState(AppState.VOICE);
			setGameState(newState);
			void ensurePlayerColors(newState);
			setError('');
		};
		const onError = (_: unknown, nextError: string) => {
			setError(nextError);
		};
		const onAutoUpdaterStateChange = (_: unknown, nextState: AutoUpdaterState) => {
			setUpdaterState((old) => ({ ...old, ...nextState }));
		};
		const onColorsChange = (_: unknown, colors: string[][]) => {
			playerColorsRef.current = colors;
			setPlayerColorsState(colors);
			writeOverlayState(OVERLAY_STATE_KEYS.playerColors, colors);
			bridge.send(IpcMessages.SEND_TO_OVERLAY, IpcOverlayMessages.NOTIFY_PLAYERCOLORS_CHANGED, colors);
		};
		const onOverlayInit = () => {
			sendOverlayBootstrap();
		};

		bridge.on(IpcRendererMessages.AUTO_UPDATER_STATE, onAutoUpdaterStateChange);
		bridge.on(IpcRendererMessages.NOTIFY_GAME_OPENED, onOpen);
		bridge.on(IpcRendererMessages.NOTIFY_GAME_STATE_CHANGED, onState);
		bridge.on(IpcRendererMessages.ERROR, onError);
		bridge.on(IpcOverlayMessages.NOTIFY_PLAYERCOLORS_CHANGED, onColorsChange);
		bridge.on(IpcOverlayMessages.REQUEST_INITVALUES, onOverlayInit);

		bridge.send(IpcHandlerMessages.RESET_KEYHOOKS);
		void syncGameSessionState();
		const sessionPoll = window.setInterval(() => {
			void syncGameSessionState();
		}, 1000);

		return () => {
			shouldInit = false;
			window.clearInterval(sessionPoll);
			bridge.off(IpcRendererMessages.AUTO_UPDATER_STATE, onAutoUpdaterStateChange);
			bridge.off(IpcRendererMessages.NOTIFY_GAME_OPENED, onOpen);
			bridge.off(IpcRendererMessages.NOTIFY_GAME_STATE_CHANGED, onState);
			bridge.off(IpcRendererMessages.ERROR, onError);
			bridge.off(IpcOverlayMessages.NOTIFY_PLAYERCOLORS_CHANGED, onColorsChange);
			bridge.off(IpcOverlayMessages.REQUEST_INITVALUES, onOverlayInit);
		};
	}, []);

	useEffect(() => {
		gameStateRef.current = gameState;
		writeOverlayState(OVERLAY_STATE_KEYS.gameState, gameState);
		bridge.send(IpcMessages.SEND_TO_OVERLAY, IpcOverlayMessages.NOTIFY_GAME_STATE_CHANGED, gameState);
	}, [gameState]);

	useEffect(() => {
		settingsRef.current = settings;
		writeOverlayState(OVERLAY_STATE_KEYS.playerColors, playerColorsRef.current);
		writeOverlayState(OVERLAY_STATE_KEYS.settings, settings);
		bridge.send(IpcMessages.SEND_TO_OVERLAY, IpcOverlayMessages.NOTIFY_PLAYERCOLORS_CHANGED, playerColorsRef.current);
		bridge.send(IpcMessages.SEND_TO_OVERLAY, IpcOverlayMessages.NOTIFY_SETTINGS_CHANGED, settings);
	}, [settings]);

	useEffect(() => {
		const currentGameState = gameState?.gameState;
		const shouldShowOverlay = shouldRenderOverlayWindow(settings, state, currentGameState);
		bridge.send('enableOverlay', shouldShowOverlay);
	}, [gameState?.gameState, settings, state]);

	const page =
		state === AppState.VOICE ? (
			<Suspense fallback={null}>
				<Voice t={t} error={error} />
			</Suspense>
		) : (
			<Menu t={t} error={error} />
		);

	return (
		<PlayerColorContext.Provider value={playerColors}>
			<GameStateContext.Provider value={gameState}>
				<HostSettingsContext.Provider value={[hostLobbySettings, setHostLobbySettings]}>
					<SettingsContext.Provider value={[settings, setSetting, setLobbySetting]}>
						<StyledEngineProvider injectFirst>
							<ThemeProvider theme={theme}>
								<LegacyThemeProvider theme={theme}>
									<TitleBar appVersion={appVersion} settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} />
									{settingsOpen ? (
										<Suspense fallback={null}>
											<Settings t={t} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
										</Suspense>
									) : null}
									<Dialog fullWidth open={updaterState.state !== 'unavailable' && diaOpen}>
										{updaterState.state === 'available' && updaterState.info && (
											<DialogTitle>Update v{updaterState.info.version}</DialogTitle>
										)}
										{updaterState.state === 'error' && <DialogTitle>Updater Error</DialogTitle>}
										{updaterState.state === 'downloading' && <DialogTitle>Updating...</DialogTitle>}
										<DialogContent>
											{updaterState.state === 'downloading' && updaterState.progress && (
												<>
													<LinearProgress variant="determinate" value={updaterState.progress.percent} />
													<DialogContentText>
														{prettyBytes(updaterState.progress.transferred)} / {prettyBytes(updaterState.progress.total)}
													</DialogContentText>
												</>
											)}
											{updaterState.state === 'available' && (
												<>
													<LinearProgress variant="indeterminate" />
													<DialogContentText>Update now or later?</DialogContentText>
												</>
											)}
											{updaterState.state === 'error' && (
												<DialogContentText color="error">{String(updaterState.error)}</DialogContentText>
											)}
										</DialogContent>
										{updaterState.state === 'error' && (
											<DialogActions>
												<Button color="grey" onClick={() => bridge.openExternal('https://github.com/artriy/Perfect-Crewlink/releases/latest')}>
													Download Manually
												</Button>
												<Button color="grey" onClick={() => setDiaOpen(false)}>
													Skip
												</Button>
											</DialogActions>
										)}
										{updaterState.state === 'available' && (
											<DialogActions>
												<Button onClick={() => bridge.send('update-app')}>Now</Button>
												<Button onClick={() => setDiaOpen(false)}>Later</Button>
											</DialogActions>
										)}
									</Dialog>
									{page}
								</LegacyThemeProvider>
							</ThemeProvider>
						</StyledEngineProvider>
					</SettingsContext.Provider>
				</HostSettingsContext.Provider>
			</GameStateContext.Provider>
		</PlayerColorContext.Provider>
	);
}

ReactDOM.render(<App />, document.getElementById('app'));

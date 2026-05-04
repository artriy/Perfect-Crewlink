import React, { useCallback, useEffect, useRef, useState } from 'react';
import withStyles from '@mui/styles/withStyles';
import makeStyles from '@mui/styles/makeStyles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { bridge } from '../bridge';
import { IpcHandlerMessages, IpcMessages } from '../../common/ipc-messages';
import io, { Socket } from 'socket.io-client';
import i18next from 'i18next';
import { IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import languages from '../language/languages';
import { PublicLobbyMap, PublicLobby } from '../../common/PublicLobby';
import { modList, ModsType } from '../../common/Mods';
import { GameState } from '../../common/AmongUsState';
import { getRegionAliases } from '../../common/tauri-game';
import { resolveRegionLabel } from '../../common/regions';
import SettingsStore from '../settings/SettingsStore';
import { playLobbyNotificationSound } from '../lobbyNotificationSound';

const serverUrl = SettingsStore.get('serverURL', 'https://bettercrewl.ink/');
const language = SettingsStore.get('language', 'en');
const SETTINGS_STORAGE_KEY = 'perfectcrewlink.settings';
const LOBBY_CODE_RETRY_DELAY_MS = 2500;
i18next.changeLanguage(language);

const StyledTableCell = withStyles((theme) => ({
	head: {
		backgroundColor: '#1d1a23',
		color: theme.palette.common.white,
	},
	body: {
		fontSize: 14,
	},
}))(TableCell);

const StyledTableRow = withStyles(() => ({
	root: {
		'&:nth-of-type(odd)': {
			backgroundColor: '#25232a',
		},
		'&:nth-of-type(even)': {
			backgroundColor: '#1d1a23',
		},
	},
}))(TableRow);

const useStyles = makeStyles({
	table: {
		minWidth: 700,
	},
	container: {
		maxHeight: '400px',
	},
	codeCell: {
		display: 'flex',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: '8px',
		minWidth: '185px',
	},
	codeContent: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'flex-start',
		gap: '4px',
	},
	codeText: {
		fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace',
		fontSize: '18px',
		fontWeight: 700,
		letterSpacing: '0.08em',
		lineHeight: 1,
	},
	codeTextLobby: {
		color: '#ff496c',
	},
	codeTextInGame: {
		color: '#8a8592',
	},
	codeRegion: {
		fontSize: '11px',
		color: '#8a8592',
		textTransform: 'uppercase',
		letterSpacing: '0.08em',
	},
	codeButtons: {
		display: 'flex',
		alignItems: 'flex-start',
		gap: '2px',
	},
	copyButton: {
		padding: '4px',
		marginTop: '-2px',
	},
});

function sortLobbies(a: PublicLobby, b: PublicLobby) {
	if (a.gameState === GameState.LOBBY && b.gameState !== GameState.LOBBY) {
		return -1;
	} else if (b.gameState === GameState.LOBBY && a.gameState !== GameState.LOBBY) {
		return 1;
	} else {
		if (b.current_players === b.max_players && a.current_players !== a.max_players) {
			return -1;
		}
		if (a.current_players < b.current_players) {
			return 1;
		} else if (a.current_players > b.current_players) {
			return -1;
		}
		return 0;
	}
}

function getModName(mod: string): string {
	return modList.find((o) => o.id === mod)?.label || (mod ?? 'None')
}

function getServerLabel(server: string, regionAliases: Record<string, string>): string {
	return resolveRegionLabel(server, regionAliases);
}

type LobbyNotificationPermission = NotificationPermission | 'unsupported';

function getNotificationPermission(): LobbyNotificationPermission {
	if (typeof window === 'undefined' || !('Notification' in window)) {
		return 'unsupported';
	}
	return Notification.permission;
}

function getStoredStringSetting(key: string, fallback: string): string {
	try {
		const storedSettings = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}') as Record<string, unknown>;
		const value = storedSettings[key];
		return typeof value === 'string' ? value : fallback;
	} catch {
		return fallback;
	}
}

function isBaseLobbyJoinable(lobby: PublicLobby): boolean {
	return lobby.gameState === GameState.LOBBY && lobby.current_players < lobby.max_players;
}

function getLobbyNotificationBody(lobby: PublicLobby, preview?: LobbyCodePreview): string {
	const parts = [
		`${lobby.title} is in the lobby`,
		`${lobby.current_players}/${lobby.max_players} players`,
	];
	if (preview?.code) {
		parts.push(`Code: ${preview.code}`);
	}
	return parts.join(' - ');
}

function normalizeLobbyCode(value: string | null | undefined): string | null {
	const trimmed = (value ?? '').trim().toUpperCase();
	return /^[A-Z]{4,6}$/.test(trimmed) ? trimmed : null;
}

interface LobbyCodePreview {
	code: string | null;
	region: string;
	available: boolean;
	reason?: 'blocked_incompatible' | 'incompatible' | 'retrying' | 'unavailable';
}

interface LobbyBrowserProps {
	t: (key: string) => string;
}

export default function LobbyBrowser({ t }: LobbyBrowserProps) {
	const classes = useStyles();
	const [publiclobbies, setPublicLobbies] = useState<PublicLobbyMap>({});
	const [socket, setSocket] = useState<Socket | null>(null);
	const [lobbyCodes, setLobbyCodes] = useState<Record<number, LobbyCodePreview>>({});
	const [copiedLobbyId, setCopiedLobbyId] = useState<number | null>(null);
	const [watchedLobbyIds, setWatchedLobbyIds] = useState<Record<number, boolean>>({});
	const [notificationPermission, setNotificationPermission] = useState<LobbyNotificationPermission>(getNotificationPermission);
	const [showLobbyCode, setShowLobbyCode] = useState(() => !SettingsStore.get('hideCode', false));
	const [ignoreIncompatibleMods, setIgnoreIncompatibleMods] = useState(() =>
		SettingsStore.get('ignoreIncompatibleLobbyBrowserMods', true)
	);
	const [regionAliases, setRegionAliases] = useState<Record<string, string>>({});
	const [, forceRender] = useState({});
	const pendingCodeRequests = useRef<Set<number>>(new Set());
	const retryTimeouts = useRef<Record<number, number>>({});
	const notifiedLobbyIds = useRef<Set<number>>(new Set());

	const [mod, setMod] = useState<ModsType>('NONE');
	const languageNames = languages as Record<string, { name?: string }>;
	
	useEffect(() => {
		const syncBrowserSettings = () => {
			setIgnoreIncompatibleMods(SettingsStore.get('ignoreIncompatibleLobbyBrowserMods', true));
			setShowLobbyCode(!SettingsStore.get('hideCode', false));
		};

		syncBrowserSettings();
		const handleStorage = (event: StorageEvent) => {
			if (!event.key || event.key === SETTINGS_STORAGE_KEY) {
				syncBrowserSettings();
			}
		};

		window.addEventListener('storage', handleStorage);

		bridge.invoke(IpcMessages.REQUEST_MOD).then((mod: ModsType) => setMod(mod));
		void getRegionAliases()
			.then((aliases) => setRegionAliases(aliases))
			.catch(() => {
				/* empty */
			});

		const s = io(serverUrl, {
			transports: ['websocket'],
		});
		setSocket(s);

		s.on('update_lobby', (lobby: PublicLobby) => {
			setPublicLobbies((old) => ({ ...old, [lobby.id]: lobby }));
			setLobbyCodes((old) => {
				const existingPreview = old[lobby.id];
				if (!existingPreview || existingPreview.available || existingPreview.reason === 'blocked_incompatible') {
					return old;
				}
				const next = { ...old };
				delete next[lobby.id];
				return next;
			});
		});

		s.on('new_lobbies', (lobbies: PublicLobby[]) => {
			setPublicLobbies((old) => {
				const lobbyMap: PublicLobbyMap = { ...old };
				for (const index in lobbies) {
					lobbyMap[lobbies[index].id] = lobbies[index];
				}
				return lobbyMap;
			});
			setLobbyCodes((old) => {
				let changed = false;
				const next = { ...old };
				for (const lobby of lobbies) {
					const existingPreview = next[lobby.id];
					if (!existingPreview || existingPreview.available || existingPreview.reason === 'blocked_incompatible') {
						continue;
					}
					delete next[lobby.id];
					changed = true;
				}
				return changed ? next : old;
			});
		});
		s.on('remove_lobby', (lobbyId: number) => {
			setPublicLobbies((old) => {
				delete old[lobbyId];
				return { ...old };
			});
			setLobbyCodes((old) => {
				if (!(lobbyId in old)) {
					return old;
				}
				const next = { ...old };
				delete next[lobbyId];
				return next;
			});
			setWatchedLobbyIds((old) => {
				if (!(lobbyId in old)) {
					return old;
				}
				const next = { ...old };
				delete next[lobbyId];
				return next;
			});
			notifiedLobbyIds.current.delete(lobbyId);
			pendingCodeRequests.current.delete(lobbyId);
			window.clearTimeout(retryTimeouts.current[lobbyId]);
			delete retryTimeouts.current[lobbyId];
		});
		s.on('connect', () => {
			s.emit('lobbybrowser', true);
		});

		const secondPassed = setInterval(() => {
			forceRender({});
		}, 1000);
		return () => {
			s.emit('lobbybrowser', false);
			s.close();
			clearInterval(secondPassed);
			pendingCodeRequests.current.clear();
			for (const timeoutId of Object.values(retryTimeouts.current)) {
				window.clearTimeout(timeoutId);
			}
			retryTimeouts.current = {};
			window.removeEventListener('storage', handleStorage);
		};
	}, []);

	useEffect(() => {
		if (showLobbyCode) {
			return;
		}

		pendingCodeRequests.current.clear();
		for (const timeoutId of Object.values(retryTimeouts.current)) {
			window.clearTimeout(timeoutId);
		}
		retryTimeouts.current = {};
		setCopiedLobbyId(null);
		setLobbyCodes({});
	}, [showLobbyCode]);

	useEffect(() => {
		setLobbyCodes((old) => {
			let changed = false;
			const next = { ...old };

			for (const lobby of Object.values(publiclobbies)) {
				const isIncompatibleLobby = lobby.mods !== mod;
				const existingPreview = next[lobby.id];

				if (!ignoreIncompatibleMods && isIncompatibleLobby) {
					pendingCodeRequests.current.delete(lobby.id);
					if (existingPreview?.reason !== 'blocked_incompatible') {
						next[lobby.id] = {
							code: null,
							region: getServerLabel(lobby.server, regionAliases),
							available: false,
							reason: 'blocked_incompatible',
						};
						changed = true;
					}
					continue;
				}

				if (existingPreview?.reason === 'blocked_incompatible') {
					delete next[lobby.id];
					changed = true;
				}
			}

			return changed ? next : old;
		});
	}, [ignoreIncompatibleMods, mod, publiclobbies, regionAliases]);

	useEffect(() => {
		if (!socket || !showLobbyCode) {
			return;
		}

		for (const lobby of Object.values(publiclobbies)) {
			if (!ignoreIncompatibleMods && lobby.mods !== mod) {
				continue;
			}

			if (lobbyCodes[lobby.id] || pendingCodeRequests.current.has(lobby.id)) {
				continue;
			}

			pendingCodeRequests.current.add(lobby.id);
			socket.emit('join_lobby', lobby.id, (state: number, codeOrError: string, server: string) => {
				pendingCodeRequests.current.delete(lobby.id);
				const normalizedError = (codeOrError ?? '').toLowerCase();
				const isIncompatibleResponse = normalizedError.includes('incompatible');
				const isStaleListingResponse =
					normalizedError.includes('not public anymore') ||
					normalizedError.includes('not public') ||
					normalizedError.includes('not found') ||
					normalizedError.includes('does not exist');
				const returnedCode = normalizeLobbyCode(codeOrError);
				window.clearTimeout(retryTimeouts.current[lobby.id]);
				delete retryTimeouts.current[lobby.id];

				if (state !== 0 && ignoreIncompatibleMods && isIncompatibleResponse) {
					setLobbyCodes((old) => ({
						...old,
						[lobby.id]: {
							code: null,
							region: getServerLabel(String(server || lobby.server), regionAliases),
							available: false,
							reason: 'retrying',
						},
					}));
					retryTimeouts.current[lobby.id] = window.setTimeout(() => {
						setLobbyCodes((old) => {
							if (old[lobby.id]?.reason !== 'retrying') {
								return old;
							}
							const next = { ...old };
							delete next[lobby.id];
							return next;
						});
						delete retryTimeouts.current[lobby.id];
					}, LOBBY_CODE_RETRY_DELAY_MS);
					return;
				}

				if (state !== 0 && !returnedCode) {
					setLobbyCodes((old) => ({
						...old,
						[lobby.id]: {
							code: null,
							region: getServerLabel(String(server || lobby.server), regionAliases),
							available: false,
							reason: isIncompatibleResponse || isStaleListingResponse ? 'retrying' : 'unavailable',
						},
					}));
					retryTimeouts.current[lobby.id] = window.setTimeout(() => {
						setLobbyCodes((old) => {
							const existingPreview = old[lobby.id];
							if (!existingPreview || existingPreview.available || existingPreview.reason === 'blocked_incompatible') {
								return old;
							}
							const next = { ...old };
							delete next[lobby.id];
							return next;
						});
						delete retryTimeouts.current[lobby.id];
					}, LOBBY_CODE_RETRY_DELAY_MS);
					return;
				}

				setLobbyCodes((old) => {
					const existingPreview = old[lobby.id];
					const code = state === 0 ? returnedCode : returnedCode ?? existingPreview?.code ?? null;
					const reason = !code && state !== 0 ? (isIncompatibleResponse ? 'incompatible' : 'unavailable') : undefined;

					return {
						...old,
						[lobby.id]: {
							code,
							region: getServerLabel(String(server || lobby.server), regionAliases),
							available: Boolean(code),
							reason,
						},
					};
				});
			});
		}
	}, [ignoreIncompatibleMods, lobbyCodes, mod, publiclobbies, regionAliases, showLobbyCode, socket]);

	useEffect(() => {
		if (copiedLobbyId === null) {
			return;
		}

		const timeout = window.setTimeout(() => {
			setCopiedLobbyId(null);
		}, 1500);

		return () => window.clearTimeout(timeout);
	}, [copiedLobbyId]);

	const isLobbyJoinableForCurrentSettings = useCallback(
		(lobby: PublicLobby, preview?: LobbyCodePreview): boolean => {
			if (!ignoreIncompatibleMods && lobby.mods !== mod) {
				return false;
			}
			if (!isBaseLobbyJoinable(lobby)) {
				return false;
			}
			return !showLobbyCode || Boolean(preview?.available && preview.code);
		},
		[ignoreIncompatibleMods, mod, showLobbyCode]
	);

	const sendLobbyJoinableNotification = useCallback(
		(lobby: PublicLobby, preview?: LobbyCodePreview, permission: LobbyNotificationPermission = notificationPermission) => {
			if (permission === 'granted' && typeof Notification !== 'undefined') {
				try {
					const notification = new Notification('Lobby joinable', {
						body: getLobbyNotificationBody(lobby, preview),
					});
					notification.onclick = () => bridge.send(IpcHandlerMessages.OPEN_LOBBYBROWSER);
				} catch {
					/* empty */
				}
			}

			const soundPath = getStoredStringSetting('lobbyNotificationSoundPath', '');
			const speaker = getStoredStringSetting('speaker', 'Default');
			void playLobbyNotificationSound(soundPath, speaker).catch((error) => {
				console.error('Failed to play lobby notification sound', error);
			});

			bridge.send(IpcMessages.REQUEST_USER_ATTENTION, 'lobbies');
		},
		[notificationPermission]
	);

	useEffect(() => {
		const readyLobbyIds: number[] = [];
		for (const lobbyIdText of Object.keys(watchedLobbyIds)) {
			const lobbyId = Number(lobbyIdText);
			const lobby = publiclobbies[lobbyId];
			const preview = lobbyCodes[lobbyId];
			if (
				!lobby ||
				notifiedLobbyIds.current.has(lobbyId) ||
				!isLobbyJoinableForCurrentSettings(lobby, preview)
			) {
				continue;
			}

			notifiedLobbyIds.current.add(lobbyId);
			readyLobbyIds.push(lobbyId);
			sendLobbyJoinableNotification(lobby, preview);
		}

		if (readyLobbyIds.length === 0) {
			return;
		}

		setWatchedLobbyIds((old) => {
			const next = { ...old };
			let changed = false;
			for (const lobbyId of readyLobbyIds) {
				if (lobbyId in next) {
					delete next[lobbyId];
					changed = true;
				}
			}
			return changed ? next : old;
		});
	}, [isLobbyJoinableForCurrentSettings, lobbyCodes, publiclobbies, sendLobbyJoinableNotification, watchedLobbyIds]);

	async function requestLobbyNotificationPermission(): Promise<LobbyNotificationPermission> {
		const currentPermission = getNotificationPermission();
		if (currentPermission !== 'default') {
			setNotificationPermission(currentPermission);
			return currentPermission;
		}

		try {
			const requestedPermission = await Notification.requestPermission();
			setNotificationPermission(requestedPermission);
			return requestedPermission;
		} catch {
			setNotificationPermission('unsupported');
			return 'unsupported';
		}
	}

	async function toggleLobbyNotification(lobby: PublicLobby, preview?: LobbyCodePreview) {
		if (watchedLobbyIds[lobby.id]) {
			setWatchedLobbyIds((old) => {
				const next = { ...old };
				delete next[lobby.id];
				return next;
			});
			notifiedLobbyIds.current.delete(lobby.id);
			return;
		}

		const permission = await requestLobbyNotificationPermission();
		if (isLobbyJoinableForCurrentSettings(lobby, preview)) {
			notifiedLobbyIds.current.add(lobby.id);
			sendLobbyJoinableNotification(lobby, preview, permission);
			return;
		}

		notifiedLobbyIds.current.delete(lobby.id);
		setWatchedLobbyIds((old) => ({ ...old, [lobby.id]: true }));
	}

	function getNotifyTooltip(isWatched: boolean, isJoinable: boolean): string {
		if (isWatched) {
			return 'Cancel joinable notification';
		}
		if (notificationPermission === 'denied') {
			return 'Notify when joinable (notifications blocked; window will flash)';
		}
		if (notificationPermission === 'unsupported') {
			return 'Notify when joinable (window will flash)';
		}
		return isJoinable ? 'Lobby joinable now' : 'Notify when joinable';
	}

	async function copyLobbyCode(code: string, lobbyId: number) {
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(code);
			} else {
				const input = document.createElement('textarea');
				input.value = code;
				input.style.position = 'fixed';
				input.style.opacity = '0';
				document.body.appendChild(input);
				input.focus();
				input.select();
				document.execCommand('copy');
				document.body.removeChild(input);
			}
			setCopiedLobbyId(lobbyId);
		} catch (error) {
			console.error('Failed to copy lobby code', error);
		}
	}

	return (
		<div style={{ minHeight: '100vh', width: '100%', paddingTop: '15px', backgroundColor: '#25232a', boxSizing: 'border-box' }}>
			<div style={{ minHeight: '500px', padding: '20px', backgroundColor: '#25232a', boxSizing: 'border-box' }}>
				<b>{t('lobbybrowser.header')}</b>
				<Paper style={{ backgroundColor: '#1d1a23' }}>
					<TableContainer component={Paper} className={classes.container} style={{ backgroundColor: '#1d1a23' }}>
						<Table className={classes.table} aria-label="customized table" stickyHeader>
							<TableHead>
								<TableRow>
									<StyledTableCell>{t('lobbybrowser.list.title')}</StyledTableCell>
									<StyledTableCell align="left">{t('lobbybrowser.list.host')}</StyledTableCell>
									<StyledTableCell align="left">{t('lobbybrowser.list.players')}</StyledTableCell>
									<StyledTableCell align="left">{t('lobbybrowser.list.mods')}</StyledTableCell>
									<StyledTableCell align="left">{t('lobbybrowser.list.language')}</StyledTableCell>
									<StyledTableCell align="left">Status</StyledTableCell>
									<StyledTableCell align="left">{t('lobbybrowser.code')}</StyledTableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{Object.values(publiclobbies)
									.sort(sortLobbies)
									.map((row: PublicLobby) => {
										const lobbyCodePreview = lobbyCodes[row.id];
										const lobbyCode = lobbyCodePreview?.code;
										const isLobbyCodeAvailable = showLobbyCode && (lobbyCodePreview?.available ?? false);
										const lobbyCodeLabel =
											!showLobbyCode
												? 'HIDDEN'
												: lobbyCode ??
													(lobbyCodePreview?.reason === 'retrying'
														? '...'
														: lobbyCodePreview?.reason?.includes('incompatible')
															? 'INCOMPATIBLE'
															: lobbyCodePreview
																? 'UNAVAILABLE'
																: '...');

										const isNotificationWatched = Boolean(watchedLobbyIds[row.id]);
										const isLobbyJoinable = isLobbyJoinableForCurrentSettings(row, lobbyCodePreview);

										return (
										<StyledTableRow key={row.id}>
											<StyledTableCell component="th" scope="row">
												{row.title}
											</StyledTableCell>
											<StyledTableCell align="left">{row.host}</StyledTableCell>
											<StyledTableCell align="left">
												{row.current_players}/{row.max_players}
											</StyledTableCell>
											<StyledTableCell align="left">
												{getModName(row.mods)}
											</StyledTableCell>
											<StyledTableCell align="left">
												{languageNames[row.language]?.name ?? 'English'}
											</StyledTableCell>
											<StyledTableCell align="left">
												{row.gameState === GameState.LOBBY ? 'Lobby' : 'In game'}{' '}
												{row.stateTime && new Date(Date.now() - row.stateTime).toISOString().substr(14, 5)}
											</StyledTableCell>
											<StyledTableCell align="left">
												<div className={classes.codeCell}>
													<div className={classes.codeContent}>
														<span
															className={[
																classes.codeText,
																row.gameState === GameState.LOBBY ? classes.codeTextLobby : classes.codeTextInGame,
															].join(' ')}
														>
															{lobbyCodeLabel}
														</span>
														<span className={classes.codeRegion}>
															{lobbyCodePreview?.region ?? getServerLabel(row.server, regionAliases)}
														</span>
													</div>
													<div className={classes.codeButtons}>
														<Tooltip
															title={
																!showLobbyCode
																	? 'Lobby code hidden'
																	: copiedLobbyId === row.id
																		? 'Copied'
																		: 'Copy code'
															}
														>
															<span>
																<IconButton
																	className={classes.copyButton}
																	size="small"
																	disabled={!isLobbyCodeAvailable || !lobbyCode}
																	onClick={() => {
																		if (lobbyCode) {
																			void copyLobbyCode(lobbyCode, row.id);
																		}
																	}}
																>
																	{copiedLobbyId === row.id ? (
																		<CheckIcon htmlColor="#8fd694" fontSize="small" />
																	) : (
																		<ContentCopyIcon htmlColor="#b7b1c0" fontSize="small" />
																	)}
																</IconButton>
															</span>
														</Tooltip>
														<Tooltip title={getNotifyTooltip(isNotificationWatched, isLobbyJoinable)}>
															<span>
																<IconButton
																	className={classes.copyButton}
																	size="small"
																	onClick={() => void toggleLobbyNotification(row, lobbyCodePreview)}
																>
																	{isNotificationWatched ? (
																		<NotificationsActiveIcon htmlColor="#ffcc66" fontSize="small" />
																	) : (
																		<NotificationsNoneIcon htmlColor={isLobbyJoinable ? "#8fd694" : "#b7b1c0"} fontSize="small" />
																	)}
																</IconButton>
															</span>
														</Tooltip>
													</div>
												</div>
											</StyledTableCell>
										</StyledTableRow>
										);
									})}
							</TableBody>
						</Table>
					</TableContainer>
				</Paper>
			</div>
		</div>
	);
}

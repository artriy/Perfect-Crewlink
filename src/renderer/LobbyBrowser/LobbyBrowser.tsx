import React, { useEffect, useRef, useState } from 'react';
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
import { IpcMessages } from '../../common/ipc-messages';
import io, { Socket } from 'socket.io-client';
import i18next from 'i18next';
import { IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import languages from '../language/languages';
import { PublicLobbyMap, PublicLobby } from '../../common/PublicLobby';
import { modList, ModsType } from '../../common/Mods';
import { GameState } from '../../common/AmongUsState';
import SettingsStore from '../settings/SettingsStore';

const serverUrl = SettingsStore.get('serverURL', 'https://bettercrewl.ink/');
const language = SettingsStore.get('language', 'en');
const SETTINGS_STORAGE_KEY = 'perfectcrewlink.settings';
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
		fontFamily: '"Source Code Pro", monospace',
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
	copyButton: {
		padding: '4px',
		marginTop: '-2px',
	},
});

const servers: {
	[server: string]: string;
} = {
	// '50.116.1.42': 'North America',
	// '172.105.251.170': 'Europe',
	// '139.162.111.196': 'Asia',
	'192.241.154.115': 'skeld.net',
	'154.16.67.100': 'Modded (North America)',
	'78.47.142.18': 'Modded (Europe)',
};

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

function getServerLabel(server: string): string {
	if (!server) {
		return 'Unknown Region';
	}

	return servers[server] ?? server;
}

interface LobbyCodePreview {
	code: string | null;
	region: string;
	available: boolean;
	reason?: 'blocked_incompatible' | 'incompatible' | 'unavailable';
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
	const [ignoreIncompatibleMods, setIgnoreIncompatibleMods] = useState(() =>
		SettingsStore.get('ignoreIncompatibleLobbyBrowserMods', true)
	);
	const [, forceRender] = useState({});
	const pendingCodeRequests = useRef<Set<number>>(new Set());

	const [mod, setMod] = useState<ModsType>('NONE');
	const languageNames = languages as Record<string, { name?: string }>;
	
	useEffect(() => {
		const syncIgnoreIncompatibleMods = () =>
			setIgnoreIncompatibleMods(SettingsStore.get('ignoreIncompatibleLobbyBrowserMods', true));

		syncIgnoreIncompatibleMods();
		const handleStorage = (event: StorageEvent) => {
			if (!event.key || event.key === SETTINGS_STORAGE_KEY) {
				syncIgnoreIncompatibleMods();
			}
		};

		window.addEventListener('storage', handleStorage);

		bridge.invoke(IpcMessages.REQUEST_MOD).then((mod: ModsType) => setMod(mod));

		const s = io(serverUrl, {
			transports: ['websocket'],
		});
		setSocket(s);

		s.on('update_lobby', (lobby: PublicLobby) => {
			setPublicLobbies((old) => ({ ...old, [lobby.id]: lobby }));
		});

		s.on('new_lobbies', (lobbies: PublicLobby[]) => {
			setPublicLobbies((old) => {
				const lobbyMap: PublicLobbyMap = { ...old };
				for (const index in lobbies) {
					lobbyMap[lobbies[index].id] = lobbies[index];
				}
				return lobbyMap;
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
			pendingCodeRequests.current.delete(lobbyId);
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
			window.removeEventListener('storage', handleStorage);
		};
	}, []);

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
							region: getServerLabel(lobby.server),
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
	}, [ignoreIncompatibleMods, mod, publiclobbies]);

	useEffect(() => {
		if (!socket) {
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
				const normalizedError = codeOrError.toLowerCase();
				const reason =
					state === 0 ? undefined : normalizedError.includes('incompatible') ? 'incompatible' : 'unavailable';
				setLobbyCodes((old) => ({
					...old,
					[lobby.id]: {
						code: state === 0 ? codeOrError : null,
						region: getServerLabel(String(server || lobby.server)),
						available: state === 0,
						reason,
					},
				}));
			});
		}
	}, [ignoreIncompatibleMods, lobbyCodes, mod, publiclobbies, socket]);

	useEffect(() => {
		if (copiedLobbyId === null) {
			return;
		}

		const timeout = window.setTimeout(() => {
			setCopiedLobbyId(null);
		}, 1500);

		return () => window.clearTimeout(timeout);
	}, [copiedLobbyId]);

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
										const isLobbyCodeAvailable = lobbyCodePreview?.available ?? false;
										const lobbyCodeLabel =
											lobbyCode ??
											(lobbyCodePreview?.reason?.includes('incompatible') ? 'INCOMPATIBLE' : lobbyCodePreview ? 'UNAVAILABLE' : '...');

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
															{lobbyCodePreview?.region ?? getServerLabel(row.server)}
														</span>
													</div>
													<Tooltip title={copiedLobbyId === row.id ? 'Copied' : 'Copy code'}>
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

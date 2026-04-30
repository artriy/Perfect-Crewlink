import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import io, { Socket as SocketClient } from 'socket.io-client';
import Avatar from './Avatar';
import { GameStateContext, HostSettingsContext, PlayerColorContext, SettingsContext } from './contexts';
import {
	AmongUsState,
	GameState,
	Player,
	SocketClientMap,
	ClientBoolMap,
	numberStringMap,
	Client,
	ClientConnectionMap,
	ClientConnectionState,
	VoiceState,
} from '../common/AmongUsState';
import Peer from 'simple-peer';
import { bridge } from './bridge';
import VAD from './vad';
import { ISettings, playerConfigMap, ILobbySettings } from '../common/ISettings';
import { IpcRendererMessages, IpcMessages, IpcOverlayMessages, IpcHandlerMessages } from '../common/ipc-messages';
import { OVERLAY_STATE_KEYS, writeOverlayState } from '../common/overlay-state';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/GridLegacy';
import makeStyles from '@mui/styles/makeStyles';
import SupportLink from './SupportLink';
import Divider from '@mui/material/Divider';
import { validateClientPeerConfig } from './validateClientPeerConfig';
import reverbOgxUrl from '../../static/sounds/reverb.ogx?url';
import radioOnSound from '../../static/sounds/radio_on.wav';

import { CameraLocation, AmongUsMaps, MapType } from '../common/AmongusMap';
import { ObsVoiceState } from '../common/ObsOverlay';
import Footer from './Footer';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import VolumeOff from '@mui/icons-material/VolumeOff';
import VolumeUp from '@mui/icons-material/VolumeUp';
import Mic from '@mui/icons-material/Mic';
import MicOff from '@mui/icons-material/MicOff';
import adapter from 'webrtc-adapter';
import { VADOptions } from './vad';
import { pushToTalkOptions } from './settings/SettingsStore';
import { poseCollide } from '../common/ColliderMap';

console.log(adapter.browserDetails.browser);

export interface ExtendedAudioElement extends HTMLAudioElement {
	setSinkId: (sinkId: string) => Promise<void>;
}

interface PeerConnections {
	[peer: string]: Peer.Instance;
}

interface VadNode {
	connect: () => void;
	destroy: () => void;
	options: VADOptions;
	init: () => void;
}

interface AudioNodes {
	context: AudioContext;
	dummyAudioElement: HTMLAudioElement;
	audioElement: HTMLAudioElement;
	gain: GainNode;
	pan: PannerNode;
	reverb: ConvolverNode;
	muffle: BiquadFilterNode;
	destination: AudioNode;
	reverbConnected: boolean;
	muffleConnected: boolean;
}

interface AudioElements {
	[peer: string]: AudioNodes;
}

interface ClientAudioActivityState {
	level: number;
	speaking: boolean;
	audible: boolean;
	lastActivityAt: number;
}

interface PeerAudioMonitor {
	clientId: number;
	intervalId: number;
	samples: Float32Array<ArrayBuffer>;
	analyser: AnalyserNode;
	smoothedLevel: number;
	speaking: boolean;
	audible: boolean;
	lastActivityAt: number;
}

interface ConnectionStuff {
	socket?: SocketClient;
	overlaySocket?: SocketClient;
	stream?: MediaStream;
	instream?: MediaStream;

	microphoneGain?: GainNode;
	audioListener?: VadNode;
	pushToTalkMode: number;
	deafened: boolean;
	muted: boolean;
	impostorRadio: boolean | null;
	toggleMute: () => void;
	toggleDeafen: () => void;
}

interface SocketError {
	message?: string;
}

interface ClientPeerConfig {
	forceRelayOnly: boolean;
	iceServers: RTCIceServer[];
}

type BetterAudioConstraints = MediaTrackConstraints & {
	latency?: number;
	googNoiseSuppression?: boolean;
	googEchoCancellation?: boolean;
	googTypingNoiseDetection?: boolean;
};

const DEFAULT_ICE_CONFIG: RTCConfiguration = {
	iceTransportPolicy: 'all',
	iceServers: [
		{
			urls: 'stun:stun.l.google.com:19302',
		},
	],
};

const DEFAULT_ICE_CONFIG_TURN: RTCConfiguration = {
	iceTransportPolicy: 'relay',
	iceServers: [
		{
			urls: 'turn:turn.bettercrewl.ink:3478',
			username: 'M9DRVaByiujoXeuYAAAG',
			credential: 'TpHR9HQNZ8taxjb3',
		},
	],
};

const REMOTE_AUDIO_UPDATE_INTERVAL_MS = 80;
const REMOTE_AUDIO_AUDIBLE_ON = 0.02;
const REMOTE_AUDIO_AUDIBLE_OFF = 0.012;
const REMOTE_AUDIO_SPEAKING_ON = 0.045;
const REMOTE_AUDIO_SPEAKING_OFF = 0.024;
const REMOTE_AUDIO_TALKING_GRACE_MS = 750;
const AUDIO_PARAM_SMOOTHING_SECONDS = 0.04;
const AUDIO_NEAR_FIELD_DISTANCE = 0.6;
const AUDIO_DIRECTIONAL_FOCUS = 1.25;
const AUDIO_DISTANCE_ROLLOFF_FACTOR = 1.25;
const AUDIO_MUFFLE_Q = 0.8;

export interface VoiceProps {
	t: (key: string) => string;
	error: string;
}

const useStyles = makeStyles((theme) => ({
	error: {
		position: 'absolute',
		top: '50%',
		transform: 'translateY(-50%)',
	},
	root: {
		paddingTop: theme.spacing(3),
		boxSizing: 'border-box',
		minHeight: '100vh',
		backgroundColor: '#25232a',
		color: theme.palette.common.white,
	},
	top: {
		display: 'flex',
		justifyContent: 'center',
		alignItems: 'center',
	},
	right: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
	},
	username: {
		display: 'block',
		textAlign: 'center',
		fontSize: 20,
		whiteSpace: 'nowrap',
		maxWidth: '115px',
	},
	code: {
		fontFamily: "'Source Code Pro', monospace",
		display: 'block',
		width: 'fit-content',
		margin: '5px auto',
		padding: 5,
		borderRadius: 5,
		fontSize: 28,
	},
	otherplayers: {
		width: 225,
		height: 225,
		margin: '4px auto',
		'& .MuiGrid-grid-xs-1': {
			maxHeight: '8.3333333%',
		},
		'& .MuiGrid-grid-xs-2': {
			maxHeight: '16.666667%',
		},
		'& .MuiGrid-grid-xs-3': {
			maxHeight: '25%',
		},
		'& .MuiGrid-grid-xs-4': {
			maxHeight: '33.333333%',
		},
	},
	avatarWrapper: {
		width: 80,
		padding: theme.spacing(1),
	},
	muteButtons: {
		paddingLeft: '5px',
		paddingTop: '26px',
		float: 'right',
		display: 'grid',
	},
	left: { float: 'left' },
}));

const defaultlocalLobbySettings: ILobbySettings = {
	maxDistance: 5.32,
	haunting: false,
	hearImpostorsInVents: false,
	impostersHearImpostersInvent: false,
	impostorRadioEnabled: false,
	commsSabotage: false,
	deadOnly: false,
	hearThroughCameras: false,
	wallsBlockAudio: false,
	meetingGhostOnly: false,
	visionHearing: false,
	publicLobby_on: false,
	publicLobby_title: '',
	publicLobby_language: 'en',
};
const radioOnAudio = new Audio();
radioOnAudio.src = radioOnSound;
radioOnAudio.volume = 0.02;

// const radiobeepAudio2 = new Audio();
// radiobeepAudio2.src = radioBeep2;
// radiobeepAudio2.volume = 0.2;

const Voice: React.FC<VoiceProps> = function ({ t, error: initialError }: VoiceProps) {
	const [error, setError] = useState('');
	const [settings, setSetting] = useContext(SettingsContext);

	const settingsRef = useRef<ISettings>(settings);
	const [lobbySettings, setHostLobbySettings] = useContext(HostSettingsContext);
	const lobbySettingsRef = useRef(lobbySettings);
	const maxDistanceRef = useRef(2);
	const gameState = useContext(GameStateContext);
	const playerColors = useContext(PlayerColorContext);

	const hostRef = useRef({
		map: MapType.UNKNOWN,
		mobileRunning: false,
		gamestate: gameState.gameState,
		code: gameState.lobbyCode,
		hostId: gameState.hostId,
		parsedHostId: gameState.hostId,
		isHost: gameState.isHost,
		serverHostId: 0,
	});
	let { lobbyCode: displayedLobbyCode } = gameState;
	if (displayedLobbyCode !== 'MENU' && settings.hideCode) displayedLobbyCode = 'LOBBY';
	const [talking, setTalking] = useState(false);
	const [socketClients, setSocketClients] = useState<SocketClientMap>({});
	const [playerConfigs] = useState<playerConfigMap>(settingsRef.current.playerConfigMap);
	const socketClientsRef = useRef(socketClients);
	const [peerConnections, setPeerConnections] = useState<PeerConnections>({});
	const peerConnectionsRef = useRef<PeerConnections>({});
	const convolverBuffer = useRef<AudioBuffer | null>(null);
	const [clientConnections, setClientConnections] = useState<ClientConnectionMap>({});
	const clientConnectionsRef = useRef<ClientConnectionMap>({});
	const clientSocketIdsRef = useRef<numberStringMap>({});
	const classes = useStyles();

	const [connect, setConnect] = useState<{
		connect: (lobbyCode: string, playerId: number, clientId: number, isHost: boolean) => void;
	} | null>(null);
	const [otherTalking, setOtherTalking] = useState<ClientBoolMap>({});
	const [otherVAD, setOtherVAD] = useState<ClientBoolMap>({});
	const [clientAudioActivity, setClientAudioActivity] = useState<Record<number, ClientAudioActivityState>>({});

	const [otherDead, setOtherDead] = useState<ClientBoolMap>({});
	const impostorRadioClientId = useRef<number>(-1);

	const audioElements = useRef<AudioElements>({});
	const peerAudioMonitors = useRef<Record<string, PeerAudioMonitor>>({});

	const [deafenedState, setDeafened] = useState(settings.startDeafened);
	const [mutedState, setMuted] = useState(settings.startMuted);
	const [connected, setConnected] = useState(false);
	const [serverHostId, setServerHostId] = useState(0);
	const previousLobbyCode = useRef(gameState.lobbyCode);
	const overlayVoiceStateRef = useRef<VoiceState>({
		otherTalking: {},
		otherDead: {},
		clientConnections: {},
		impostorRadioClientId: -1,
		localTalking: false,
		localIsAlive: true,
		muted: false,
		deafened: false,
		mod: 'NONE' as VoiceState['mod'],
	});

	const resetServerHost = () => {
		hostRef.current.serverHostId = 0;
		setServerHostId(0);
	};

	const upsertClientConnection = (clientId: number, patch: Partial<ClientConnectionState>) => {
		const now = Date.now();
		setClientConnections((old) => {
			const previous = old[clientId];
			const nextState: ClientConnectionState = {
				clientId,
				socketId: previous?.socketId ?? null,
				connected: previous?.connected ?? false,
				audioConnected: previous?.audioConnected ?? false,
				lastSeenAt: previous?.lastSeenAt ?? now,
				lastAudioAt: previous?.lastAudioAt ?? 0,
				...previous,
				...patch,
			};
			if (
				previous &&
				previous.socketId === nextState.socketId &&
				previous.connected === nextState.connected &&
				previous.audioConnected === nextState.audioConnected &&
				previous.lastSeenAt === nextState.lastSeenAt &&
				previous.lastAudioAt === nextState.lastAudioAt
			) {
				return old;
			}
			const next = { ...old, [clientId]: nextState };
			clientConnectionsRef.current = next;
			return next;
		});
	};

	const markClientDisconnected = (clientId: number, socketId?: string) => {
		setClientConnections((old) => {
			const previous = old[clientId];
			if (!previous) {
				return old;
			}
			if (socketId && previous.socketId && previous.socketId !== socketId) {
				return old;
			}
			const next = {
				...old,
				[clientId]: {
					...previous,
					socketId: null,
					connected: false,
					audioConnected: false,
				},
			};
			clientConnectionsRef.current = next;
			return next;
		});
	};

	const isStaleClientSocketUpdate = (clientId: number, socketId: string) => {
		const activeSocketId = clientSocketIdsRef.current[clientId] ?? clientConnectionsRef.current[clientId]?.socketId;
		return Boolean(activeSocketId && activeSocketId !== socketId);
	};

	const preferSocketForClient = (clientId: number, candidateSocketId: string, currentSocketId?: string) => {
		if (!currentSocketId) {
			return true;
		}

		const candidateActive = Boolean(audioElements.current[candidateSocketId] || peerConnectionsRef.current[candidateSocketId]);
		const currentActive = Boolean(audioElements.current[currentSocketId] || peerConnectionsRef.current[currentSocketId]);
		if (candidateActive !== currentActive) {
			return candidateActive;
		}

		const previousSocketId = clientConnectionsRef.current[clientId]?.socketId;
		if (candidateSocketId === previousSocketId) {
			return true;
		}
		if (currentSocketId === previousSocketId) {
			return false;
		}

		return false;
	};

	const setClientConnectionMap = (nextClients: SocketClientMap) => {
		socketClientsRef.current = nextClients;
		setSocketClients(nextClients);

		const nextSocketIds: numberStringMap = {};
		const seenClientIds = new Set<number>();
		const now = Date.now();

		for (const [socketId, client] of Object.entries(nextClients)) {
			if (preferSocketForClient(client.clientId, socketId, nextSocketIds[client.clientId])) {
				nextSocketIds[client.clientId] = socketId;
			}
			seenClientIds.add(client.clientId);
		}

		clientSocketIdsRef.current = nextSocketIds;
		setClientConnections((old) => {
			const next: ClientConnectionMap = { ...old };

			for (const [socketId, client] of Object.entries(nextClients)) {
				if (nextSocketIds[client.clientId] !== socketId) {
					continue;
				}

				const previous = next[client.clientId];
				next[client.clientId] = {
					clientId: client.clientId,
					socketId,
					connected: true,
					audioConnected: previous?.audioConnected ?? false,
					lastSeenAt: now,
					lastAudioAt: previous?.lastAudioAt ?? 0,
				};
			}

			for (const key of Object.keys(next)) {
				const clientId = Number(key);
				if (!seenClientIds.has(clientId)) {
					next[clientId] = {
						...next[clientId],
						socketId: null,
						connected: false,
						audioConnected: false,
					};
				}
			}

			clientConnectionsRef.current = next;
			return next;
		});
	};

	const clearClientAudioActivity = (clientId: number) => {
		setClientAudioActivity((old) => {
			if (!Object.prototype.hasOwnProperty.call(old, clientId)) {
				return old;
			}
			const next = { ...old };
			delete next[clientId];
			return next;
		});
	};

	const resolvedHostId = gameState.hostId > 0 ? gameState.hostId : serverHostId;
	const resolvedIsHost =
		gameState.gameState !== GameState.MENU &&
		gameState.gameState !== GameState.UNKNOWN &&
		gameState.clientId > 0 &&
		((gameState.hostId > 0 && gameState.isHost) || (resolvedHostId > 0 && resolvedHostId === gameState.clientId));

	function applyEffect(gain: AudioNode, effectNode: AudioNode, destination: AudioNode, player: Player) {
		console.log('Apply effect->', effectNode);
		try {
			gain.disconnect(destination);
			gain.connect(effectNode);
			effectNode.connect(destination);
		} catch {
			console.log('error with applying effect: ', player.name, effectNode);
		}
	}

	function restoreEffect(gain: AudioNode, effectNode: AudioNode, destination: AudioNode, player: Player) {
		console.log('restore effect->', effectNode);
		try {
			effectNode.disconnect(destination);
			gain.disconnect(effectNode);
			gain.connect(destination);
		} catch {
			console.log('error with applying effect: ', player.name, effectNode);
		}
	}

	function setSmoothedAudioParam(param: AudioParam, value: number, context: BaseAudioContext) {
		const now = context.currentTime;
		param.cancelScheduledValues(now);
		param.setTargetAtTime(value, now, AUDIO_PARAM_SMOOTHING_SECONDS);
	}

	function setSmoothedGain(gain: GainNode, value: number) {
		setSmoothedAudioParam(gain.gain, value, gain.context);
	}

	function setTopDownPanPosition(pan: PannerNode, panPos: number[]) {
		const audioContext = pan.context;
		setSmoothedAudioParam(pan.positionX, panPos[0] * AUDIO_DIRECTIONAL_FOCUS, audioContext);
		setSmoothedAudioParam(pan.positionY, 0, audioContext);
		setSmoothedAudioParam(pan.positionZ, -panPos[1] * AUDIO_DIRECTIONAL_FOCUS, audioContext);
	}

	function calculateVoiceAudio(
		state: AmongUsState,
		settings: ISettings,
		me: Player,
		other: Player,
		audio: AudioNodes
	): number {
		const { pan, gain, muffle, reverb, destination } = audio;
		const useLightSource = true;
		let maxdistance = maxDistanceRef.current;
		let panPos = [other.x - me.x, other.y - me.y];
		let endGain = 0;
		let collided = false;
		let skipDistanceCheck = false;
		let muffleEnabled = false;

		if (other.disconnected || other.isDummy) {
			return 0;
		}

		switch (state.gameState) {
			case GameState.MENU:
				return 0;
			case GameState.LOBBY:
				endGain = 1;
				break;

			case GameState.TASKS:
				endGain = 1;

				if (lobbySettings.meetingGhostOnly) {
					endGain = 0;
				}
				if (!me.isDead && lobbySettings.commsSabotage && state.comsSabotaged && !me.isImpostor) {
					endGain = 0;
				}

				// Mute other players which are in a vent
				if (
					other.inVent &&
					!(lobbySettings.hearImpostorsInVents || (lobbySettings.impostersHearImpostersInvent && me.inVent))
				) {
					endGain = 0;
				}
				if (
					lobbySettings.wallsBlockAudio &&
					!me.isDead &&
					poseCollide({ x: me.x, y: me.y }, { x: other.x, y: other.y }, gameState.map, gameState.closedDoors)
				) {
					collided = true;
				}
				if (
					me.isImpostor &&
					other.isImpostor &&
					lobbySettings.impostorRadioEnabled &&
					other.clientId === impostorRadioClientId.current
				) {
					skipDistanceCheck = true;
					muffle.type = 'highpass';
					setSmoothedAudioParam(muffle.frequency, 1000, muffle.context);
					setSmoothedAudioParam(muffle.Q, AUDIO_MUFFLE_Q, muffle.context);
					muffleEnabled = true;
					if (!audio.muffleConnected) {
						audio.muffleConnected = true;
						applyEffect(gain, muffle, destination, other);
					}
				}

				if (!me.isDead && other.isDead && me.isImpostor && lobbySettings.haunting) {
					if (!audio.reverbConnected) {
						audio.reverbConnected = true;
						applyEffect(gain, reverb, destination, other);
					}
					collided = false;
					endGain = settings.ghostVolumeAsImpostor / 100;
				} else {
					if (other.isDead && !me.isDead) {
						endGain = 0;
					}
				}
				break;
			case GameState.DISCUSSION:
				panPos = [0, 0];
				endGain = 1;
				if (!me.isDead && other.isDead) {
					endGain = 0;
				}
				break;

			case GameState.UNKNOWN:
			default:
				endGain = 0;
				break;
		}

		if (useLightSource && state.lightRadiusChanged) {
			pan.maxDistance = maxDistanceRef.current;
		}

		if (!other.isDead || state.gameState !== GameState.TASKS || !me.isImpostor || me.isDead) {
			if (audio.reverbConnected && reverb) {
				audio.reverbConnected = false;
				restoreEffect(gain, reverb, destination, other);
			}
		}

		if (lobbySettings.deadOnly) {
			panPos = [0, 0];
			if (!me.isDead || !other.isDead) {
				endGain = 0;
			}
		}

		let isOnCamera = state.currentCamera !== CameraLocation.NONE;
		if (!skipDistanceCheck && Math.sqrt(panPos[0] * panPos[0] + panPos[1] * panPos[1]) > maxdistance) {
			if (lobbySettings.hearThroughCameras && state.gameState === GameState.TASKS) {
				const cameras = AmongUsMaps[state.map]?.cameras ?? {};
				if (state.currentCamera !== CameraLocation.NONE && state.currentCamera !== CameraLocation.Skeld) {
					const camerapos = cameras[state.currentCamera];
					if (!camerapos) {
						return 0;
					}
					panPos = [other.x - camerapos.x, other.y - camerapos.y];
					console.log('camerapos: ', camerapos);
				} else if (state.currentCamera === CameraLocation.Skeld) {
					let distance = 999;
					let camerapos = { x: 999, y: 999 };
					for (const camera of Object.values(cameras)) {
						const cameraDist = Math.sqrt(Math.pow(other.x - camera.x, 2) + Math.pow(other.y - camera.y, 2));
						if (distance > cameraDist) {
							distance = cameraDist;
							camerapos = camera;
						}
					}
					if (distance != 999) {
						panPos = [other.x - camerapos.x, other.y - camerapos.y];
					}
				}

				if (Math.sqrt(panPos[0] * panPos[0] + panPos[1] * panPos[1]) > maxdistance) {
					return 0;
				}
			} else {
				return 0;
			}
		} else {
			if (collided && !skipDistanceCheck) {
				return 0;
			}
			isOnCamera = false;
		}

		// Muffling in vents
		if (
			((me.inVent && !me.isDead) || (other.inVent && !other.isDead) || isOnCamera) &&
			state.gameState === GameState.TASKS
		) {
			muffle.type = 'lowpass';
			if (!audio.muffleConnected) {
				audio.muffleConnected = true;
				applyEffect(gain, muffle, destination, other);
			}
			maxdistance = isOnCamera ? 3 : 0.8;
			setSmoothedAudioParam(muffle.frequency, isOnCamera ? 2300 : 2000, muffle.context);
			setSmoothedAudioParam(muffle.Q, AUDIO_MUFFLE_Q, muffle.context);
			if (endGain === 1) endGain = isOnCamera ? 0.8 : 0.5; // Too loud at 1
		} else {
			if (audio.muffleConnected && !muffleEnabled) {
				audio.muffleConnected = false;
				restoreEffect(gain, muffle, destination, other);
			}
		}

		if (!settings.enableSpatialAudio || skipDistanceCheck) {
			panPos = [0, 0];
		}

		pan.maxDistance = maxdistance * AUDIO_DIRECTIONAL_FOCUS;
		setTopDownPanPosition(pan, panPos);
		return endGain;
	}

	function notifyMobilePlayers() {
		if (
			settingsRef.current.mobileHost &&
			hostRef.current.gamestate !== GameState.MENU &&
			hostRef.current.gamestate !== GameState.UNKNOWN
		) {
			connectionStuff.current.socket?.emit('signal', {
				to: hostRef.current.code + '_mobile',
				data: { mobileHostInfo: { isHostingMobile: true, isGameHost: hostRef.current.isHost } },
			});
		}
		setTimeout(() => notifyMobilePlayers(), 5000);
	}

	function disconnectAudioHtmlElement(element: HTMLAudioElement) {
		console.log('disableing element?', element);
		element.pause();
		if (element.srcObject) {
			const mediaStream = element.srcObject as MediaStream;
			mediaStream.getTracks().forEach((track) => track.stop());
		}
		element.removeAttribute('srcObject');
		element.removeAttribute('src');
		element.srcObject = null;
		element.load();
		element.remove();
	}

	function updateClientAudioActivity(clientId: number, nextState: ClientAudioActivityState) {
		setClientAudioActivity((old) => {
			const previous = old[clientId];
			if (
				previous &&
				previous.speaking === nextState.speaking &&
				previous.audible === nextState.audible &&
				Math.abs(previous.level - nextState.level) < 0.004 &&
				previous.lastActivityAt === nextState.lastActivityAt
			) {
				return old;
			}
			return { ...old, [clientId]: nextState };
		});
	}

	function startPeerAudioMonitor(peer: string, clientId: number, analyser: AnalyserNode) {
		const existing = peerAudioMonitors.current[peer];
		if (existing) {
			window.clearInterval(existing.intervalId);
		}

		const monitor: PeerAudioMonitor = {
			clientId,
			intervalId: 0,
			samples: new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>,
			analyser,
			smoothedLevel: 0,
			speaking: false,
			audible: false,
			lastActivityAt: 0,
		};

		monitor.intervalId = window.setInterval(() => {
			const activeClientId = socketClientsRef.current[peer]?.clientId;
			if (activeClientId === undefined) {
				clearClientAudioActivity(monitor.clientId);
				if (clientConnectionsRef.current[monitor.clientId]?.socketId === peer) {
					upsertClientConnection(monitor.clientId, {
						audioConnected: false,
					});
				}
				monitor.smoothedLevel = 0;
				monitor.speaking = false;
				monitor.audible = false;
				monitor.lastActivityAt = 0;
				return;
			}

			if (activeClientId !== monitor.clientId) {
				const oldClientId = monitor.clientId;
				clearClientAudioActivity(oldClientId);
				if (clientConnectionsRef.current[oldClientId]?.socketId === peer) {
					upsertClientConnection(oldClientId, {
						audioConnected: false,
					});
				}
				monitor.clientId = activeClientId;
				monitor.smoothedLevel = 0;
				monitor.speaking = false;
				monitor.audible = false;
				monitor.lastActivityAt = 0;
			}

			monitor.analyser.getFloatTimeDomainData(monitor.samples);
			let sum = 0;
			for (const sample of monitor.samples) {
				sum += sample * sample;
			}
			const rms = Math.sqrt(sum / monitor.samples.length);
			monitor.smoothedLevel = monitor.smoothedLevel * 0.72 + rms * 0.28;

			if (monitor.smoothedLevel >= REMOTE_AUDIO_SPEAKING_ON) {
				monitor.speaking = true;
			} else if (monitor.smoothedLevel <= REMOTE_AUDIO_SPEAKING_OFF) {
				monitor.speaking = false;
			}

			if (monitor.smoothedLevel >= REMOTE_AUDIO_AUDIBLE_ON) {
				monitor.audible = true;
			} else if (monitor.smoothedLevel <= REMOTE_AUDIO_AUDIBLE_OFF) {
				monitor.audible = false;
			}

			if (monitor.audible) {
				monitor.lastActivityAt = Date.now();
			}
			const lastActivityAt = monitor.lastActivityAt;
			updateClientAudioActivity(monitor.clientId, {
				level: monitor.smoothedLevel,
				speaking: monitor.speaking,
				audible: monitor.audible,
				lastActivityAt,
			});
			upsertClientConnection(monitor.clientId, {
				audioConnected: true,
				lastAudioAt: lastActivityAt,
			});
		}, REMOTE_AUDIO_UPDATE_INTERVAL_MS);

		peerAudioMonitors.current[peer] = monitor;
	}

	function disconnectAudioElement(peer: string) {
		const monitor = peerAudioMonitors.current[peer];
		if (monitor) {
			window.clearInterval(monitor.intervalId);
			delete peerAudioMonitors.current[peer];
			const activeSocketId = clientConnectionsRef.current[monitor.clientId]?.socketId;
			if (!activeSocketId || activeSocketId === peer) {
				clearClientAudioActivity(monitor.clientId);
				upsertClientConnection(monitor.clientId, {
					audioConnected: false,
				});
			}
		}
		if (audioElements.current[peer]) {
			console.log('removing element..');
			disconnectAudioHtmlElement(audioElements.current[peer].audioElement);
			disconnectAudioHtmlElement(audioElements.current[peer].dummyAudioElement);
			audioElements.current[peer].pan.disconnect();
			audioElements.current[peer].gain.disconnect();
			// if (audioElements.current[peer].reverbGain != null) audioElements.current[peer].reverbGain?.disconnect();
			if (audioElements.current[peer].reverb != null) audioElements.current[peer].reverb?.disconnect();
			void audioElements.current[peer].context.close().catch(() => undefined);
			delete audioElements.current[peer];
		}
	}

	function disconnectClient(client: Client, keepSocketId?: string) {
		if (!client || !client.clientId) {
			return;
		}

		const knownSocketId = clientSocketIdsRef.current[client.clientId];
		if (knownSocketId && knownSocketId !== keepSocketId) {
			console.log('Disconnecting stale transport...', client.clientId, knownSocketId);
			disconnectPeer(knownSocketId, { preserveClientState: true });
		}
	}

	function disconnectPeer(peer: string, options?: { preserveClientState?: boolean }) {
		console.log('Disconnect peer: ', peer);
		const connection = peerConnectionsRef.current[peer];
		const clientId =
			socketClientsRef.current[peer]?.clientId ??
			Object.values(clientConnectionsRef.current).find((client) => client.socketId === peer)?.clientId;
		if (!connection) {
			if (clientId !== undefined && !options?.preserveClientState) {
				setOtherVAD((old) => {
					if (!Object.prototype.hasOwnProperty.call(old, clientId)) {
						return old;
					}
					const next = { ...old };
					delete next[clientId];
					return next;
				});
				setOtherTalking((old) => {
					if (!Object.prototype.hasOwnProperty.call(old, clientId)) {
						return old;
					}
					const next = { ...old };
					delete next[clientId];
					return next;
				});
				clearClientAudioActivity(clientId);
			}
			if (Object.prototype.hasOwnProperty.call(socketClientsRef.current, peer)) {
				const nextClients = { ...socketClientsRef.current };
				delete nextClients[peer];
				setClientConnectionMap(nextClients);
			}
			if (clientId !== undefined && !options?.preserveClientState) {
				markClientDisconnected(clientId, peer);
			}
			disconnectAudioElement(peer);
			return;
		}
		const nextConnections = { ...peerConnectionsRef.current };
		delete nextConnections[peer];
		peerConnectionsRef.current = nextConnections;
		setPeerConnections(nextConnections);
		connection.destroy();
		if (clientId !== undefined && !options?.preserveClientState) {
			setOtherVAD((old) => {
				if (!Object.prototype.hasOwnProperty.call(old, clientId)) {
					return old;
				}
				const next = { ...old };
				delete next[clientId];
				return next;
			});
			setOtherTalking((old) => {
				if (!Object.prototype.hasOwnProperty.call(old, clientId)) {
					return old;
				}
				const next = { ...old };
					delete next[clientId];
					return next;
				});
			clearClientAudioActivity(clientId);
		}
		if (Object.prototype.hasOwnProperty.call(socketClientsRef.current, peer)) {
			const nextClients = { ...socketClientsRef.current };
			delete nextClients[peer];
			setClientConnectionMap(nextClients);
		}
		if (clientId !== undefined && !options?.preserveClientState) {
			markClientDisconnected(clientId, peer);
		}
		disconnectAudioElement(peer);
	}
	// Handle pushToTalk, if set
	useEffect(() => {
		if (!connectionStuff.current.instream) return;
		connectionStuff.current.instream.getAudioTracks()[0].enabled =
			!connectionStuff.current.deafened &&
			!connectionStuff.current.muted &&
			settings.pushToTalkMode !== pushToTalkOptions.PUSH_TO_TALK;
		connectionStuff.current.pushToTalkMode = settings.pushToTalkMode;
	}, [settings.pushToTalkMode]);

	useEffect(() => {
		if (previousLobbyCode.current === gameState.lobbyCode) {
			return;
		}

		previousLobbyCode.current = gameState.lobbyCode;
		resetServerHost();
	}, [gameState.lobbyCode]);

	useEffect(() => {
		hostRef.current = {
			...hostRef.current,
			map: gameState.map,
			gamestate: gameState.gameState,
			code: gameState.lobbyCode,
			hostId: gameState.hostId,
			parsedHostId: resolvedHostId,
			isHost: resolvedIsHost,
			serverHostId,
		};
	}, [gameState.gameState, gameState.hostId, gameState.lobbyCode, gameState.map, resolvedHostId, resolvedIsHost, serverHostId]);

	// Emit lobby settings to connected peers
	useEffect(() => {
		if (!resolvedIsHost) return;
		Object.values(peerConnectionsRef.current).forEach((peer) => {
			try {
				console.log('sendxx > ', JSON.stringify(settings.localLobbySettings));
				peer.send(JSON.stringify(settings.localLobbySettings));
			} catch (e) {
				console.warn('failed to update lobby settings: ', e);
			}
		});

		setHostLobbySettings(settings.localLobbySettings);
	}, [resolvedIsHost, settings.localLobbySettings]);

	useEffect(() => {
		for (const peer in audioElements.current) {
			audioElements.current[peer].pan.maxDistance = maxDistanceRef.current;
		}
	}, [lobbySettings.maxDistance, lobbySettings.visionHearing]);

	useEffect(() => {
		if (
			!gameState ||
			!gameState.players ||
			!connectionStuff.current.socket ||
			(!hostRef.current.mobileRunning && !settings.obsOverlay)
		) {
			return;
		}
		if (hostRef.current.mobileRunning) {
			connectionStuff.current.socket?.emit('signal', {
				to: gameState.lobbyCode + '_mobile',
				data: { gameState, lobbySettings },
			});
		}

		if (
			settings.obsOverlay &&
			settings.obsSecret &&
			settings.obsSecret.length === 9 &&
			((gameState.gameState !== GameState.UNKNOWN && gameState.gameState !== GameState.MENU) ||
				gameState.oldGameState !== gameState.gameState)
		) {
			connectionStuff.current.overlaySocket = connectionStuff.current.socket;

			const obsvoiceState: ObsVoiceState = {
				overlayState: {
					gameState: gameState.gameState,
					players: gameState.players.map((o) => ({
						id: o.id,
						clientId: o.clientId,
						inVent: o.inVent,
						isDead: o.isDead,
						name: o.name,
						colorId: o.colorId,
						hatId: o.hatId,
						petId: o.petId,
						skinId: o.skinId,
						visorId: o.visorId,
						disconnected: o.disconnected,
						isLocal: o.isLocal,
						shiftedColor: o.shiftedColor,
						bugged: o.bugged,
						realColor: playerColors[o.colorId],
						usingRadio: o.clientId === impostorRadioClientId.current && myPlayer?.isImpostor,
						connected: clientConnections[o.clientId]?.connected ?? false,
					})),
				},
				otherTalking,
				otherDead,
				localTalking: talking,
				localIsAlive: !myPlayer?.isDead,
				mod: gameState.mod,
				oldMeetingHud: gameState.oldMeetingHud,
			};
			connectionStuff.current.overlaySocket?.emit('signal', {
				to: settings.obsSecret,
				data: obsvoiceState,
			});
		}
	}, [gameState]);

	// Add settings to settingsRef
	useEffect(() => {
		settingsRef.current = settings;
	}, [settings]);

	// Add socketClients to socketClientsRef
	useEffect(() => {
		socketClientsRef.current = socketClients;
	}, [socketClients]);

	useEffect(() => {
		clientConnectionsRef.current = clientConnections;
	}, [clientConnections]);

	useEffect(() => {
		if (
			connectionStuff.current?.microphoneGain?.gain &&
			(settingsRef.current.microphoneGainEnabled || settingsRef.current.micSensitivityEnabled)
		) {
			if (!settingsRef.current.micSensitivityEnabled)
				connectionStuff.current.microphoneGain.gain.value = settings.microphoneGainEnabled
					? settings.microphoneGain / 100
					: 1;

			if (connectionStuff.current?.audioListener?.options) {
				connectionStuff.current.audioListener.options.minNoiseLevel = settings.micSensitivityEnabled
					? settings.micSensitivity
					: 0.15;
				connectionStuff.current.audioListener.init();
			}
		}
	}, [settings.microphoneGain, settings.microphoneGainEnabled, settings.micSensitivity, settings.micSensitivityEnabled]);

	const myPlayer = useMemo(() => {
		if (!gameState || !gameState.players) {
			return undefined;
		}

		return gameState.players.find((p) => p.isLocal);
	}, [gameState.players]);

	const currentOverlayVoiceState = useMemo(
		() =>
			({
				otherTalking,
				otherDead,
				clientConnections,
				localTalking: talking,
				localIsAlive: !myPlayer?.isDead,
				impostorRadioClientId: !myPlayer?.isImpostor ? -1 : impostorRadioClientId.current,
				muted: mutedState,
				deafened: deafenedState,
				mod: gameState.mod,
			}) as VoiceState,
		[otherTalking, otherDead, clientConnections, talking, myPlayer?.isDead, myPlayer?.isImpostor, mutedState, deafenedState, gameState.mod]
	);

	useEffect(() => {
		overlayVoiceStateRef.current = currentOverlayVoiceState;
		writeOverlayState(OVERLAY_STATE_KEYS.voiceState, currentOverlayVoiceState);
	}, [currentOverlayVoiceState]);

	useEffect(() => {
		const onOverlayInit = () => {
			if (!settingsRef.current.enableOverlay) {
				return;
			}

			bridge.send(
				IpcMessages.SEND_TO_OVERLAY,
				IpcOverlayMessages.NOTIFY_VOICE_STATE_CHANGED,
				overlayVoiceStateRef.current
			);
		};

		bridge.on(IpcOverlayMessages.REQUEST_INITVALUES, onOverlayInit);
		return () => {
			bridge.off(IpcOverlayMessages.REQUEST_INITVALUES, onOverlayInit);
		};
	}, []);

	const updateLobby = () => {
		console.log(gameState);

		if (
			!connected ||
			!gameState ||
			!resolvedIsHost ||
			!myPlayer ||
			!gameState.lobbyCode ||
			gameState.lobbyCode === 'MENU' ||
			gameState.gameState === GameState.MENU ||
			gameState.gameState === GameState.UNKNOWN ||
			!gameState.players
		) {
			return;
		}
		connectionStuff.current.socket?.emit('lobby', gameState.lobbyCode, {
			id: -1,
			title: settings.localLobbySettings.publicLobby_title,
			host: myPlayer.name,
			current_players: gameState.players.length,
			max_players: gameState.maxPlayers,
			server: gameState.currentServer,
			language: settings.localLobbySettings.publicLobby_language,
			mods: gameState.mod,
			isPublic: settings.localLobbySettings.publicLobby_on,
			gameState: gameState.gameState,
		});
	};

	useEffect(() => {
		if (connected && resolvedIsHost && gameState.lobbyCode && gameState.gameState !== GameState.MENU) {
			connectionStuff.current.socket?.emit('setHost', gameState.lobbyCode, gameState.clientId);
			if (gameState.hostId > 0) {
				hostRef.current.serverHostId = gameState.hostId;
				setServerHostId(gameState.hostId);
			}
		}
	}, [connected, resolvedIsHost, gameState.clientId, gameState.gameState, gameState.hostId, gameState.lobbyCode]);

	useEffect(() => {
		updateLobby();
	}, [
		connected,
		gameState.gameState,
		gameState.lobbyCode,
		gameState.currentServer,
		gameState.maxPlayers,
		gameState.mod,
		gameState.players?.length,
		myPlayer?.name,
		resolvedIsHost,
		settings.localLobbySettings.publicLobby_title,
		settings.localLobbySettings.publicLobby_language,
		settings.localLobbySettings.publicLobby_on,
	]);

	// Add lobbySettings to lobbySettingsRef
	useEffect(() => {
		lobbySettingsRef.current = lobbySettings;
	}, [lobbySettings]);



	// Set dead player data
	useEffect(() => {
		if (gameState.gameState === GameState.LOBBY) {
			setOtherDead({});
		} else if (gameState.gameState !== GameState.TASKS) {
			if (!gameState.players) return;
			setOtherDead((old) => {
				let changed = false;
				const next = { ...old };
				const liveClientIds = new Set<number>();

				for (const player of gameState.players) {
					liveClientIds.add(player.clientId);
					const isDead = player.isDead || player.disconnected;
					if (next[player.clientId] !== isDead) {
						next[player.clientId] = isDead;
						changed = true;
					}
				}

				for (const key of Object.keys(next)) {
					if (!liveClientIds.has(Number(key))) {
						delete next[Number(key)];
						changed = true;
					}
				}

				return changed ? next : old;
			});
		}
	}, [gameState.gameState, gameState.players]);

	// const [audioContext] = useState<AudioContext>(() => new AudioContext());
	const connectionStuff = useRef<ConnectionStuff>({
		pushToTalkMode: settings.pushToTalkMode,
		deafened: settings.startDeafened,
		muted: settings.startMuted,
		impostorRadio: null,
		toggleMute: () => {
			/*empty*/
		},
		toggleDeafen: () => {
			/*empty*/
		},
	});

	useEffect(() => {
		(async () => {
			const context = new AudioContext();
			const reverbResponse = await fetch(reverbOgxUrl);
			const reverbBuffer = await reverbResponse.arrayBuffer();
			convolverBuffer.current = await context.decodeAudioData(reverbBuffer);
			await context.close();
		})();
	}, []);

	useEffect(() => {
		const pressing = connectionStuff.current.impostorRadio;
		if (
			pressing == null ||
			!myPlayer ||
			!myPlayer.isImpostor ||
			myPlayer.isDead ||
			!(impostorRadioClientId.current === myPlayer.clientId || impostorRadioClientId.current === -1) ||
			!lobbySettingsRef.current.impostorRadioEnabled
		) {
			return;
		}
		radioOnAudio.play();
		connectionStuff.current.impostorRadio = pressing;
		impostorRadioClientId.current = pressing ? myPlayer.clientId : -1;
		for (const player of otherPlayers.filter((o) => o.isImpostor && !o.bugged && !o.isDead)) {
			const peer = clientSocketIdsRef.current[player.clientId];
			const connection = peerConnectionsRef.current[peer];
			if (connection !== undefined && connection.writable)
				connection?.send(JSON.stringify({ impostorRadio: connectionStuff.current.impostorRadio }));
		}
	}, [connectionStuff.current.impostorRadio]);

	useEffect(() => {
		// (async function anyNameFunction() {
		let currentLobby = '';
		// Connect to voice relay server
		connectionStuff.current.socket = io(settings.serverURL,{
			transports: ['websocket']
		 });

		const { socket } = connectionStuff.current;

		socket.on('error', (error: SocketError) => {
			if (error.message) {
				setError(error.message);
			}
			console.error('socketIO error:', error);
			currentLobby = 'MENU';
		});
		socket.on('connect', () => {
			setConnected(true);
			console.log('CONNECTED??');
		});

		socket.on('setHost', (hostId: number) => {
			setServerHostId(hostId);
			hostRef.current.serverHostId = hostId;
		});

		socket.on('disconnect', () => {
			setConnected(false);
			resetServerHost();
			setOtherVAD({});
			setOtherTalking({});
			setClientAudioActivity({});
			Object.keys(peerConnectionsRef.current).forEach((peerId) => {
				disconnectPeer(peerId);
			});
			setClientConnectionMap({});
			currentLobby = 'MENU';
			console.log('DISCONNECTED??');
		});

		notifyMobilePlayers();

		let iceConfig: RTCConfiguration = DEFAULT_ICE_CONFIG;
		socket.on('clientPeerConfig', (clientPeerConfig: ClientPeerConfig) => {
			if (!validateClientPeerConfig(clientPeerConfig)) {
				let errorsFormatted = '';
				if (validateClientPeerConfig.errors) {
					errorsFormatted = validateClientPeerConfig.errors
						.map((error) => `${error.instancePath || ''} ${error.message ?? ''}`.trim())
						.join('\n');
				}
				alert(
					`Server sent a malformed peer config. Default config will be used. See errors below:\n${errorsFormatted}`
				);
				return;
			}

			if (
				clientPeerConfig.forceRelayOnly &&
				!clientPeerConfig.iceServers.some((server) => server.urls.toString().includes('turn:'))
			) {
				alert('Server has forced relay mode enabled but provides no relay servers. Default config will be used.');
				return;
			}

			iceConfig = {
				iceTransportPolicy: clientPeerConfig.forceRelayOnly ? 'relay' : 'all',
				iceServers: clientPeerConfig.iceServers,
			};
		});

		socket.on('VAD', (data: { activity: boolean; client: Client; socketId: string }) => {
			const mappedClient = socketClientsRef.current[data.socketId];
			if (!mappedClient) {
				return;
			}

			const vadClientId = mappedClient.clientId;
			if (isStaleClientSocketUpdate(vadClientId, data.socketId)) {
				return;
			}

			setOtherVAD((old) => ({
				...old,
				[vadClientId]: data.activity,
			}));
			upsertClientConnection(vadClientId, {
				socketId: data.socketId,
				connected: true,
				lastSeenAt: Date.now(),
			});
		});

		socket.on('setClient', (socketId: string, client: Client) => {
			disconnectClient(client, socketId);
			setClientConnectionMap({ ...socketClientsRef.current, [socketId]: client });
		});

		socket.on('setClients', (clients: SocketClientMap) => {
			setClientConnectionMap(clients);
		});

		// Initialize variables
		let audioListener: VadNode;

		const audio: BetterAudioConstraints = {
			deviceId: (undefined as unknown) as string,
			autoGainControl: false,
			channelCount: 2,
			echoCancellation: settings.echoCancellation,
			latency: 0,
			noiseSuppression: settings.noiseSuppression,// @ts-ignore-line
			googNoiseSuppression: settings.noiseSuppression, // @ts-ignore-line
			googEchoCancellation: settings.echoCancellation, // @ts-ignore-line
			googTypingNoiseDetection: settings.noiseSuppression, // @ts-ignore-line
			sampleRate: settings.oldSampleDebug? 48000 : undefined,
			sampleSize: settings.oldSampleDebug? 16 : undefined,
		};

		// Get microphone settings
		if (settingsRef.current.microphone.toLowerCase() !== 'default') audio.deviceId = settingsRef.current.microphone;
		navigator.mediaDevices.getUserMedia({ video: false, audio })
		.then(async (inStream) => {
			let stream = inStream;
			const ac = new AudioContext();
			let microphoneGain: GainNode | undefined;
			const source = ac.createMediaStreamSource(inStream);
			if (settings.microphoneGainEnabled || settings.micSensitivityEnabled) {
				console.log('Microphone volume or sensitivityEnabled..');
				stream = (() => {
					microphoneGain = ac.createGain();
					const destination = ac.createMediaStreamDestination();
					source.connect(microphoneGain);
					microphoneGain.gain.value = settings.microphoneGainEnabled ? settings.microphoneGain / 100 : 1;
					microphoneGain.connect(destination);
					connectionStuff.current.microphoneGain = microphoneGain;
					return destination.stream;
				})();
			}

			if (settingsRef.current.vadEnabled) {
				audioListener = VAD(ac, source, undefined, {
					onVoiceStart: () => {
						if (microphoneGain && settingsRef.current.micSensitivityEnabled) {
							microphoneGain.gain.value = settingsRef.current.microphoneGainEnabled
								? settingsRef.current.microphoneGain / 100
								: 1;
						}
						setTalking(true);
					},
					onVoiceStop: () => {
						if (microphoneGain && settingsRef.current.micSensitivityEnabled) {
							microphoneGain.gain.value = 0;
						}
						setTalking(false);
					},
					noiseCaptureDuration: 0,
					stereo: false,
				});

				audioListener.options.minNoiseLevel = settingsRef.current.micSensitivityEnabled
					? settingsRef.current.micSensitivity
					: 0.15;
				audioListener.options.maxNoiseLevel = 1;

				audioListener.init();
				connectionStuff.current.audioListener = audioListener;
				connectionStuff.current.microphoneGain = microphoneGain;
			}
			connectionStuff.current.stream = stream;
			connectionStuff.current.instream = inStream;

			inStream.getAudioTracks()[0].enabled =
				!connectionStuff.current.deafened &&
				!connectionStuff.current.muted &&
				settings.pushToTalkMode !== pushToTalkOptions.PUSH_TO_TALK;

			connectionStuff.current.toggleDeafen = () => {
				connectionStuff.current.deafened = !connectionStuff.current.deafened;
				inStream.getAudioTracks()[0].enabled =
					!connectionStuff.current.deafened &&
					!connectionStuff.current.muted &&
					connectionStuff.current.pushToTalkMode !== pushToTalkOptions.PUSH_TO_TALK;
				setDeafened(connectionStuff.current.deafened);
				setSetting('startDeafened', connectionStuff.current.deafened);
			};

			connectionStuff.current.toggleMute = () => {
				connectionStuff.current.muted = !connectionStuff.current.muted;
				if (connectionStuff.current.deafened) {
					connectionStuff.current.deafened = false;
					connectionStuff.current.muted = false;
				}
				inStream.getAudioTracks()[0].enabled =
					!connectionStuff.current.muted &&
					!connectionStuff.current.deafened &&
					connectionStuff.current.pushToTalkMode !== pushToTalkOptions.PUSH_TO_TALK;
				setMuted(connectionStuff.current.muted);
				setDeafened(connectionStuff.current.deafened);
				setSetting('startMuted', connectionStuff.current.muted);
				setSetting('startDeafened', connectionStuff.current.deafened);
			};

			bridge.on(IpcRendererMessages.TOGGLE_DEAFEN, connectionStuff.current.toggleDeafen);

			bridge.on(IpcRendererMessages.IMPOSTOR_RADIO, (_: unknown, pressing: boolean) => {
				connectionStuff.current.impostorRadio = pressing;
			});

			bridge.on(IpcRendererMessages.TOGGLE_MUTE, connectionStuff.current.toggleMute);
			bridge.on(IpcRendererMessages.PUSH_TO_TALK, (_: unknown, pressing: boolean) => {
				if (connectionStuff.current.pushToTalkMode === pushToTalkOptions.VOICE) return;
				if (!connectionStuff.current.deafened && !connectionStuff.current.muted) {
					inStream.getAudioTracks()[0].enabled =
						connectionStuff.current.pushToTalkMode === pushToTalkOptions.PUSH_TO_TALK ? pressing : !pressing;
				}
			});

			audioElements.current = {};

			const connect = (lobbyCode: string, playerId: number, clientId: number, isHost: boolean) => {
				console.log('connect called..', lobbyCode);
				setOtherVAD({});
				setOtherTalking({});
				if (lobbyCode === 'MENU') {
					resetServerHost();
					setClientAudioActivity({});
					Object.keys(peerConnectionsRef.current).forEach((k) => {
						disconnectPeer(k);
					});
					setClientConnectionMap({});
					currentLobby = lobbyCode;
				} else if (currentLobby !== lobbyCode) {
					console.log('Currentlobby', currentLobby, lobbyCode);
					resetServerHost();
					socket.emit('leave');
					socket.emit('id', playerId, clientId);
					socket.emit('join', lobbyCode, playerId, clientId, isHost);
					currentLobby = lobbyCode;
				} else if (currentLobby === lobbyCode && playerId > 0 && clientId > 0) {
					socket.emit('id', playerId, clientId);
				}
			};

			setConnect({ connect });

			function createPeerConnection(peer: string, initiator: boolean, client?: Client): Peer.Instance | undefined {
				console.log('CreatePeerConnection: ', peer, initiator);
				if (client) {
					disconnectClient(client);
				}
				let connection: Peer.Instance;
				try {
					connection = new Peer({
						stream,
						initiator, // @ts-ignore-line
						iceRestartEnabled: true,
						config: settingsRef.current.natFix ? DEFAULT_ICE_CONFIG_TURN : iceConfig,
					});
				} catch (error) {
					console.error('CreatePeerConnection failed', peer, initiator, error);
					return undefined;
				}

				const nextConnections = { ...peerConnectionsRef.current, [peer]: connection };
				peerConnectionsRef.current = nextConnections;
				setPeerConnections(nextConnections);

				connection.on('connect', () => {
					setTimeout(() => {
						if (hostRef.current.isHost && connection.writable) {
							try {
								console.log('sending settings..');
								connection.send(JSON.stringify(lobbySettingsRef.current));
							} catch (e) {
								console.warn('failed to update lobby settings: ', e);
							}
						}
					}, 1000);
				});

				connection.on('stream', async (stream: MediaStream) => {
					console.log('ONSTREAM');

					const connectedClientId = socketClientsRef.current[peer]?.clientId ?? client?.clientId;
					const dummyAudio = new Audio();
					dummyAudio.srcObject = stream;
					const context = new AudioContext();
					const source = context.createMediaStreamSource(stream);
					const dest = context.createMediaStreamDestination();
					const analyser = context.createAnalyser();
					analyser.fftSize = 1024;

					const gain = context.createGain();
					const pan = context.createPanner();
					gain.gain.value = 0;
					pan.refDistance = AUDIO_NEAR_FIELD_DISTANCE;
					pan.panningModel = 'HRTF';
					pan.distanceModel = 'linear';
					pan.maxDistance = maxDistanceRef.current;
					pan.rolloffFactor = AUDIO_DISTANCE_ROLLOFF_FACTOR;

					const muffle = context.createBiquadFilter();
					muffle.type = 'lowpass';

					source.connect(analyser);
					source.connect(pan);
					pan.connect(gain);

					const reverb = context.createConvolver();
					reverb.buffer = convolverBuffer.current;
					const destination: AudioNode = dest;
					// if (settingsRef.current.vadEnabled) {
					// 	VAD(context, gain, undefined, {
					// 		onVoiceStart: () => setTalking(true),
					// 		onVoiceStop: () => setTalking(false),
					// 		stereo: false,
					// 	});
					// }
					gain.connect(destination);
					const audio = document.createElement('audio') as ExtendedAudioElement;
					document.body.appendChild(audio);
					audio.setAttribute('autoplay', '');
					audio.srcObject = dest.stream;
					if (settingsRef.current.speaker.toLowerCase() !== 'default') {
						audio.setSinkId(settingsRef.current.speaker);
					}

					if (connectedClientId !== undefined) {
						upsertClientConnection(connectedClientId, {
							socketId: peer,
							connected: true,
							audioConnected: true,
							lastSeenAt: Date.now(),
						});
						startPeerAudioMonitor(peer, connectedClientId, analyser);
					}

					audioElements.current[peer] = {
						context,
						dummyAudioElement: dummyAudio,
						audioElement: audio,
						gain,
						pan,
						reverb,
						muffle,
						muffleConnected: false,
						reverbConnected: false,
						destination,
					};
				});

				connection.on('signal', (data) => {
					socket.emit('signal', {
						data,
						to: peer,
					});
				});

				connection.on('data', (data) => {
					const parsedData = JSON.parse(data);
					if (Object.prototype.hasOwnProperty.call(parsedData, 'impostorRadio')) {
						const clientId = socketClientsRef.current[peer]?.clientId;
						if (impostorRadioClientId.current === -1 && parsedData['impostorRadio']) {
							impostorRadioClientId.current = clientId;
						} else if (impostorRadioClientId.current === clientId && !parsedData['impostorRadio']) {
							impostorRadioClientId.current = -1;
						}
						console.log('Recieved impostor radio request', parsedData);
					}
					if (Object.prototype.hasOwnProperty.call(parsedData, 'maxDistance')) {
						if (!hostRef.current || hostRef.current.parsedHostId !== socketClientsRef.current[peer]?.clientId) return;
						const newSettings = {...defaultlocalLobbySettings, ...parsedData};
						setHostLobbySettings(newSettings);
					}
				});
				connection.on('close', () => {
					console.log('Disconnected from', peer, 'Initiator:', initiator);
					disconnectPeer(peer);
				});
				connection.on('error', (err) => {
					console.error('Peer connection error with', peer, ':', err);
				});
				return connection;
			}

			function normalizeSignalData(data: unknown): Peer.SignalData | null {
				if (!data || typeof data !== 'object') {
					return null;
				}
				const signalData = data as Record<string, unknown>;

				// Older clients may emit ICE candidates without a `type` field.
				if (Object.prototype.hasOwnProperty.call(signalData, 'candidate') && typeof signalData.type !== 'string') {
					const candidate =
						signalData.candidate && typeof signalData.candidate === 'object'
							? (signalData.candidate as RTCIceCandidate)
							: (signalData as unknown as RTCIceCandidate);
					return {
						type: 'candidate',
						candidate,
					} as Peer.SignalData;
				}

				return data as Peer.SignalData;
			}

			socket.on('join', async (peer: string, client: Client) => {
				if (!peerConnectionsRef.current[peer]) {
					createPeerConnection(peer, true, client);
				}
				if (client) {
					disconnectClient(client, peer);
					setClientConnectionMap({ ...socketClientsRef.current, [peer]: client });
				}
			});

			socket.on('signal', ({ data, from, client }: { data: unknown; from: string; client?: Client }) => {
				if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'mobilePlayerInfo')) {
					const mobiledata = data as unknown as mobileHostInfo;
					if (
						mobiledata.mobilePlayerInfo.code === hostRef.current.code &&
						hostRef.current.gamestate !== GameState.MENU
					) {
						hostRef.current.mobileRunning = true;
						console.log('setting mobileRunning to true..');
					}
					return;
				}
				if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'mobileHostInfo')) {
					return;
				}
				if (client) {
					disconnectClient(client, from);
					setClientConnectionMap({ ...socketClientsRef.current, [from]: client });
				}
				const normalizedData = normalizeSignalData(data);
				if (!normalizedData) {
					return;
				}

				let connection: Peer.Instance | undefined = peerConnectionsRef.current[from];
				if (!connection) {
					connection = createPeerConnection(from, false, client);
				}
				if (!connection) {
					return;
				}
				try {
					connection.signal(normalizedData);
				} catch (error) {
					console.error('Signal apply failed', from, error);
					return;
				}
			});
		},
		(error) => {
			console.error(error);
			setError("Couldn't connect to your microphone:\n" + error);
			// bridge.send(IpcMessages.SHOW_ERROR_DIALOG, {
			// 	title: 'Error',
			// 	content: 'Couldn\'t connect to your microphone:\n' + error
			// });
		});

		return () => {
			hostRef.current.mobileRunning = false;
			socket.emit('leave');
			Object.keys(peerConnectionsRef.current).forEach((k) => {
				disconnectPeer(k);
			});
			connectionStuff.current.socket?.close();

			audioListener?.destroy();
		};
		// })();
	}, []);

	interface mobileHostInfo {
		mobilePlayerInfo: {
			code: string;
			askingForHost: boolean;
		};
	}

	//data: { mobilePlayerInfo: { code: this.gamecode, askingForHost: true }
	const otherPlayers = useMemo(() => {
		let otherPlayers: Player[];
		if (!gameState || !gameState.players || !myPlayer) return [];
		else otherPlayers = gameState.players.filter((p) => !p.isLocal);
		maxDistanceRef.current = lobbySettings.visionHearing
			? Math.min(lobbySettings.maxDistance, gameState.lightRadius)
			: lobbySettings.maxDistance;
		if (!lobbySettings.visionHearing && maxDistanceRef.current <= 0.6) {
			maxDistanceRef.current = 1;
		}
		const handledPeerIds: string[] = [];
		let foundRadioUser = false;
		const tempTalking = { ...otherTalking };
		let talkingUpdate = false;
		for (const player of otherPlayers) {
			const peerId = clientConnections[player.clientId]?.socketId ?? clientSocketIdsRef.current[player.clientId];
			const audio = player.clientId === myPlayer.clientId ? undefined : audioElements.current[peerId];
			const remoteAudioState = clientAudioActivity[player.clientId];
			const remoteAudioRecent = Boolean(
				remoteAudioState?.lastActivityAt && Date.now() - remoteAudioState.lastActivityAt <= REMOTE_AUDIO_TALKING_GRACE_MS
			);
			const localPeerTalking = Boolean(remoteAudioState?.speaking || (remoteAudioState?.audible && remoteAudioRecent));
			const serverVadTalking = Boolean(
				otherVAD[player.clientId] && remoteAudioState && (remoteAudioRecent || remoteAudioState.speaking || remoteAudioState.audible)
			);
			if (
				player.clientId === impostorRadioClientId.current &&
				player.isImpostor &&
				!player.isDead &&
				!player.disconnected &&
				!player.bugged
			) {
				foundRadioUser = true;
			}
			if (audio) {
				handledPeerIds.push(peerId);
				let gain = calculateVoiceAudio(gameState, settingsRef.current, myPlayer, player, audio);
				if (connectionStuff.current.deafened || playerConfigs[player.nameHash]?.isMuted) {
					gain = 0;
				}

				if (gain > 0) {
					const playerVolume = playerConfigs[player.nameHash]?.volume;
					gain = playerVolume === undefined ? gain : gain * playerVolume;

					if (myPlayer.isDead && !player.isDead) {
						gain = gain * (settings.crewVolumeAsGhost / 100);
					}
					gain = gain * (settings.masterVolume / 100);
				}
				setSmoothedGain(audio.gain, gain);
				tempTalking[player.clientId] = gain > 0 && Boolean(serverVadTalking || localPeerTalking);
				if (tempTalking[player.clientId] != otherTalking[player.clientId]) {
					talkingUpdate = true;
				}
			} else if (tempTalking[player.clientId]) {
				tempTalking[player.clientId] = false;
				talkingUpdate = true;
			}
		}
		if (talkingUpdate) {
			setOtherTalking(tempTalking);
		}

		if (
			((!foundRadioUser && impostorRadioClientId.current !== myPlayer.clientId) || !myPlayer.isImpostor) &&
			impostorRadioClientId.current !== -1
		) {
			impostorRadioClientId.current = -1;
		}
		for (const peerId of Object.keys(audioElements.current).filter((e) => !handledPeerIds.includes(e))) {
			const audio = audioElements.current[peerId];
			if (audio && audio.gain) {
				setSmoothedGain(audio.gain, 0);
			}
			// maybe disconnect later
		}

		return otherPlayers;
	}, [clientAudioActivity, clientConnections, gameState, lobbySettings, myPlayer, otherTalking, otherVAD, settings]);

	// Connect to P2P negotiator, when lobby and connect code change
	useEffect(() => {
		if (connect?.connect) {
			connect.connect(gameState?.lobbyCode ?? 'MENU', myPlayer?.id ?? 0, gameState.clientId, resolvedIsHost);
			updateLobby();
		}
	}, [connect?.connect, gameState?.lobbyCode, gameState.clientId, myPlayer?.id, connected, resolvedIsHost]);

	useEffect(() => {
		if (myPlayer?.shiftedColor != -1) {
			connectionStuff.current.socket?.emit('VAD', false);
			setTalking(false)
		}
	}, [myPlayer?.shiftedColor])

	useEffect(() => {
		if (myPlayer?.shiftedColor == -1 || !talking)
			connectionStuff.current.socket?.emit('VAD', talking);
	}, [talking])

	// Connect to P2P negotiator, when game mode change
	useEffect(() => {
		if (
			connect?.connect &&
			gameState.lobbyCode &&
			myPlayer?.clientId !== undefined &&
			gameState.gameState === GameState.LOBBY &&
			(gameState.oldGameState === GameState.DISCUSSION || gameState.oldGameState === GameState.TASKS)
		) {
			hostRef.current.mobileRunning = false;
			connect.connect(gameState.lobbyCode, myPlayer.id, gameState.clientId, resolvedIsHost);
		} else if (
			gameState.oldGameState !== GameState.UNKNOWN &&
			gameState.oldGameState !== GameState.MENU &&
			gameState.gameState === GameState.MENU
		) {
			console.log('DISCONNECT TO MENU!');
			// On change from a game to menu, exit from the current game properly
			hostRef.current.mobileRunning = false; // On change from a game to menu, exit from the current game properly
			resetServerHost();
			setClientAudioActivity({});
			connectionStuff.current.socket?.emit('leave');
			Object.keys(peerConnectionsRef.current).forEach((k) => {
				disconnectPeer(k);
			});
			setOtherDead({});
		}
	}, [gameState.gameState]);

	// Emit player id to socket
	useEffect(() => {
		if (connectionStuff.current.socket && myPlayer && myPlayer.clientId !== undefined) {
			connectionStuff.current.socket.emit('id', myPlayer.id, gameState.clientId);
		}
	}, [myPlayer?.id, myPlayer?.clientId]);

	// Pass voice state to overlay
	useEffect(() => {
		if (!settings.enableOverlay) {
			return;
		}
		bridge.send(IpcMessages.SEND_TO_OVERLAY, IpcOverlayMessages.NOTIFY_VOICE_STATE_CHANGED, currentOverlayVoiceState);
	}, [
		settings.enableOverlay,
		currentOverlayVoiceState,
	]);

	return (
		<div className={classes.root}>
			{(error || initialError) && (
				<div className={classes.error}>
					<Typography align="center" variant="h6" color="error">
						ERROR
					</Typography>
					<Typography align="center" style={{ whiteSpace: 'pre-wrap' }}>
						{error}
						{initialError}
					</Typography>
					<SupportLink />
				</div>
			)}
			{(!error && !initialError) && (<>

				<div className={classes.top}>
					{myPlayer && gameState.lobbyCode !== 'MENU' && (
						<>
							<div className={classes.avatarWrapper}>
								<Avatar
									deafened={deafenedState}
									muted={mutedState}
									player={myPlayer}
									borderColor={myPlayer?.shiftedColor == -1 ? '#2ecc71' : 'gray'}
									connectionState={connected ? 'connected' : 'disconnected'}
									isUsingRadio={myPlayer?.isImpostor && impostorRadioClientId.current === myPlayer.clientId}
									talking={talking}
									isAlive={!myPlayer.isDead}
									size={100}
									mod={gameState.mod}
								/>
							</div>
						</>
					)}
					<div className={classes.right}>
						<div>
							<div className={classes.left}>
								{myPlayer && gameState?.gameState !== GameState.MENU && (
									<span className={classes.username}>{myPlayer.name}</span>
								)}
								<span
									className={classes.code}
									style={{
										background: gameState.lobbyCode === 'MENU' ? 'transparent' : '#3e4346',
									}}
								>
									{displayedLobbyCode === 'MENU' ? t('game.menu') : displayedLobbyCode}
								</span>
							</div>
							{gameState.lobbyCode !== 'MENU' && (
								<div className={classes.muteButtons}>
									<IconButton onClick={connectionStuff.current.toggleMute} size="small">
										{mutedState || deafenedState ? <MicOff /> : <Mic />}
									</IconButton>
									<IconButton onClick={connectionStuff.current.toggleDeafen} size="small">
										{deafenedState ? <VolumeOff /> : <VolumeUp />}
									</IconButton>
								</div>
							)}
						</div>
					</div>
				</div>
				{lobbySettings.deadOnly && (
					<div className={classes.top}>
						<small style={{ padding: 0 }}>{t('settings.lobbysettings.ghost_only_warning2')}</small>
					</div>
				)}
				{lobbySettings.meetingGhostOnly && (
					<div className={classes.top}>
						<small style={{ padding: 0 }}>{t('settings.lobbysettings.meetings_only_warning2')}</small>
					</div>
				)}
				{gameState.lobbyCode && <Divider />}
				{displayedLobbyCode === 'MENU' && (
					<div className={classes.top}>
						<Button
							style={{ margin: '10px' }}
							onClick={() => {
								bridge.send(IpcHandlerMessages.OPEN_LOBBYBROWSER);
							}}
							color="primary"
							variant="outlined"
						>
							{t('buttons.public_lobby')}
						</Button>
					</div>
				)}
				{myPlayer && gameState.lobbyCode !== 'MENU' && (
					<Grid
						container
						spacing={1}
						className={classes.otherplayers}
						alignItems="flex-start"
						alignContent="flex-start"
						justifyContent="flex-start"
					>
						{otherPlayers.map((player) => {
							const clientConnection = clientConnections[player.clientId];
							const connected = clientConnection?.connected || false;
							const audio = clientConnection?.audioConnected || false;

							if (!playerConfigs[player.nameHash]) {
								playerConfigs[player.nameHash] = { volume: 1, isMuted: false };
							}
							const socketConfig = playerConfigs[player.nameHash];

							return (
								<Grid item key={player.id} xs={getPlayersPerRow(otherPlayers.length)}>
									<Avatar
										connectionState={!connected ? 'disconnected' : audio ? 'connected' : 'novoice'}
										player={player}
										talking={!player.inVent && otherTalking[player.clientId]}
										borderColor="#2ecc71"
										isAlive={!otherDead[player.clientId]}
										isUsingRadio={
											myPlayer?.isImpostor &&
											!(player.disconnected || player.bugged) &&
											impostorRadioClientId.current === player.clientId
										}
										size={50}
										socketConfig={socketConfig}
										onConfigChange={() => setSetting(`playerConfigMap.${player.nameHash}`, playerConfigs[player.nameHash])}
										mod={gameState.mod}
									/>
								</Grid>
							);
						})}
					</Grid>
				)}
			</>)}
		</div>
	);
};

type ValidPlayersPerRow = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
function getPlayersPerRow(playerCount: number): ValidPlayersPerRow {
	if (playerCount <= 9) return (12 / 3) as ValidPlayersPerRow;
	else return Math.min(12, Math.floor(12 / Math.ceil(Math.sqrt(playerCount)))) as ValidPlayersPerRow;
}

export default Voice;

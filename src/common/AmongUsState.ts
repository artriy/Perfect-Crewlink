import { CameraLocation, MapType } from './AmongusMap';
import { ModsType } from './Mods';

export interface AmongUsState {
	gameState: GameState;
	oldGameState: GameState;
	lobbyCodeInt: number;
	lobbyCode: string;
	players: Player[];
	isHost: boolean;
	clientId: number;
	hostId: number;
	comsSabotaged: boolean;
	currentCamera: CameraLocation;
	map: MapType;
	lightRadius: number;
	lightRadiusChanged: boolean;
	closedDoors: number[];
	currentServer: string;
	currentServerLabel: string;
	maxPlayers: number;
	mod: ModsType;
	oldMeetingHud: boolean;
	meetingHud?: MeetingHud | null;
}

export interface MeetingHud {
	state: number;
	source: string;
	oldHud: boolean;
	cards: MeetingHudCard[];
}

export interface MeetingHudCard {
	slotIndex: number;
	playerId: number;
	clientId?: number | null;
	visible: boolean;
	amDead: boolean;
	worldX?: number | null;
	worldY?: number | null;
	worldZ?: number | null;
	width?: number | null;
	height?: number | null;
}

export interface Player {
	ptr: number;
	id: number;
	clientId: number;
	name: string;
	nameHash: number;
	colorId: number;
	hatId: string;
	petId: number;
	skinId: string;
	visorId: string;
	disconnected: boolean;
	isImpostor: boolean;
	isDead: boolean;
	taskPtr: number;
	objectPtr: number;
	isLocal: boolean;
	shiftedColor : number;
	bugged: boolean;
	x: number;
	y: number;
	inVent: boolean;
	isDummy: boolean;
}

export enum GameState {
	LOBBY,
	TASKS,
	DISCUSSION,
	MENU,
	UNKNOWN,
}

export interface Client {
	playerId: number;
	clientId: number;
}
export interface SocketClientMap {
	[socketId: string]: Client;
}
export interface ClientBoolMap {
	[clientId: number]: boolean; // isTalking
}

export interface AudioConnected {
	[peer: string]: boolean; // isConnected
}

export interface numberStringMap {
	[index: number]: string;
}

export interface ClientConnectionState {
	clientId: number;
	socketId: string | null;
	connected: boolean;
	audioConnected: boolean;
	lastSeenAt: number;
	lastAudioAt: number;
}

export interface ClientConnectionMap {
	[clientId: number]: ClientConnectionState;
}

export interface VoiceState {
	otherTalking: ClientBoolMap;
	otherDead: ClientBoolMap;
	clientConnections: ClientConnectionMap;
	impostorRadioClientId: number;
	localTalking: boolean;
	localIsAlive: boolean;
	muted: boolean;
	deafened: boolean;
	mod: ModsType;
}

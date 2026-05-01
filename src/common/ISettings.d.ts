import { GamePlatform } from './GamePlatform';

export interface ISettings {
	alwaysOnTop: boolean;
	language: string;
	microphone: string;
	speaker: string;
	pushToTalkMode: number;
	serverURL: string;
	pushToTalkShortcut: string;
	deafenShortcut: string;
	muteShortcut: string;
	impostorRadioShortcut: string;
	hideCode: boolean;
	natFix: boolean;
	compactOverlay: boolean;
	alwaysShowOverlayPlayers: boolean;
	ignoreIncompatibleLobbyBrowserMods: boolean;
	overlayPosition: string;
	enableOverlay: boolean;
	meetingOverlay: boolean;
	aleLuduMode: boolean;
	startMuted: boolean;
	startDeafened: boolean;

	localLobbySettings: ILobbySettings;
	ghostVolumeAsImpostor: number;
	crewVolumeAsGhost: number;
	masterVolume: number;
	microphoneGain: number;
	microphoneGainEnabled: boolean;
	micSensitivity: number;
	micSensitivityEnabled: boolean;
	mobileHost: boolean;
	vadEnabled: boolean;
	hardware_acceleration: boolean;
	echoCancellation: boolean;
	noiseSuppression: boolean;
	oldSampleDebug: boolean;
	debugMode: boolean;

	enableSpatialAudio: boolean;
	oldSampleDebug: boolean;
	playerConfigMap: playerConfigMap;
	obsOverlay: boolean;
	obsSecret: string | undefined;

	launchPlatform: GamePlatform | string;
	customPlatforms: GamePlatformMap;

}

export interface AleLuduColumnTuning {
	// Horizontal center of this column, as % of tablet width
	centerPct: number;
	// Width of each card in this column, as % of tablet width
	widthPct: number;
	// Vertical center of the first (top) card, as % of tablet height
	row0CenterPct: number;
	// Height of each card in this column, as % of tablet height
	rowHeight: number;
	// Gap between cards in this column, as % of tablet height
	rowGap: number;
}

export interface AleLuduTuning {
	// Legacy global tile layout — used as fallback when per-column values are missing
	col0CenterPct: number;
	colPitchPct: number;
	colWidthPct: number;
	row0CenterPct: number;
	rowHeight: number;
	rowGap: number;
	showDebug: boolean;

	// Per-column independent tuning (one entry per visible column).
	// When present, each column's card positions and sizes are driven by its own entry
	// instead of the legacy col0CenterPct/colPitchPct/colWidthPct/... fields.
	columns: AleLuduColumnTuning[];

	// Meeting HUD rect — absolute % of viewport
	mhLeftPct: number;
	mhTopPct: number;
	mhWidthPct: number;
	mhHeightPct: number;

	// Tablet container rect — % of meetingHud
	tabletLeftPct: number;
	tabletTopPct: number;
	tabletWidthPct: number;
	tabletHeightPct: number;
}

export interface ILobbySettings {
	maxDistance: number;
	visionHearing: boolean;
	haunting: boolean;
	hearImpostorsInVents: boolean;
	impostersHearImpostersInvent: boolean;
	impostorRadioEnabled: boolean;
	commsSabotage: boolean;
	deadOnly: boolean;
	meetingGhostOnly: boolean;
	hearThroughCameras: boolean;
	wallsBlockAudio: boolean;
	publicLobby_on: boolean;
	publicLobby_title: string;
	publicLobby_language: string;
}

export interface SocketConfig {
	volume: number;
	isMuted: boolean;
}

export interface playerConfigMap {
	[socketId: number]: SocketConfig;
}

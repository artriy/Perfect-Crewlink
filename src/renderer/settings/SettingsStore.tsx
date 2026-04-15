import { GamePlatform } from '../../common/GamePlatform';
import { AleLuduColumnTuning, AleLuduTuning, ILobbySettings, ISettings, SocketConfig } from '../../common/ISettings';

// Number of rendered columns in the AleLudu meeting layout. Matches ALE_LUDU_COLUMNS in Overlay.tsx.
export const ALE_LUDU_COLUMN_COUNT = 4;

// Hand-calibrated per-column defaults from the live overlay session — centres are
// non-uniform so derive-from-pitch would miss by ~1%. Must stay in sync with
// BASE_ALE_LUDU_COLUMNS (Overlay.tsx) and DEFAULT_ALE_LUDU_COLUMN_TUNING (Settings.tsx).
const CALIBRATED_COLUMNS: AleLuduColumnTuning[] = [
	{ centerPct: 13.8, widthPct: 22.6, row0CenterPct: 5.0, rowHeight: 10.0, rowGap: 2.4 },
	{ centerPct: 38.3, widthPct: 22.5, row0CenterPct: 5.0, rowHeight: 10.0, rowGap: 2.4 },
	{ centerPct: 62.4, widthPct: 22.6, row0CenterPct: 5.0, rowHeight: 10.0, rowGap: 2.4 },
	{ centerPct: 86.9, widthPct: 22.6, row0CenterPct: 5.0, rowHeight: 10.0, rowGap: 2.4 },
];

function buildDefaultColumns(_base: Omit<AleLuduTuning, 'columns' | 'showDebug'>): AleLuduColumnTuning[] {
	// Return clones of the calibrated array (not the live one) so callers can mutate
	// without poisoning other callers. `_base` is accepted for signature compatibility
	// but intentionally unused — calibration centres beat derive-from-pitch.
	return CALIBRATED_COLUMNS.slice(0, ALE_LUDU_COLUMN_COUNT).map((c) => ({ ...c }));
}

function normalizeColumns(
	base: Omit<AleLuduTuning, 'columns' | 'showDebug'>,
	existing: Partial<AleLuduColumnTuning>[] | undefined
): AleLuduColumnTuning[] {
	const defaults = buildDefaultColumns(base);
	const out: AleLuduColumnTuning[] = [];
	for (let i = 0; i < ALE_LUDU_COLUMN_COUNT; i++) {
		const def = defaults[i];
		const src = existing?.[i];
		out.push({
			centerPct: typeof src?.centerPct === 'number' ? src.centerPct : def.centerPct,
			widthPct: typeof src?.widthPct === 'number' ? src.widthPct : def.widthPct,
			row0CenterPct: typeof src?.row0CenterPct === 'number' ? src.row0CenterPct : def.row0CenterPct,
			rowHeight: typeof src?.rowHeight === 'number' ? src.rowHeight : def.rowHeight,
			rowGap: typeof src?.rowGap === 'number' ? src.rowGap : def.rowGap,
		});
	}
	return out;
}

export enum pushToTalkOptions {
	VOICE,
	PUSH_TO_TALK,
	PUSH_TO_MUTE,
}

type ChangeListener = (newValue: ISettings, oldValue: ISettings) => void;

const STORAGE_KEY = 'perfectcrewlink.settings';
const LEGACY_STORAGE_KEYS = ['bettercrewlink.settings'];

const defaultSettings: ISettings = {
	alwaysOnTop: false,
	language: 'unkown',
	microphone: 'Default',
	speaker: 'Default',
	pushToTalkMode: pushToTalkOptions.VOICE,
	serverURL: 'https://bettercrewl.ink',
	pushToTalkShortcut: 'V',
	deafenShortcut: 'RControl',
	muteShortcut: 'RAlt',
	impostorRadioShortcut: 'F',
	hideCode: false,
	natFix: false,
	compactOverlay: false,
	alwaysShowOverlayPlayers: false,
	ignoreIncompatibleLobbyBrowserMods: true,
	overlayPosition: 'right',
	enableOverlay: true,
	meetingOverlay: true,
	aleLuduMode: false,
	startMuted: false,
	startDeafened: false,
	localLobbySettings: {
		maxDistance: 5.32,
		visionHearing: false,
		haunting: false,
		hearImpostorsInVents: false,
		impostersHearImpostersInvent: false,
		impostorRadioEnabled: false,
		commsSabotage: false,
		deadOnly: false,
		meetingGhostOnly: false,
		hearThroughCameras: false,
		wallsBlockAudio: false,
		publicLobby_on: false,
		publicLobby_title: '',
		publicLobby_language: 'en',
	},
	ghostVolumeAsImpostor: 10,
	crewVolumeAsGhost: 100,
	masterVolume: 100,
	microphoneGain: 100,
	microphoneGainEnabled: false,
	micSensitivity: 0.15,
	micSensitivityEnabled: false,
	mobileHost: true,
	vadEnabled: true,
	hardware_acceleration: true,
	echoCancellation: true,
	noiseSuppression: true,
	oldSampleDebug: false,
	enableSpatialAudio: true,
	playerConfigMap: {},
	obsOverlay: false,
	obsSecret: undefined,
	launchPlatform: GamePlatform.STEAM,
	customPlatforms: {},
	aleLuduTuning: ((): AleLuduTuning => {
		const base = {
			// Live-calibrated defaults from the in-game overlay session.
			// Per-column centres live in CALIBRATED_COLUMNS above; these single-knob
			// fields are the resolveColumnTuning fallback for pre-per-column configs.
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
		return {
			...base,
			showDebug: false,
			columns: buildDefaultColumns(base),
		};
	})(),
};

function normalizeSettings(input: Partial<ISettings> | null | undefined): ISettings {
	const merged = {
		...defaultSettings,
		...(input ?? {}),
		localLobbySettings: {
			...defaultSettings.localLobbySettings,
			...(input?.localLobbySettings ?? {}),
		},
		playerConfigMap: {
			...defaultSettings.playerConfigMap,
			...(input?.playerConfigMap ?? {}),
		},
		customPlatforms: {
			...defaultSettings.customPlatforms,
			...(input?.customPlatforms ?? {}),
		},
		aleLuduTuning: (() => {
			const merged = {
				...defaultSettings.aleLuduTuning,
				...(input?.aleLuduTuning ?? {}),
			};
			merged.columns = normalizeColumns(merged, input?.aleLuduTuning?.columns);
			return merged;
		})(),
	};

	if (typeof merged.serverURL === 'string' && merged.serverURL.includes('//crewl.ink')) {
		merged.serverURL = 'https://bettercrewl.ink';
	}

	if (merged.micSensitivity >= 0.3) {
		merged.micSensitivity = 0.15;
		merged.micSensitivityEnabled = false;
	}

	return merged;
}

function deepClone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function readStoredSettings(): ISettings {
	if (typeof window === 'undefined' || !window.localStorage) {
		return deepClone(defaultSettings);
	}

	try {
		const raw =
			window.localStorage.getItem(STORAGE_KEY) ??
			LEGACY_STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean) ??
			null;
		if (!raw) {
			return deepClone(defaultSettings);
		}
		return normalizeSettings(JSON.parse(raw) as Partial<ISettings>);
	} catch {
		return deepClone(defaultSettings);
	}
}

function writeStoredSettings(settings: ISettings) {
	if (typeof window === 'undefined' || !window.localStorage) {
		return;
	}
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function setNestedValue(target: Record<string, unknown>, path: string, value: unknown) {
	const keys = path.split('.');
	let current: Record<string, unknown> = target;
	for (let index = 0; index < keys.length - 1; index++) {
		const key = keys[index];
		if (typeof current[key] !== 'object' || current[key] === null) {
			current[key] = {};
		}
		current = current[key] as Record<string, unknown>;
	}
	current[keys[keys.length - 1]] = value;
}

class RendererSettingsStore {
	private listeners = new Set<ChangeListener>();
	private state: ISettings = readStoredSettings();

	get store(): ISettings {
		return this.state;
	}

	get<K extends keyof ISettings>(key: K, fallback?: ISettings[K]): ISettings[K] {
		return this.state[key] ?? (fallback as ISettings[K]);
	}

	set(path: string, value: unknown) {
		const previous = this.state;
		const next = deepClone(this.state) as unknown as Record<string, unknown>;
		setNestedValue(next, path, value);
		this.state = normalizeSettings(next as Partial<ISettings>);
		writeStoredSettings(this.state);
		for (const listener of this.listeners) {
			listener(this.state, previous);
		}
	}

	clear() {
		const previous = this.state;
		this.state = deepClone(defaultSettings);
		writeStoredSettings(this.state);
		for (const listener of this.listeners) {
			listener(this.state, previous);
		}
	}

	onDidAnyChange(listener: ChangeListener) {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
}

export const SettingsStore = new RendererSettingsStore();

type ISettingOrSocketConfig<K extends keyof ISettings | `playerConfigMap.${number}`> = K extends keyof ISettings
	? ISettings[K]
	: SocketConfig;

export const setSetting = <K extends keyof ISettings | `playerConfigMap.${number}`>(
	setting: K,
	value: ISettingOrSocketConfig<K>
) => {
	SettingsStore.set(setting, value);
};

export const setLobbySetting = <K extends keyof ILobbySettings>(setting: K, value: ILobbySettings[K]) => {
	SettingsStore.set(`localLobbySettings.${setting}`, value);
};

export default SettingsStore;

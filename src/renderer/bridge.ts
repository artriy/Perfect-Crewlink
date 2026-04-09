import { openUrl } from '@tauri-apps/plugin-opener';
import { emitTo, listen } from '@tauri-apps/api/event';
import { getHostPlatform, getMigrationStatus } from '../common/tauri-api';
import { startGameSession, getInitialGameState, getCurrentMod } from '../common/tauri-game';
import { resetHotkeys } from '../common/tauri-hotkeys';
import { launchAmongUs } from '../common/tauri-launcher';
import { openLobbyBrowser, setOverlayEnabled } from '../common/tauri-overlay';
import { getSystemLocale, triggerAppUpdate } from '../common/tauri-system';
import { hideWindow, minimizeWindow, quitApp, relaunchApp, setAlwaysOnTop, showWindow } from '../common/tauri-window';
import SettingsStore from './settings/SettingsStore';

type Listener = (...args: unknown[]) => void;

type ListenerMap = Map<string, Set<Listener>>;
type WindowLabel = 'main' | 'overlay' | 'lobbies' | 'unknown';

const listeners: ListenerMap = new Map();
const nativeEventState = new Map<string, unknown>();
const overlayEventState = new Map<string, unknown>();
const mainWindowEventState = new Map<string, unknown>();
const nativeListeners = new Set<string>();

function getCurrentWindowLabel(): WindowLabel {
	if (typeof window === 'undefined') {
		return 'unknown';
	}

	const label = (window as typeof window & {
		__TAURI_INTERNALS__?: {
			metadata?: {
				currentWindow?: {
					label?: string;
				};
			};
		};
	}).__TAURI_INTERNALS__?.metadata?.currentWindow?.label;

	if (label === 'main' || label === 'overlay' || label === 'lobbies') {
		return label;
	}

	return 'unknown';
}

function getListeners(event: string): Set<Listener> {
	let set = listeners.get(event);
	if (!set) {
		set = new Set();
		listeners.set(event, set);
	}
	return set;
}

function emit(event: string, ...args: unknown[]) {
	for (const listener of getListeners(event)) {
		listener(undefined, ...args);
	}
}

function ensureNativeListener(event: string) {
	if (nativeListeners.has(event)) {
		return;
	}

	nativeListeners.add(event);
	void listen(event, (nativeEvent) => {
		nativeEventState.set(event, nativeEvent.payload);
		emit(event, nativeEvent.payload);
	}).catch(() => {
		nativeListeners.delete(event);
	});
}

export const bridge = {
	openExternal(url: string) {
		return openUrl(url);
	},
	send(event: string, ...args: unknown[]) {
		if (event === 'reload') {
			window.location.reload();
			return;
		}
		if (event === 'minimize') {
			const [isLobbyBrowser] = args;
			void minimizeWindow(isLobbyBrowser ? 'lobbies' : 'main');
			return;
		}
		if (event === 'hideWindow') {
			const [isLobbyBrowser] = args;
			void hideWindow(isLobbyBrowser ? 'lobbies' : 'main');
			return;
		}
		if (event === 'showWindow') {
			const [label] = args;
			void showWindow(typeof label === 'string' ? label : 'main');
			return;
		}
		if (event === 'update-app') {
			void triggerAppUpdate();
			return;
		}
		if (event === 'enableOverlay') {
			const [enabled] = args;
			void setOverlayEnabled(Boolean(enabled));
			return;
		}
		if (event === 'setAlwaysOnTop') {
			const [enabled] = args;
			void setAlwaysOnTop(Boolean(enabled));
			return;
		}
		if (event === 'relaunch') {
			void relaunchApp();
			return;
		}
		if (event === 'QUIT_CREWLINK') {
			void quitApp();
			return;
		}
		if (event === 'SEND_TO_OVERLAY') {
			const [overlayEvent, payload] = args;
			const overlayEventName = String(overlayEvent);
			overlayEventState.set(overlayEventName, payload);
			void emitTo('overlay', overlayEventName, payload).catch(() => {
				/* empty */
			});
			return;
		}
		if (event === 'SEND_TO_MAINWINDOW') {
			const [mainEvent, payload] = args;
			const mainEventName = String(mainEvent);
			mainWindowEventState.set(mainEventName, payload);
			void emitTo('main', mainEventName, payload).catch(() => {
				/* empty */
			});
			return;
		}
		if (event === 'OPEN_AMONG_US_GAME') {
			const [platform] = args;
			void launchAmongUs(platform as never);
			return;
		}
		if (event === 'OPEN_LOBBYBROWSER') {
			void openLobbyBrowser();
			return;
		}
		if (event === 'RESET_KEYHOOKS') {
			const [config] = args;
			const effectiveConfig =
				config ??
				({
					pushToTalkShortcut: SettingsStore.get('pushToTalkShortcut'),
					deafenShortcut: SettingsStore.get('deafenShortcut'),
					muteShortcut: SettingsStore.get('muteShortcut'),
					impostorRadioShortcut: SettingsStore.get('impostorRadioShortcut'),
				} as const);
			void resetHotkeys(effectiveConfig as never);
			return;
		}
	},
	async invoke<T>(event: string): Promise<T> {
		if (event === 'get_host_platform') {
			return (await getHostPlatform()) as T;
		}
		if (event === 'get_migration_status') {
			return (await getMigrationStatus()) as T;
		}
		if (event === 'getlocale') {
			return (await getSystemLocale()) as T;
		}
		if (event === 'start_game_session') {
			return (await startGameSession()) as T;
		}
		if (event === 'get_initial_game_state') {
			return (await getInitialGameState()) as T;
		}
		if (event === 'REQUEST_MOD') {
			return (await getCurrentMod()) as T;
		}
		return undefined as T;
	},
	sendSync(event: string) {
		if (event === 'GET_INITIAL_STATE') {
			return nativeEventState.get('NOTIFY_GAME_STATE_CHANGED') ?? overlayEventState.get('NOTIFY_GAME_STATE_CHANGED') ?? null;
		}
		return null;
	},
	on(event: string, listener: Listener) {
		getListeners(event).add(listener);
		ensureNativeListener(event);

		if (nativeEventState.has(event)) {
			listener(undefined, nativeEventState.get(event));
			return;
		}

		const currentWindow = getCurrentWindowLabel();
		if (currentWindow === 'overlay' && overlayEventState.has(event)) {
			listener(undefined, overlayEventState.get(event));
			return;
		}

		if (currentWindow === 'main' && mainWindowEventState.has(event)) {
			listener(undefined, mainWindowEventState.get(event));
		}
	},
	off(event: string, listener: Listener) {
		getListeners(event).delete(listener);
	},
};

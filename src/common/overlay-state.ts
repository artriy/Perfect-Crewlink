export const OVERLAY_STATE_KEYS = {
	gameState: 'bettercrewlink.overlay.gameState',
	voiceState: 'bettercrewlink.overlay.voiceState',
	settings: 'bettercrewlink.overlay.settings',
	playerColors: 'bettercrewlink.overlay.playerColors',
} as const;

export function writeOverlayState<T>(key: string, value: T): void {
	if (typeof window === 'undefined' || !window.localStorage) {
		return;
	}

	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Ignore storage write failures and keep the event path alive.
	}
}

export function readOverlayState<T>(key: string): T | null {
	if (typeof window === 'undefined' || !window.localStorage) {
		return null;
	}

	try {
		const rawValue = window.localStorage.getItem(key);
		return rawValue ? (JSON.parse(rawValue) as T) : null;
	} catch {
		return null;
	}
}

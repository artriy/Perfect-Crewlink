import { invoke } from '@tauri-apps/api/core';

export async function setOverlayEnabled(enabled: boolean): Promise<void> {
	await invoke('set_overlay_enabled', { enabled });
}

export async function openLobbyBrowser(): Promise<void> {
	await invoke('open_lobby_browser');
}

export async function closeLobbyBrowser(): Promise<void> {
	await invoke('close_lobby_browser');
}

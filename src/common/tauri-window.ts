import { invoke } from '@tauri-apps/api/core';

export async function quitApp(): Promise<void> {
	await invoke('quit_app');
}

export async function relaunchApp(): Promise<void> {
	await invoke('relaunch_app');
}

export async function minimizeWindow(label?: string): Promise<void> {
	await invoke('minimize_window', { label });
}

export async function hideWindow(label?: string): Promise<void> {
	await invoke('hide_window', { label });
}

export async function showWindow(label?: string): Promise<void> {
	await invoke('show_window', { label });
}

export async function setAlwaysOnTop(enabled: boolean): Promise<void> {
	await invoke('set_always_on_top', { enabled });
}

import { invoke } from '@tauri-apps/api/core';

export interface HotkeyConfig {
	pushToTalkShortcut: string;
	deafenShortcut: string;
	muteShortcut: string;
	impostorRadioShortcut: string;
}

export async function resetHotkeys(config: HotkeyConfig): Promise<void> {
	await invoke('reset_hotkeys', { config });
}

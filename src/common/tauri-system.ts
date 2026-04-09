import { invoke } from '@tauri-apps/api/core';

export async function getSystemLocale(): Promise<string> {
	return invoke<string>('get_system_locale');
}

export async function triggerAppUpdate(): Promise<void> {
	await invoke('trigger_app_update');
}

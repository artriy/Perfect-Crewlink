import { invoke } from '@tauri-apps/api/core';
import { GamePlatformInstance } from './GamePlatform';

export async function launchAmongUs(platform: GamePlatformInstance): Promise<void> {
	await invoke('launch_among_us_game', { platform });
}

import { invoke } from '@tauri-apps/api/core';
import { DefaultGamePlatforms, GamePlatformMap } from './GamePlatform';

export interface HostPlatformInfo {
	platform: string;
}

export async function getHostPlatformInfo(): Promise<HostPlatformInfo> {
	return invoke<HostPlatformInfo>('get_host_platform');
}

export async function getAvailablePlatforms(customPlatforms: GamePlatformMap): Promise<GamePlatformMap> {
	const host = await getHostPlatformInfo();
	const result: GamePlatformMap = {};

	if (host.platform === 'windows') {
		result.STEAM = DefaultGamePlatforms.STEAM;
		result.EPIC = DefaultGamePlatforms.EPIC;
		result.MICROSOFT = DefaultGamePlatforms.MICROSOFT;
	} else if (host.platform === 'linux') {
		result.STEAM = DefaultGamePlatforms.STEAM;
	}

	for (const [key, value] of Object.entries(customPlatforms)) {
		result[key] = value;
	}

	return result;
}

import { invoke } from '@tauri-apps/api/core';
import type { AmongUsState } from './AmongUsState';

export type GameSessionPhase = 'detached' | 'attaching' | 'warmup' | 'active' | 'recovering';

export interface GameSessionStatus {
	isGameOpen: boolean;
	phase: GameSessionPhase;
	state: AmongUsState | null;
}

export async function startGameSession(): Promise<GameSessionStatus> {
	return invoke<GameSessionStatus>('start_game_session');
}

export async function getInitialGameState(): Promise<AmongUsState | null> {
	return invoke<AmongUsState | null>('get_initial_game_state');
}

export async function getPlayerColors(): Promise<string[][]> {
	return invoke<string[][]>('get_player_colors');
}

export async function getCurrentMod(): Promise<string> {
	return invoke<string>('request_mod');
}

export async function getRegionAliases(): Promise<Record<string, string>> {
	return invoke<Record<string, string>>('get_region_aliases');
}

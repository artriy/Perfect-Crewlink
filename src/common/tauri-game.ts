import { invoke } from '@tauri-apps/api/core';
import type { AmongUsState } from './AmongUsState';

export interface GameSessionStatus {
	isGameOpen: boolean;
	state: AmongUsState | null;
}

export async function startGameSession(): Promise<GameSessionStatus> {
	return invoke<GameSessionStatus>('start_game_session');
}

export async function getInitialGameState(): Promise<AmongUsState | null> {
	return invoke<AmongUsState | null>('get_initial_game_state');
}

export async function getCurrentMod(): Promise<string> {
	return invoke<string>('request_mod');
}

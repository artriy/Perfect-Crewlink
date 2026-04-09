import { invoke } from '@tauri-apps/api/core';

export interface TauriMigrationStatus {
	status: string;
}

export interface TauriPlatformResult {
	platform: string;
}

export async function getMigrationStatus(): Promise<TauriMigrationStatus> {
	return invoke<TauriMigrationStatus>('get_migration_status');
}

export async function getHostPlatform(): Promise<TauriPlatformResult> {
	return invoke<TauriPlatformResult>('get_host_platform');
}

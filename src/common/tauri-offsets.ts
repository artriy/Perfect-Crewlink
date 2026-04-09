import { invoke } from '@tauri-apps/api/core';

export interface OffsetLookupResponse {
	lookup: unknown;
}

export interface OffsetsResponse {
	offsets: unknown;
}

export async function fetchOffsetLookupFromTauri(): Promise<OffsetLookupResponse> {
	return invoke<OffsetLookupResponse>('fetch_offset_lookup');
}

export async function fetchOffsetsFromTauri(is64Bit: boolean, filename: string, offsetsVersion: number): Promise<OffsetsResponse> {
	return invoke<OffsetsResponse>('fetch_offsets', {
		is64Bit,
		filename,
		offsetsVersion,
	});
}

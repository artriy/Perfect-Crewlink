import { getVersion } from '@tauri-apps/api/app';

let cachedVersion: string | null = null;
let pendingVersion: Promise<string> | null = null;

function getVersionFromLocation(): string {
	if (typeof window === 'undefined' || !window.location) {
		return '';
	}

	const query = new URLSearchParams(window.location.search.substring(1));
	return query.get('version') ?? '';
}

export function getInitialAppVersion(): string {
	return cachedVersion ?? getVersionFromLocation();
}

export async function getAppVersion(): Promise<string> {
	if (cachedVersion !== null) {
		return cachedVersion;
	}

	if (!pendingVersion) {
		pendingVersion = getVersion()
			.catch(() => getVersionFromLocation())
			.then((version) => {
				cachedVersion = version || '';
				pendingVersion = null;
				return cachedVersion;
			});
	}

	return pendingVersion;
}

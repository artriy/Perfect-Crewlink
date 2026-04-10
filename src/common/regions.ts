export const BUILTIN_REGION_LABELS: Record<string, string> = {
	'50.116.1.42': 'North America',
	'172.105.251.170': 'Europe',
	'139.162.111.196': 'Asia',
	'192.241.154.115': 'skeld.net',
	'185.7.80.9': 'TOU Master',
	'154.16.67.100': 'Modded (North America)',
	'78.47.142.18': 'Modded (Europe)',
};

function unique(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))];
}

export function getRegionLookupKeys(server: string | null | undefined): string[] {
	const trimmed = (server ?? '').trim();
	if (!trimmed) {
		return [];
	}

	const lowered = trimmed.toLowerCase();
	const aliases = [trimmed, lowered];
	const withoutTrailingSlash = lowered.replace(/\/+$/, '');
	aliases.push(withoutTrailingSlash);

	if (withoutTrailingSlash.startsWith('http://') || withoutTrailingSlash.startsWith('https://')) {
		const withoutScheme = withoutTrailingSlash.replace(/^https?:\/\//, '');
		aliases.push(withoutScheme);

		try {
			const parsed = new URL(withoutTrailingSlash);
			const host = parsed.hostname.toLowerCase();
			const hostWithPort = parsed.port ? `${host}:${parsed.port}` : host;
			aliases.push(host);
			aliases.push(hostWithPort);
			if (host.startsWith('www.')) {
				aliases.push(host.slice(4));
			}
		} catch {
			/* empty */
		}
	}

	return unique(aliases);
}

export function buildRegionAliasMap(
	...sources: Array<Record<string, string> | null | undefined>
): Record<string, string> {
	const aliases: Record<string, string> = {};

	for (const source of sources) {
		if (!source) {
			continue;
		}

		for (const [rawKey, label] of Object.entries(source)) {
			const normalizedLabel = label?.trim();
			if (!normalizedLabel) {
				continue;
			}

			for (const key of getRegionLookupKeys(rawKey)) {
				aliases[key] = normalizedLabel;
			}
		}
	}

	return aliases;
}

const DEFAULT_REGION_ALIASES = buildRegionAliasMap(BUILTIN_REGION_LABELS);

export function resolveRegionLabel(
	server: string | null | undefined,
	customAliases?: Record<string, string>
): string {
	const trimmed = (server ?? '').trim();
	if (!trimmed) {
		return 'Unknown Region';
	}

	const aliases = customAliases
		? buildRegionAliasMap(BUILTIN_REGION_LABELS, customAliases)
		: DEFAULT_REGION_ALIASES;

	for (const key of getRegionLookupKeys(trimmed)) {
		if (aliases[key]) {
			return aliases[key];
		}
	}

	return trimmed;
}

const browserGlobal = globalThis as typeof globalThis & {
	global?: typeof globalThis;
};

browserGlobal.global ??= globalThis;

function getCurrentWindowLabel() {
	if (typeof window === 'undefined') {
		return 'unknown';
	}

	return (
		(window as typeof window & {
			__TAURI_INTERNALS__?: {
				metadata?: {
					currentWindow?: {
						label?: string;
					};
				};
			};
		}).__TAURI_INTERNALS__?.metadata?.currentWindow?.label ?? 'unknown'
	);
}

function renderBootstrapError(error: unknown) {
	const root = document.getElementById('app');
	if (!root) {
		return;
	}

	const message = error instanceof Error ? `${error.message}\n\n${error.stack ?? ''}` : String(error);
	const escapedMessage = message
		.split('&')
		.join('&amp;')
		.split('<')
		.join('&lt;')
		.split('>')
		.join('&gt;');
	root.innerHTML = `
		<div style="padding:16px;font-family:Segoe UI,Arial,sans-serif;color:#111;background:#fff;white-space:pre-wrap;">
			<h2 style="margin:0 0 12px;">BetterCrewLink failed to start</h2>
			<div>${escapedMessage}</div>
		</div>
	`;

	if (getCurrentWindowLabel() === 'main') {
		void import('../common/tauri-window')
			.then(({ showWindow }) => showWindow('main'))
			.catch(() => {
				// Ignore error-surface visibility failures during bootstrap.
			});
	}
}

if (typeof window !== 'undefined' && window.location) {
	const query = new URLSearchParams(window.location.search.substring(1));
	const tauriWindowLabel = getCurrentWindowLabel();
	const view =
		query.get('view') ||
		(tauriWindowLabel === 'lobbies' ? 'lobbies' : tauriWindowLabel === 'overlay' ? 'overlay' : 'app');

	const entry =
		view === 'app'
			? import('./App')
			: view === 'lobbies'
				? import('./LobbyBrowser/LobbyBrowserContainer')
				: import('./Overlay');

	void entry.catch((error) => {
		console.error('Bootstrap failure', error);
		renderBootstrapError(error);
	});
}

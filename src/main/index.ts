export const tauriMigrationStatus = {
	phase: 1,
	status: 'shell-replaced',
	notes: [
		'Electron main-process boot has been retired in favor of a Tauri app shell.',
		'Window lifecycle, updater, overlay attachment, and IPC wiring will be reintroduced through src-tauri in later phases.',
		'Renderer feature modules remain in place for incremental porting.',
	],
};

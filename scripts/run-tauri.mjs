import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function cargoAvailable(env) {
	const probe = spawnSync(process.platform === 'win32' ? 'cargo.exe' : 'cargo', ['--version'], {
		env,
		stdio: 'ignore',
	});
	return probe.status === 0;
}

function buildEnv() {
	const env = { ...process.env };
	const currentPath = env.Path ?? env.PATH ?? '';
	const nodeBin = path.dirname(process.execPath);
	const nextPath = currentPath
		.split(path.delimiter)
		.filter(Boolean);

	if (!nextPath.includes(nodeBin)) {
		nextPath.unshift(nodeBin);
	}

	const normalizedPath = nextPath.join(path.delimiter);
	env.Path = normalizedPath;
	env.PATH = normalizedPath;
	if (cargoAvailable(env)) {
		return env;
	}

	const candidateBins = [];
	if (env.CARGO_HOME) {
		candidateBins.push(path.join(env.CARGO_HOME, 'bin'));
	}
	candidateBins.push(path.join(os.homedir(), '.cargo', 'bin'));

	for (const binDir of candidateBins) {
		const cargoBinary = path.join(binDir, process.platform === 'win32' ? 'cargo.exe' : 'cargo');
		if (!existsSync(cargoBinary)) {
			continue;
		}

		const cargoPath = `${binDir}${path.delimiter}${normalizedPath}`;
		env.Path = cargoPath;
		env.PATH = cargoPath;
		break;
	}

	return env;
}

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, '..');
const cargoTargetDir = path.join(repoRoot, 'src-tauri', 'target');
const localTauriScript = path.join(repoRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
const args = process.argv.slice(2);
const env = buildEnv();
env.NODE = process.execPath;
env.npm_node_execpath = process.execPath;
env.CARGO_TARGET_DIR = cargoTargetDir;
const child = existsSync(localTauriScript)
	? spawn(process.execPath, [localTauriScript, ...args], {
			env,
			stdio: 'inherit',
		})
	: spawn(process.platform === 'win32' ? 'tauri.exe' : 'tauri', args, {
			env,
			stdio: 'inherit',
		});

child.on('exit', (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}
	process.exit(code ?? 1);
});

child.on('error', (error) => {
	console.error(error.message);
	process.exit(1);
});

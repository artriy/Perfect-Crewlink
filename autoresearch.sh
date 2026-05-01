#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")" && pwd)"
cd "$repo_root"

tmp_dir="${TMPDIR:-.}"
metrics_json="$tmp_dir/perfectcrewlink-pure-rust-metrics.json"

node - "$metrics_json" <<'NODE'
const fs = require('fs');
const path = require('path');

const outPath = process.argv[2];
const sourceExt = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.d.ts']);
const rootRuntimeFiles = [
  'package.json',
  'package-lock.json',
  'index.html',
  'vite.config.ts',
  'vite.halo.config.ts',
  'tsconfig.json',
  'tsconfig.halo.json',
];

function exists(p) {
  return fs.existsSync(p);
}

function read(p) {
  return exists(p) ? fs.readFileSync(p, 'utf8') : '';
}

function walk(dir, out = []) {
  if (!exists(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'target') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

const srcFiles = walk('src').filter((file) => sourceExt.has(path.extname(file)) || file.endsWith('.d.ts'));
const rootFiles = rootRuntimeFiles.filter(exists);
const nonRustRuntimeFiles = [...srcFiles, ...rootFiles];
const nonRustRuntimeLoc = nonRustRuntimeFiles.reduce((sum, file) => {
  const text = read(file);
  return sum + (text ? text.split(/\r?\n/).length : 0);
}, 0);

const overlay = read('src/renderer/Overlay.tsx');
const settings = read('src/renderer/settings/Settings.tsx') + '\n' + read('src/renderer/settings/SettingsStore.tsx');
const commonState = read('src/common/AmongUsState.ts');
const gameSession = read('src-tauri/src/game_session.rs');
const cargoToml = read('src-tauri/Cargo.toml');
const tauriConf = read('src-tauri/tauri.conf.json');
const pkg = read('package.json');

let highlightStaticFailures = 0;
let rustMeetingSourceFailures = 0;
let frontendSurfaceFailures = 0;
const failed = [];

function fail(bucket, name, ok) {
  if (ok) {
    console.log(`CHECK_PASS ${name}`);
    return;
  }
  failed.push(name);
  console.log(`CHECK_FAIL ${name}`);
  if (bucket === 'highlight') highlightStaticFailures += 1;
  else if (bucket === 'rust_meeting') rustMeetingSourceFailures += 1;
  else if (bucket === 'frontend') frontendSurfaceFailures += 1;
}

fail('highlight', 'overlay_not_using_hardcoded_aleludu_columns', !/const ALE_LUDU_COLUMNS\s*=\s*4/.test(overlay));
fail('highlight', 'overlay_not_using_base_aleludu_tuning_percentages', !/BASE_ALE_LUDU_TUNING|BASE_ALE_LUDU_COLUMNS/.test(overlay));
fail('highlight', 'overlay_no_aleludu_card_style_from_slot_percent_math', !/function getAleLuduCardStyle[\s\S]*?index % ALE_LUDU_COLUMNS/.test(overlay));
fail('highlight', 'overlay_no_screen_ratio_meeting_size_guess', !/ratio_diff|iPadRatio|1\.192|1\.146|1\.591|1\.72|1\.96/.test(overlay));
fail('highlight', 'overlay_no_compacted_aleludu_render_player_filter', !/aleLuduRenderPlayers\s*=\s*renderPlayers\.filter/.test(overlay));
fail('highlight', 'overlay_consumes_rust_meeting_hud_cards', /gameState\.meetingHud|meetingHud\?\.cards|meetingHud\.cards/.test(overlay));
fail('highlight', 'settings_no_primary_aleludu_calibration_ui', !/AleLuduTuningPanel|aleLuduTuning/.test(settings));

fail('rust_meeting', 'rust_has_meeting_hud_snapshot_struct', /struct\s+MeetingHudSnapshot/.test(gameSession));
fail('rust_meeting', 'rust_has_meeting_hud_card_struct', /struct\s+MeetingHudCard/.test(gameSession));
fail('rust_meeting', 'rust_state_emits_meeting_hud_snapshot', /pub\s+meeting_hud\s*:\s*Option<MeetingHudSnapshot>|pub\s+meeting_hud\s*:\s*MeetingHudSnapshot/.test(gameSession));
fail('rust_meeting', 'rust_has_meeting_hud_reader_function', /fn\s+read_meeting_hud|fn\s+parse_meeting_hud|fn\s+read_meeting_cards/.test(gameSession));
fail('rust_meeting', 'rust_meeting_cards_include_player_identity', /player_id\s*:\s*u32/.test(gameSession) && /client_id\s*:\s*Option<u32>|client_id\s*:\s*u32/.test(gameSession));
fail('rust_meeting', 'rust_meeting_cards_include_card_rect_or_world_pos', /MeetingHudCard[\s\S]*(rect|world|x\s*:\s*f32)/.test(gameSession));
fail('rust_meeting', 'ts_state_has_temporary_meeting_hud_bridge', /meetingHud\??\s*:\s*MeetingHud|interface\s+MeetingHud/.test(commonState));

fail('frontend', 'package_no_react_runtime_dependency', !/"react"\s*:|"react-dom"\s*:|@mui\//.test(pkg));
fail('frontend', 'package_no_webrtc_js_runtime_dependency', !/"simple-peer"\s*:|"socket\.io-client"\s*:|"webrtc-adapter"\s*:/.test(pkg));
fail('frontend', 'tauri_build_not_driven_by_npm_vite', !/beforeBuildCommand"\s*:\s*"npm run build"|frontendDist"\s*:\s*"\.\.\/dist"|devUrl/.test(tauriConf));
fail('frontend', 'renderer_overlay_tsx_removed_or_non_runtime', !exists('src/renderer/Overlay.tsx'));
fail('frontend', 'renderer_voice_tsx_removed_or_rust_backed', !exists('src/renderer/Voice.tsx'));
fail('frontend', 'electron_legacy_main_ts_removed', !exists('src/main'));
fail('frontend', 'rust_frontend_or_native_ui_dependency_present', /dioxus|egui|eframe|iced|slint|leptos|yew|wry|webrtc|cpal|rodio/i.test(cargoToml));

const staticScore =
  nonRustRuntimeLoc +
  nonRustRuntimeFiles.length * 100 +
  highlightStaticFailures * 2000 +
  rustMeetingSourceFailures * 2000 +
  frontendSurfaceFailures * 1000;

fs.writeFileSync(outPath, JSON.stringify({
  nonRustRuntimeFiles: nonRustRuntimeFiles.length,
  nonRustRuntimeLoc,
  highlightStaticFailures,
  rustMeetingSourceFailures,
  frontendSurfaceFailures,
  staticScore,
  failed,
}, null, 2));
NODE

print_last_lines() {
	local log_file="$1"
	node -e "const fs = require('fs'); const p = process.argv[1]; const text = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; console.log(text.split(/\\r?\\n/).slice(-80).join('\\n'));" "$log_file"
}

cargo_log="$tmp_dir/perfectcrewlink-cargo-check.log"
set +e
cargo check --manifest-path src-tauri/Cargo.toml --quiet >"$cargo_log" 2>&1
cargo_status=$?
set -e
if [[ "$cargo_status" -ne 0 ]]; then
	echo "CARGO_CHECK_FAIL"
	print_last_lines "$cargo_log"
	cargo_check_fail=1
else
	echo "CARGO_CHECK_PASS"
	cargo_check_fail=0
fi

if [[ -f package.json ]]; then
	typecheck_log="$tmp_dir/perfectcrewlink-typecheck.log"
	set +e
	npm run typecheck --silent >"$typecheck_log" 2>&1
	typecheck_status=$?
	set -e
	if [[ "$typecheck_status" -ne 0 ]]; then
		echo "TYPECHECK_FAIL"
		print_last_lines "$typecheck_log"
		typecheck_fail=1
	else
		echo "TYPECHECK_PASS"
		typecheck_fail=0
	fi

	build_log="$tmp_dir/perfectcrewlink-vite-build.log"
	set +e
	npm run build --silent >"$build_log" 2>&1
	build_status=$?
	set -e
	if [[ "$build_status" -ne 0 ]]; then
		echo "BUILD_FAIL"
		print_last_lines "$build_log"
		build_fail=1
	else
		echo "BUILD_PASS"
		build_fail=0
	fi
else
	echo "TYPECHECK_SKIPPED_NO_PACKAGE_JSON"
	typecheck_fail=0
	echo "BUILD_SKIPPED_NO_PACKAGE_JSON"
	build_fail=0
fi

node - "$metrics_json" "$cargo_check_fail" "$typecheck_fail" "$build_fail" <<'NODE'
const fs = require('fs');
const [metricsPath, cargoFailRaw, typecheckFailRaw, buildFailRaw] = process.argv.slice(2);
const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
const cargoCheckFail = Number(cargoFailRaw);
const typecheckFail = Number(typecheckFailRaw);
const buildFail = Number(buildFailRaw);
const purityHighlightScore =
  metrics.staticScore + cargoCheckFail * 10000 + typecheckFail * 5000 + buildFail * 5000;
console.log(`METRIC purity_highlight_score_v2=${purityHighlightScore}`);
console.log(`METRIC non_rust_runtime_files=${metrics.nonRustRuntimeFiles}`);
console.log(`METRIC non_rust_runtime_loc=${metrics.nonRustRuntimeLoc}`);
console.log(`METRIC highlight_static_failures=${metrics.highlightStaticFailures}`);
console.log(`METRIC rust_meeting_source_failures=${metrics.rustMeetingSourceFailures}`);
console.log(`METRIC frontend_surface_failures=${metrics.frontendSurfaceFailures}`);
console.log(`METRIC cargo_check_fail=${cargoCheckFail}`);
console.log(`METRIC typecheck_fail=${typecheckFail}`);
console.log(`METRIC build_fail=${buildFail}`);
NODE

#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")" && pwd)"
cd "$repo_root"

node <<'NODE'
const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const lib = read('src-tauri/src/lib.rs');
const overlay = read('src/renderer/Overlay.tsx');
const voice = read('src/renderer/Voice.tsx');

let bugScore = 0;
function check(name, ok) {
  if (!ok) {
    bugScore += 1;
    console.log(`CHECK_FAIL ${name}`);
  } else {
    console.log(`CHECK_PASS ${name}`);
  }
}

check('overlay_visible_when_among_us_not_foreground', !/!\s*state\.is_foreground/.test(lib));
check('overlay_removed_unused_foreground_state', !/is_foreground/.test(lib) && !/GetForegroundWindow/.test(lib));
check('overlay_embeds_as_among_us_child', /SetParent/.test(lib) && /WS_CHILD/.test(lib) && /GetClientRect/.test(lib));
check('overlay_not_topmost_when_embedded', !/set_always_on_top\(true\)/.test(lib) && !/"alwaysOnTop": true/.test(read('src-tauri/tauri.conf.json')));
check('overlay_child_z_order_top', (() => {
  const start = lib.indexOf('fn set_overlay_child_styles');
  const end = start >= 0 ? lib.indexOf('fn embed_overlay_window', start) : -1;
  const styles = start >= 0 && end > start ? lib.slice(start, end) : '';
  const sizeBlock = styles.match(/if let Some\(size\) = size[\s\S]*?SWP_NOACTIVATE \| SWP_FRAMECHANGED/)?.[0] ?? '';
  return /Some\(HWND_TOP\)/.test(sizeBlock) && !/SWP_NOZORDER/.test(sizeBlock);
})());
const hideOverlayWindowStart = lib.indexOf('fn hide_overlay_window');
const hideOverlayWindowEnd = hideOverlayWindowStart >= 0 ? lib.indexOf('fn refresh_overlay_window', hideOverlayWindowStart) : -1;
const hideOverlayWindow = hideOverlayWindowStart >= 0 && hideOverlayWindowEnd > hideOverlayWindowStart ? lib.slice(hideOverlayWindowStart, hideOverlayWindowEnd) : '';
check('overlay_detaches_after_hide_without_forcing_visible', /window\.hide\(\)/.test(hideOverlayWindow) && /detach_overlay_window\(window\)/.test(hideOverlayWindow) && hideOverlayWindow.indexOf('window.hide()') < hideOverlayWindow.indexOf('detach_overlay_window(window)') && (lib.match(/hide_overlay_window\(&window\)/g)?.length ?? 0) >= 3 && !/let mut next_style = style \| WS_VISIBLE/.test(lib));
const overlayChildStylesStart = lib.indexOf('fn set_overlay_child_styles');
const overlayChildStylesEnd = overlayChildStylesStart >= 0 ? lib.indexOf('fn embed_overlay_window', overlayChildStylesStart) : -1;
const overlayChildStyles = overlayChildStylesStart >= 0 && overlayChildStylesEnd > overlayChildStylesStart ? lib.slice(overlayChildStylesStart, overlayChildStylesEnd) : '';
check('overlay_child_style_set_before_setparent', overlayChildStyles.indexOf('next_style |= WS_CHILD') >= 0 && overlayChildStyles.indexOf('next_style |= WS_CHILD') < overlayChildStyles.indexOf('SetParent(overlay_hwnd'));
check('overlay_detach_applies_framechanged', /if let Some\(size\) = size[\s\S]*?\} else \{[\s\S]*?SetWindowPos\([\s\S]*?SWP_NOMOVE \| SWP_NOSIZE \| SWP_NOZORDER \| SWP_NOACTIVATE \| SWP_FRAMECHANGED/.test(overlayChildStyles));
check('overlay_skips_redundant_setparent', /GetParent/.test(overlayChildStyles) && /current_parent != Some\(parent_hwnd\)/.test(overlayChildStyles) && /current_parent\.is_some\(\)/.test(overlayChildStyles));
check('meeting_order_frozen_for_all_huds', /frozenMeetingOrderRef/.test(overlay));
check('meeting_slot_count_uses_frozen_slots', /aleLuduSlotCount/.test(overlay));
check('meeting_freeze_allows_initial_roster_growth', /src\.length > frozenMeetingOrderRef\.current\.length/.test(overlay));
check('rejoin_uses_player_id_not_client_id', !/connect\.connect\(gameState\.lobbyCode,\s*myPlayer\.clientId/.test(voice));
check('spatial_audio_uses_top_down_axes', /setTopDownPanPosition/.test(voice) && !/pan\.positionY\.setValueAtTime\(panPos\[1\]/.test(voice));
check('stale_vad_cannot_overwrite_socket_mapping', /isStaleClientSocketUpdate/.test(voice));
const vadHandler = voice.match(/socket\.on\('VAD',[\s\S]*?\n\t\t\}\);/)?.[0] ?? '';
check('vad_uses_socket_mapped_client_id', /socketClientsRef\.current\[data\.socketId\]\?\.clientId \?\? data\.client\.clientId/.test(vadHandler) && /isStaleClientSocketUpdate\(vadClientId, data\.socketId\)/.test(vadHandler) && /\[vadClientId\]: data\.activity/.test(vadHandler) && /upsertClientConnection\(vadClientId/.test(vadHandler));
check('duplicate_client_socket_map_is_deduped', /preferSocketForClient/.test(voice) && /nextSocketIds\[client\.clientId\] !== socketId/.test(voice));
check('connect_refreshes_same_lobby_ids', /currentLobby === lobbyCode/.test(voice) && /socket\.emit\('id', playerId, clientId\)/.test(voice));
check('connect_effect_tracks_player_identity', /myPlayer\?\.id/.test(voice.match(/\}, \[connect\?\.connect[\s\S]*?\]\);/)?.[0] ?? '') && /gameState\.clientId/.test(voice.match(/\}, \[connect\?\.connect[\s\S]*?\]\);/)?.[0] ?? ''));
check('other_dead_tracks_player_updates', /\[gameState\.gameState, gameState\.players\]/.test(voice) && /let changed = false/.test(voice));
check('camera_audio_handles_missing_camera', /const cameras = AmongUsMaps\[state\.map\]\?\.cameras \?\? \{\}/.test(voice) && /if \(!camerapos\)/.test(voice));
check('talking_highlight_uses_recent_audio_guard', /REMOTE_AUDIO_TALKING_GRACE_MS/.test(voice) && /serverVadTalking/.test(voice));
check('overlay_visibilitychange_refreshes_when_hidden', !/document\.visibilityState === 'visible'/.test(overlay));
check('meeting_roster_growth_appends_without_reshuffle', /appendMissingMeetingPlayers/.test(overlay));
check('meeting_same_length_replacements_append', /hasMissingMeetingPlayers/.test(overlay));
check('meeting_missing_players_render_placeholders', /meetingPlaceholder/.test(overlay) && /player: Player \| null/.test(overlay));
check('talking_vad_requires_audio_state', !/!remoteAudioState/.test(voice.match(/const serverVadTalking[\s\S]*?\);/)?.[0] ?? ''));
check('talking_clears_when_audio_missing', /else if \(tempTalking\[player\.clientId\]\)/.test(voice));
const disconnectPeerStart = voice.indexOf('function disconnectPeer');
const disconnectPeerEnd = disconnectPeerStart >= 0 ? voice.indexOf('// Handle pushToTalk', disconnectPeerStart) : -1;
const disconnectPeerBody = disconnectPeerStart >= 0 && disconnectPeerEnd > disconnectPeerStart ? voice.slice(disconnectPeerStart, disconnectPeerEnd) : '';
const noConnectionStart = disconnectPeerBody.indexOf('if (!connection)');
const noConnectionReturn = noConnectionStart >= 0 ? disconnectPeerBody.indexOf('return;', noConnectionStart) : -1;
const noConnectionBranch = noConnectionStart >= 0 && noConnectionReturn > noConnectionStart ? disconnectPeerBody.slice(noConnectionStart, noConnectionReturn) : '';
check('disconnect_peer_cleans_audio_without_connection', /disconnectAudioElement\(peer\)/.test(noConnectionBranch));
const audioMonitorStart = voice.indexOf('function startPeerAudioMonitor');
const audioMonitorEnd = audioMonitorStart >= 0 ? voice.indexOf('function disconnectAudioElement', audioMonitorStart) : -1;
const audioMonitorBody = audioMonitorStart >= 0 && audioMonitorEnd > audioMonitorStart ? voice.slice(audioMonitorStart, audioMonitorEnd) : '';
check('audio_monitor_tracks_socket_mapped_client_id', /socketClientsRef\.current\[peer\]\?\.clientId \?\? monitor\.clientId/.test(audioMonitorBody) && /activeClientId !== monitor\.clientId/.test(audioMonitorBody) && /monitor\.clientId = activeClientId/.test(audioMonitorBody) && /updateClientAudioActivity\(monitor\.clientId/.test(audioMonitorBody) && !/updateClientAudioActivity\(clientId/.test(audioMonitorBody));

console.log(`METRIC static_bug_checks=${bugScore}`);
NODE

typecheck_log="${TMPDIR:-.}/perfectcrewlink-typecheck.log"
set +e
npm run typecheck --silent >"$typecheck_log" 2>&1
typecheck_status=$?
set -e
if [[ "$typecheck_status" -ne 0 ]]; then
	echo "TYPECHECK_FAIL"
	node -e "const fs = require('fs'); const p = process.argv[1]; const text = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; console.log(text.split(/\\r?\\n/).slice(-80).join('\\n'));" "$typecheck_log"
	typecheck_fail=1
else
	echo "TYPECHECK_PASS"
	typecheck_fail=0
fi

build_log="${TMPDIR:-.}/perfectcrewlink-vite-build.log"
set +e
npm run build --silent >"$build_log" 2>&1
build_status=$?
set -e
if [[ "$build_status" -ne 0 ]]; then
	echo "BUILD_FAIL"
	node -e "const fs = require('fs'); const p = process.argv[1]; const text = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; console.log(text.split(/\\r?\\n/).slice(-80).join('\\n'));" "$build_log"
	build_fail=1
else
	echo "BUILD_PASS"
	build_fail=0
fi

rust_log="${TMPDIR:-.}/perfectcrewlink-cargo-check.log"
set +e
cargo check --manifest-path src-tauri/Cargo.toml --quiet >"$rust_log" 2>&1
rust_status=$?
set -e
if [[ "$rust_status" -ne 0 ]]; then
	echo "RUST_CHECK_FAIL"
	node -e "const fs = require('fs'); const p = process.argv[1]; const text = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; console.log(text.split(/\\r?\\n/).slice(-80).join('\\n'));" "$rust_log"
	rust_check_fail=1
else
	echo "RUST_CHECK_PASS"
	rust_check_fail=0
fi

static_bug_checks=$(
	node <<'NODE'
const fs = require('fs');
const lib = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');
const overlay = fs.readFileSync('src/renderer/Overlay.tsx', 'utf8');
const voice = fs.readFileSync('src/renderer/Voice.tsx', 'utf8');
const checks = [
  !/!\s*state\.is_foreground/.test(lib),
  !/is_foreground/.test(lib) && !/GetForegroundWindow/.test(lib),
  /SetParent/.test(lib) && /WS_CHILD/.test(lib) && /GetClientRect/.test(lib),
  !/set_always_on_top\(true\)/.test(lib) && !/"alwaysOnTop": true/.test(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8')),
  (() => {
    const start = lib.indexOf('fn set_overlay_child_styles');
    const end = start >= 0 ? lib.indexOf('fn embed_overlay_window', start) : -1;
    const styles = start >= 0 && end > start ? lib.slice(start, end) : '';
    const sizeBlock = styles.match(/if let Some\(size\) = size[\s\S]*?SWP_NOACTIVATE \| SWP_FRAMECHANGED/)?.[0] ?? '';
    return /Some\(HWND_TOP\)/.test(sizeBlock) && !/SWP_NOZORDER/.test(sizeBlock);
  })(),
  (() => {
    const hideOverlayWindowStart = lib.indexOf('fn hide_overlay_window');
    const hideOverlayWindowEnd = hideOverlayWindowStart >= 0 ? lib.indexOf('fn refresh_overlay_window', hideOverlayWindowStart) : -1;
    const hideOverlayWindow = hideOverlayWindowStart >= 0 && hideOverlayWindowEnd > hideOverlayWindowStart ? lib.slice(hideOverlayWindowStart, hideOverlayWindowEnd) : '';
    return /window\.hide\(\)/.test(hideOverlayWindow) && /detach_overlay_window\(window\)/.test(hideOverlayWindow) && hideOverlayWindow.indexOf('window.hide()') < hideOverlayWindow.indexOf('detach_overlay_window(window)') && (lib.match(/hide_overlay_window\(&window\)/g)?.length ?? 0) >= 3 && !/let mut next_style = style \| WS_VISIBLE/.test(lib);
  })(),
  (() => {
    const overlayChildStylesStart = lib.indexOf('fn set_overlay_child_styles');
    const overlayChildStylesEnd = overlayChildStylesStart >= 0 ? lib.indexOf('fn embed_overlay_window', overlayChildStylesStart) : -1;
    const overlayChildStyles = overlayChildStylesStart >= 0 && overlayChildStylesEnd > overlayChildStylesStart ? lib.slice(overlayChildStylesStart, overlayChildStylesEnd) : '';
    return overlayChildStyles.indexOf('next_style |= WS_CHILD') >= 0 && overlayChildStyles.indexOf('next_style |= WS_CHILD') < overlayChildStyles.indexOf('SetParent(overlay_hwnd');
  })(),
  (() => {
    const overlayChildStylesStart = lib.indexOf('fn set_overlay_child_styles');
    const overlayChildStylesEnd = overlayChildStylesStart >= 0 ? lib.indexOf('fn embed_overlay_window', overlayChildStylesStart) : -1;
    const overlayChildStyles = overlayChildStylesStart >= 0 && overlayChildStylesEnd > overlayChildStylesStart ? lib.slice(overlayChildStylesStart, overlayChildStylesEnd) : '';
    return /if let Some\(size\) = size[\s\S]*?\} else \{[\s\S]*?SetWindowPos\([\s\S]*?SWP_NOMOVE \| SWP_NOSIZE \| SWP_NOZORDER \| SWP_NOACTIVATE \| SWP_FRAMECHANGED/.test(overlayChildStyles);
  })(),
  (() => {
    const overlayChildStylesStart = lib.indexOf('fn set_overlay_child_styles');
    const overlayChildStylesEnd = overlayChildStylesStart >= 0 ? lib.indexOf('fn embed_overlay_window', overlayChildStylesStart) : -1;
    const overlayChildStyles = overlayChildStylesStart >= 0 && overlayChildStylesEnd > overlayChildStylesStart ? lib.slice(overlayChildStylesStart, overlayChildStylesEnd) : '';
    return /GetParent/.test(overlayChildStyles) && /current_parent != Some\(parent_hwnd\)/.test(overlayChildStyles) && /current_parent\.is_some\(\)/.test(overlayChildStyles);
  })(),
  /frozenMeetingOrderRef/.test(overlay),
  /aleLuduSlotCount/.test(overlay),
  /src\.length > frozenMeetingOrderRef\.current\.length/.test(overlay),
  !/connect\.connect\(gameState\.lobbyCode,\s*myPlayer\.clientId/.test(voice),
  /setTopDownPanPosition/.test(voice) && !/pan\.positionY\.setValueAtTime\(panPos\[1\]/.test(voice),
  /isStaleClientSocketUpdate/.test(voice),
  (() => {
    const vadHandler = voice.match(/socket\.on\('VAD',[\s\S]*?\n\t\t\}\);/)?.[0] ?? '';
    return /socketClientsRef\.current\[data\.socketId\]\?\.clientId \?\? data\.client\.clientId/.test(vadHandler) && /isStaleClientSocketUpdate\(vadClientId, data\.socketId\)/.test(vadHandler) && /\[vadClientId\]: data\.activity/.test(vadHandler) && /upsertClientConnection\(vadClientId/.test(vadHandler);
  })(),
  /preferSocketForClient/.test(voice) && /nextSocketIds\[client\.clientId\] !== socketId/.test(voice),
  /currentLobby === lobbyCode/.test(voice) && /socket\.emit\('id', playerId, clientId\)/.test(voice),
  /myPlayer\?\.id/.test(voice.match(/\}, \[connect\?\.connect[\s\S]*?\]\);/)?.[0] ?? '') && /gameState\.clientId/.test(voice.match(/\}, \[connect\?\.connect[\s\S]*?\]\);/)?.[0] ?? ''),
  /\[gameState\.gameState, gameState\.players\]/.test(voice) && /let changed = false/.test(voice),
  /const cameras = AmongUsMaps\[state\.map\]\?\.cameras \?\? \{\}/.test(voice) && /if \(!camerapos\)/.test(voice),
  /REMOTE_AUDIO_TALKING_GRACE_MS/.test(voice) && /serverVadTalking/.test(voice),
  !/document\.visibilityState === 'visible'/.test(overlay),
  /appendMissingMeetingPlayers/.test(overlay),
  /hasMissingMeetingPlayers/.test(overlay),
  /meetingPlaceholder/.test(overlay) && /player: Player \| null/.test(overlay),
  !/!remoteAudioState/.test(voice.match(/const serverVadTalking[\s\S]*?\);/)?.[0] ?? ''),
  /else if \(tempTalking\[player\.clientId\]\)/.test(voice),
  (() => {
    const disconnectPeerStart = voice.indexOf('function disconnectPeer');
    const disconnectPeerEnd = disconnectPeerStart >= 0 ? voice.indexOf('// Handle pushToTalk', disconnectPeerStart) : -1;
    const disconnectPeerBody = disconnectPeerStart >= 0 && disconnectPeerEnd > disconnectPeerStart ? voice.slice(disconnectPeerStart, disconnectPeerEnd) : '';
    const noConnectionStart = disconnectPeerBody.indexOf('if (!connection)');
    const noConnectionReturn = noConnectionStart >= 0 ? disconnectPeerBody.indexOf('return;', noConnectionStart) : -1;
    const noConnectionBranch = noConnectionStart >= 0 && noConnectionReturn > noConnectionStart ? disconnectPeerBody.slice(noConnectionStart, noConnectionReturn) : '';
    return /disconnectAudioElement\(peer\)/.test(noConnectionBranch);
  })(),
  (() => {
    const audioMonitorStart = voice.indexOf('function startPeerAudioMonitor');
    const audioMonitorEnd = audioMonitorStart >= 0 ? voice.indexOf('function disconnectAudioElement', audioMonitorStart) : -1;
    const audioMonitorBody = audioMonitorStart >= 0 && audioMonitorEnd > audioMonitorStart ? voice.slice(audioMonitorStart, audioMonitorEnd) : '';
    return /socketClientsRef\.current\[peer\]\?\.clientId \?\? monitor\.clientId/.test(audioMonitorBody) && /activeClientId !== monitor\.clientId/.test(audioMonitorBody) && /monitor\.clientId = activeClientId/.test(audioMonitorBody) && /updateClientAudioActivity\(monitor\.clientId/.test(audioMonitorBody) && !/updateClientAudioActivity\(clientId/.test(audioMonitorBody);
  })(),
];
console.log(checks.filter((ok) => !ok).length);
NODE
)

bug_score=$((static_bug_checks + typecheck_fail * 10 + build_fail * 10 + rust_check_fail * 10))
echo "METRIC typecheck_fail=$typecheck_fail"
echo "METRIC build_fail=$build_fail"
echo "METRIC rust_check_fail=$rust_check_fail"
echo "METRIC bug_score=$bug_score"

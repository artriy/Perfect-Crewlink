# Autoresearch: overlay and voice correctness

## Objective

Fix requested runtime bugs without benchmark cheating:

- Overlay must stay visible/attached to the Among Us window after Alt-Tab while the game window is not minimized.
- Meeting highlight must stay on the same player slot throughout a meeting.
- Proximity audio must use the correct peer/player mapping and stable 2D spatial coordinates.

## Metrics

- **Primary**: bug_score (unitless, lower is better) — static regression score for root causes found in current code.
- **Secondary**: typecheck_fail — 0 means `npm run typecheck` passed, 1 means failed.

## How to Run

`./autoresearch.sh` — outputs `METRIC name=value` lines.

## Files in Scope

- `src-tauri/src/lib.rs` — overlay window placement/visibility on Windows.
- `src/renderer/App.tsx` — decides when overlay window should be enabled.
- `src/renderer/Overlay.tsx` — avatar overlay and meeting highlight placement.
- `src/renderer/Voice.tsx` — peer/client mapping, talking state, proximity audio spatialization.
- `src/common/AmongUsState.ts` — shared state shape only if required.

## Off Limits

- Do not modify voice server protocol beyond existing fields.
- Do not change AleLudu calibration constants unless fixing slot stability needs it.
- Do not commit local calibration/build artifacts (`.calib`, `editions`, nested `src-tauri/src-tauri`, halo config files).

## Constraints

- No new dependencies.
- Keep changes surgical.
- TypeScript typecheck should stay green or improve.
- Do not overfit by faking metric output; metric checks represent known bug root causes and must reflect real code behavior.

## What's Been Tried

- Baseline inspection found likely causes:
  - `src-tauri/src/lib.rs` hides overlay when Among Us is not foreground.
  - `Overlay.tsx` freezes meeting order only for AleLudu, so vanilla/new HUD can reshuffle when dead/disconnected state changes.
  - `Voice.tsx` has one reconnect path passing `myPlayer.clientId` as server `playerId`.
  - `Voice.tsx` writes game Y to WebAudio vertical Y axis and fixed Z; top-down 2D audio should keep vertical Y at 0 and use Z for game Y.
  - `Voice.tsx` lets stale VAD socket IDs overwrite active client/socket mapping.
- Kept fixes so far:
  - Overlay now stays visible when Among Us loses foreground focus, hiding only when game window is minimized/missing.
  - Meeting overlay uses one frozen slot order for every HUD and lets the frozen order grow while initial roster data arrives.
  - Voice spatialization maps top-down game coordinates to WebAudio X/Z axes and keeps vertical Y fixed at 0.
  - Voice peer mapping ignores stale VAD socket updates, dedupes duplicate sockets per client, and refreshes server identity when player id becomes available.
  - Voice dead-state metadata now tracks live player updates, not only game-state transitions.
  - Camera-based proximity audio now safely handles maps/mods with missing camera metadata.
  - Talking highlights now require recent remote audio activity when using server VAD, reducing stale/wrong highlights.
  - `debugMode` was added to `ISettings`, making `npm run typecheck` pass.
  - `autoresearch.sh` now validates static root-cause checks, TypeScript typecheck, production Vite build, and Rust `cargo check`.

# Autoresearch: vision-gated immersive audio

## Objective

Fix requested runtime audio issues without benchmark cheating:

- When **vision hearing** is enabled, proximity audio must not be audible beyond the local player's current light/vision radius.
- Remote voices must not buzz, ring, glitch, or turn static-like during vent/camera/radio muffling or movement updates.
- Directional audio should feel more focused and spatially precise without breaking existing peer/player mapping or meeting highlights.

## Metrics

- **Primary**: bug_score (unitless, lower is better) — static + simulation regression score for known audio/overlay/cosmetic root causes.
- **Secondary**: typecheck_fail — 0 means `npm run typecheck` passed, 1 means failed.
- **Secondary**: build_fail — 0 means production Vite build passed.
- **Secondary**: rust_check_fail — 0 means Rust `cargo check` passed.

## How to Run

`./autoresearch.sh` — outputs `METRIC name=value` lines.

## Files in Scope

- `src/renderer/Voice.tsx` — proximity range, VAD/audio activity, panner/gain/filter spatialization.
- `src/renderer/Overlay.tsx` — meeting highlight regressions only if audio state affects highlights.
- `src/renderer/Avatar.tsx` and `src/renderer/cosmetics.ts` — keep TOU Mira cosmetic regressions covered.
- `src/main/GameReader.ts` and `src-tauri/src/game_session.rs` — keep current-outfit cosmetic reads covered.
- `scripts/simulate-highlight-audio.mjs`, `scripts/simulate-cosmetics.mjs`, `autoresearch.sh` — simulation harness.

## Off Limits

- Do not modify the voice server protocol beyond existing fields.
- Do not fake metric output or bypass real validation.
- Do not add dependencies unless absolutely necessary.
- Do not commit local calibration/build artifacts (`.calib`, `editions`, nested `src-tauri/src-tauri`, halo config files, release assets).

## Constraints

- Keep changes surgical.
- TypeScript typecheck, Vite build, and Rust check should stay green.
- Preserve existing fixes: overlay Alt-Tab attachment, stable meeting slots, mapped voice activity, TOU Mira cosmetics, and current-outfit reads.

## Current Hypotheses

- Vision-only hearing is bypassed for impostors and padded by `+ 0.5`, so some players remain audible outside the visible radius.
- Biquad filter `Q` values for camera/vent/radio muffling are too resonant or invalid (for example negative camera Q), causing ringing/static/buzzing.
- Directional audio can feel too broad because distance rolloff and panner separation are conservative; a small focus factor and stronger rolloff may improve spatial precision while preserving hard max range.

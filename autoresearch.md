# Autoresearch: pure Rust program + data-sourced meeting highlights

## Objective

Overhaul Perfect Crewlink toward a pure-Rust product while fixing meeting highlights for normal HUD and AleLudu.

User-selected scope:

- Replace the current TypeScript/React runtime with Rust-authored program code.
- Remove hardcoded/screen-dynamic meeting highlight placement as the source of truth.
- Always highlight the correct player and correct meeting card in normal and AleLudu meetings.
- Best target architecture: Rust game reader emits exact `MeetingHud` card/player mapping and geometry; UI/overlay rendering consumes that Rust-owned data. Fallback heuristics may exist only as temporary compatibility, never as primary path.

## Metrics

- **Primary**: `purity_highlight_score_v2` (unitless, lower is better) — weighted score combining non-Rust runtime surface, highlight hardcode failures, Rust-sourced meeting-card failures, and build/check failures.
- **Secondary**: `non_rust_runtime_files` — count of TypeScript/JavaScript runtime files still under `src/` plus frontend config files.
- **Secondary**: `non_rust_runtime_loc` — line count for those non-Rust runtime files.
- **Secondary**: `highlight_static_failures` — known bad highlight patterns still present.
- **Secondary**: `rust_meeting_source_failures` — missing Rust meeting-card source-of-truth structures/reader path.
- **Secondary**: `cargo_check_fail` — 0 means `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- **Secondary**: `typecheck_fail`, `build_fail` — temporary monitors while TypeScript/Vite still exist.

## How to Run

`./autoresearch.sh` — outputs `METRIC name=value` lines.

## Files in Scope

- `src-tauri/src/**/*.rs` — Rust app shell, game memory reader, overlay/window control, future pure-Rust app logic.
- `src-tauri/Cargo.toml`, `Cargo.lock`, `tauri.conf*.json` — Rust/Tauri build and dependency configuration.
- `src/common/AmongUsState.ts`, `src/renderer/Overlay.tsx`, `src/renderer/Voice.tsx`, `src/renderer/**/*.tsx`, `src/main/**/*.ts` — current TypeScript runtime to migrate/remove.
- `scripts/**`, `autoresearch.sh`, `autoresearch.md`, `autoresearch.ideas.md` — benchmark and simulation harnesses.
- `package.json`, `tsconfig*.json`, `vite*.ts` — frontend config to shrink/remove as migration proceeds.

## Off Limits

- Do not fake metrics or bypass checks.
- Do not commit generated build outputs, `node_modules`, `dist*`, `src-tauri/target`, `.calib`, release artifacts, nested `src-tauri/src-tauri`.
- Do not remove current working functionality without replacing it with Rust-owned equivalent or isolating it behind a clearly temporary compatibility path.
- Do not make hardcoded AleLudu geometry the primary highlight source.

## Constraints

- Prefer small, reviewable migration slices.
- Rust must keep compiling after each kept experiment.
- While TypeScript remains part of the runtime, keep `npm run typecheck` and `npm run build` passing.
- New dependencies are allowed only when they directly reduce TypeScript/JavaScript product surface or enable Rust-native highlight/voice/UI replacement.
- Highlight identity must use player/card IDs from game state, not color slots or DOM/screen guesses.

## What's Been Tried

- 2026-05-01: Dirty previous overlay experiment changes reset at user request. New branch `autoresearch/pure-rust-highlight-2026-05-01` starts from clean tree.

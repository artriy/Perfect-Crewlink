# WebView2 performance goal + 10x plan

## Goal

Cut WebView2 resource usage by an order of magnitude for idle/hidden app states.

Success means:

- Idle app keeps only the main WebView2 alive.
- Overlay WebView2 exists only while overlay is enabled and Among Us is in a state that can display overlay.
- Lobby browser WebView2 exists only while lobby browser is open.
- Hidden windows are destroyed, not kept alive.
- CPU/GPU/memory benchmarks show at least 10x reduction in avoidable WebView2 overhead, or document the WebView2 runtime floor if total-process memory cannot reach 10x.

## Assumptions

- Current Tauri config creates three WebView2 windows at startup: `main`, `lobbies`, `overlay`.
- `visible: false` hides windows, but does not remove their WebView2 renderer/process cost.
- Biggest win comes from reducing WebView2 instance count and background rendering, not micro-optimizing React first.
- True 10x total memory reduction may be impossible while WebView2 remains main UI runtime; 10x target should apply to avoidable idle/hidden WebView2 overhead unless baseline proves otherwise.

## Current repo findings

- `src-tauri/tauri.conf.json` still declares `main`, `lobbies`, and `overlay` at startup with `visible: false`; hidden secondary windows likely still allocate WebView2 processes.
- `src-tauri/src/lib.rs` hides `overlay`/`lobbies` during setup and close; it does not destroy secondary WebViews except during full app quit.
- `src-tauri/src/lib.rs` refreshes overlay placement every 250ms while overlay is enabled.
- `src/renderer/index.ts` already chooses `app`/`lobbies`/`overlay` by Tauri window label, so lazy-created windows can keep current routing.
- `src/renderer/Overlay.tsx` has startup init polling and a 250ms overlay tick while active; optimize after lifecycle wins.

## Baseline captured before lifecycle changes

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/measure-webview2.ps1 -LaunchPath src-tauri/target/release/perfectcrewlink.exe -WarmupSeconds 5 -DurationSeconds 15 -IntervalMs 1000 -ScenarioName baseline-idle -OutputPath docs/perf-baseline-webview2-before.json -StopAfter
```

Fresh launch idle result:

- Total private memory: 288.78 MB.
- Total working set: 494.85 MB.
- WebView2 private memory: 282.59 MB.
- WebView2 working set: 467.69 MB.
- WebView2 process count: 8.
- Average CPU: 3.162% across 12 logical processors.

## Baseline required before changes

Measure same scenarios before and after every change:

1. Fresh launch, main window visible, no overlay/lobbies.
2. Main hidden/minimized.
3. Lobby browser opened, then closed.
4. Overlay disabled.
5. Overlay enabled, Among Us not found.
6. Overlay enabled, Among Us active.
7. 10 minute idle session.

Metrics:

- Total app private working set.
- `msedgewebview2.exe` child process count.
- WebView2 private working set by process.
- CPU idle percentage over 60s.
- GPU memory if available.
- Startup time to first visible main window.
- Event/message rate to overlay.

## Initial performance budgets

Phase 1 must pass these before deeper renderer work:

- Startup creates only `main`; secondary configs use `create: false` and labels are lazy-created.
- Fresh idle WebView2 process count drops below baseline 8 and stays at the main-window floor.
- Fresh idle WebView2 private memory drops materially from 282.59 MB; target ≤ 180 MB if runtime floor allows.
- Fresh idle average CPU drops from 3.162% to ≤ 1.0%.
- Closing lobby browser returns WebView2 process count and private memory near fresh idle within 5 seconds.
- Overlay disabled, overlay enabled while Among Us is missing, and game menu state keep no overlay WebView alive.
- Smoke behavior unchanged: main launches, lobby browser opens/closes repeatedly, overlay appears when eligible, quit destroys all windows.

10x target definition:

- Avoidable hidden-secondary WebView overhead should go to zero: `lobbies` and `overlay` must consume 0 MB/0 CPU when closed or ineligible.
- If total WebView2 memory cannot improve by 10x because one main WebView2 has a hard runtime floor, document measured floor and pursue native overlay/UI only if total-memory 10x remains mandatory.
- Current measured live-main WebView2 floor after optimizations is about 151.49 MB private / 272.19 MB working set. A true 10x total private-memory target from 288.78 MB would require about 28.88 MB, which is below the cost of one live WebView2 runtime.

## Phase 1 result

Commands:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/measure-webview2.ps1 -LaunchPath src-tauri/target/release/perfectcrewlink.exe -WarmupSeconds 5 -DurationSeconds 15 -IntervalMs 1000 -ScenarioName lazy-config-idle -OutputPath docs/perf-baseline-webview2-after-lazy.json -StopAfter
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/measure-webview2.ps1 -LaunchPath src-tauri/target/release/perfectcrewlink.exe -WarmupSeconds 5 -DurationSeconds 15 -IntervalMs 1000 -ScenarioName final-idle -OutputPath docs/perf-baseline-webview2-after-lazy-static.json -StopAfter
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/measure-webview2.ps1 -LaunchPath src-tauri/target/release/perfectcrewlink.exe -WarmupSeconds 5 -DurationSeconds 15 -IntervalMs 1000 -ScenarioName final-font-idle -OutputPath docs/perf-baseline-webview2-after-font.json -StopAfter
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/measure-webview2.ps1 -LaunchPath src-tauri/target/release/perfectcrewlink.exe -WarmupSeconds 5 -DurationSeconds 15 -IntervalMs 1000 -ScenarioName final-system-font-idle -OutputPath docs/perf-baseline-webview2-after-system-font.json -StopAfter
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/measure-webview2.ps1 -LaunchPath src-tauri/target/release/perfectcrewlink.exe -WarmupSeconds 5 -DurationSeconds 15 -IntervalMs 1000 -ScenarioName visible-main-idle -OutputPath docs/perf-baseline-webview2-after-visible-main.json -StopAfter
npm run perf:webview2:idle
```

Fresh launch idle after lazy secondary windows + static waiting indicator + font trim:

- Total private memory: 156.21 MB, down 132.57 MB from 288.78 MB.
- Total working set: 294.94 MB, down 199.91 MB from 494.85 MB.
- WebView2 private memory: 151.49 MB, down 131.10 MB from 282.59 MB.
- WebView2 working set: 272.19 MB, down 195.50 MB from 467.69 MB.
- WebView2 process count: 6, down from 8.
- Average CPU: 0.035%, down from 3.162% and under the 1.0% budget.

Additional WebView/native workload changes:

- Secondary window lifecycle moved to Rust commands; the renderer only requests open/close.
- Secondary window configs keep stable labels with `create: false`, so permissions/routing remain intact without startup WebViews.
- `dragDropEnabled: false` and `zoomHotkeysEnabled: false` disable unused WebView input features for all app windows.
- Overlay refresh loop now wakes every 1s when disabled or ineligible, and only uses 250ms while overlay WebView exists for active positioning.
- Main window starts visible, avoiding the previous hidden-window startup regression while keeping idle CPU low.
- Waiting screen uses a static status indicator instead of an animated MUI spinner, removing the dominant idle renderer CPU.
- Removed Source Code Pro and Varela webfont imports; app text now uses system fonts, cutting copied font assets and lowering WebView memory.
- No custom `additionalBrowserArgs` yet; Tauri warns these override default disabled Edge features, so flags need separate benchmark gate.
- Voice/WebRTC stays in WebView for now to avoid functionality risk; native audio migration is the radical path if total-memory 10x remains mandatory.

Note: lobby browser smoke needs Among Us open; without game, current product behavior closes it immediately.

## 10x strategy

### Phase 1 — remove unused WebView2 instances

- Mark `lobbies` and `overlay` window configs with `create: false`.
- Keep only `main` created at startup.
- Add async Rust commands that create secondary windows from config with `WebviewWindowBuilder` only when needed.
- Use existing label routing: `lobbies` label loads lobby UI, `overlay` label loads overlay UI.
- On close/disable, call `destroy()` for secondary windows instead of `hide()`.
- Recreate on next open.

Expected impact: idle hidden-window WebView2 count drops from 3 to 1. This is highest-confidence win.

### Phase 2 — make overlay truly dormant

- Change `set_overlay_enabled(false)` to destroy overlay window.
- If overlay is enabled but Among Us window is missing/minimized/menu state, destroy or do not create overlay.
- Replace 250ms always-running overlay refresh loop with state-triggered refresh plus slower fallback polling.
- Start overlay refresh loop only while overlay enabled.
- Stop loop when overlay disabled.

Expected impact: removes renderer, GPU surface, timers, React tree, storage listeners, and IPC churn for inactive overlay.

### Phase 3 — reduce overlay render/event cost

- Throttle voice/game state events to overlay to fixed low rate, e.g. 10 Hz max while visible.
- Do not send unchanged overlay state.
- Remove localStorage sync fallback once direct Tauri events are reliable.
- Stop `AvatarOverlay` 250ms React tick when no grace-period state is active.
- Memoize avatar rows and avoid full overlay rerender on every voice tick.

Expected impact: lower CPU while overlay active.

### Phase 4 — reduce lobby browser cost

- Destroy lobby browser WebView2 on close.
- Keep socket connection only while window exists.
- Replace once-per-second forced render with state updates from data changes.
- Virtualize lobby list if row count is large.
- Lazy-load lobby browser bundle only when opened.

Expected impact: zero lobby cost when closed; lower CPU when open.

### Phase 5 — trim main WebView2 floor

- Code-split Settings, lobby UI, heavy MUI paths, and icon imports.
- Defer updater/network calls until after first paint.
- Audit expensive hooks in `App.tsx` and `Voice.tsx`.
- Batch React state updates from game polling.
- Test WebView2 `additionalBrowserArgs` only behind benchmark gate; keep Tauri default disabled features if custom args are used.

Expected impact: smaller startup and lower main-window idle cost. Less likely to deliver 10x alone.

### Phase 6 — optional radical path if 10x total memory is mandatory

Measured floor shows one live main WebView2 still costs about 152.52 MB private memory. To reach a true 10x total private-memory target (~28.88 MB), the app cannot keep WebView2 alive in idle/waiting states.

Required native path:

- Replace waiting/menu shell with native tray + tiny native window, leaving Rust game detection alive without WebView2.
- Start main WebView2 only when voice/WebRTC UI or rich settings are needed.
- Recreate the main WebView automatically when the game opens so voice functionality is not lost.
- Replace overlay WebView2 with native Rust/Win32 drawing, or create overlay WebView only while actively visible and destroy it immediately after.
- Keep lobby browser as on-demand WebView because it is feature-heavy and already zero-cost when closed.

Do not destroy main WebView while voice chat is active unless native/WebRTC replacement exists; that would sacrifice functionality.

## Implementation order

1. Build benchmark script and capture baseline.
2. Remove startup `overlay`/`lobbies` windows.
3. Add lazy create/destroy commands.
4. Update frontend calls to tolerate recreated windows.
5. Replace hide-on-close for secondary windows with destroy-on-close.
6. Gate overlay creation on setting + game/window state.
7. Throttle overlay events and remove unnecessary ticks.
8. Rerun benchmarks after each phase.

## Risk controls

- Do not change voice/WebRTC behavior during WebView2 lifecycle work.
- Keep labels stable: `main`, `lobbies`, `overlay`.
- Use async Tauri commands for window creation on Windows to avoid WebView2 deadlock risk.
- Preserve overlay state restore path until event sync is verified.
- Add smoke checks: launch, open/close lobbies twice, enable/disable overlay twice, quit app.

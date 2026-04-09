# Perfect Crewlink

<p align="center">
  <img src="static/images/logos/sizes/256-BCL-Logo-shadow.png" alt="BetterCrewLink logo" width="160">
</p>

<p align="center">
  <strong>The standalone repository for the rewritten BetterCrewLink desktop client.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/App-BetterCrewLink-BA68C8" alt="App: BetterCrewLink">
  <img src="https://img.shields.io/badge/Repo-Perfect%20Crewlink-1D1A23" alt="Repo: Perfect Crewlink">
  <img src="https://img.shields.io/badge/Frontend-TypeScript%20%2B%20Vite-3178C6?logo=typescript&logoColor=white" alt="TypeScript + Vite">
  <img src="https://img.shields.io/badge/Desktop-Tauri-24C8DB?logo=tauri&logoColor=white" alt="Tauri">
  <img src="https://img.shields.io/badge/Native-Rust-000000?logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D4?logo=windows11&logoColor=white" alt="Windows 10/11">
</p>

Perfect Crewlink keeps the shipped app name **BetterCrewLink**, but the desktop client in this
repository is a complete rewrite of the original BetterCrewLink desktop app: **TypeScript + Vite**
in the renderer, **Tauri** for the desktop shell, and **Rust** for native window, process, and
overlay work.

This repo exists because the old BetterCrewLink desktop path was carrying too much legacy weight.
The current app is not a thin fork. It is a practical rewrite focused on faster startup, lower
desktop overhead, better window behavior, cleaner overlay handling, easier iteration, and much
stronger mod compatibility.

## Why this rewrite matters

- Faster, lighter desktop runtime than the legacy Electron-era client.
- Better overlay lifecycle: fewer ghost windows, fewer white flashes, cleaner focus and alt-tab behavior.
- Instant settings behavior: overlay and lobby settings now apply live instead of waiting for dialog close.
- Better stability across startup, attach, settings, lobby browser, and shutdown flows.
- Better mod support, including **AleLudu mode** for resized meeting cards.
- Cleaner development workflow built around `npm`, Vite, Tauri, and Rust.

## Highlights

- Full desktop rewrite centered on **TypeScript + Tauri + Rust**
- BetterCrewLink app branding preserved
- AleLudu compatibility toggle for meeting overlay positioning
- Public lobby browser with in-app access
- More overlay positioning options and live overlay preview while editing settings
- Bug fixes across startup, overlay visibility, settings sync, lobby publishing, and lobby browser windows
- Better window management around focus, taskbar behavior, and shutdown
- Repo layout and tooling that are ready to clone, install, and build immediately

## Legacy vs rewrite

| Area | Legacy BetterCrewLink desktop | Perfect Crewlink repo |
| --- | --- | --- |
| Desktop shell | Older desktop stack | Tauri desktop shell |
| Native integration | Harder to maintain | Rust-native window/process layer |
| Frontend workflow | Older web tooling | TypeScript + Vite |
| Overlay behavior | More timing and lifecycle issues | Stable init sync, better focus handling, live settings updates |
| Mod compatibility | Generic support | Includes **AleLudu mode** for custom meeting card layouts |
| Settings flow | Some settings only applied after closing dialogs | Settings apply immediately where expected |
| Build flow | Older docs and mixed tooling | `npm` + Tauri workflow documented end to end |

## What ships here

This repository builds the **BetterCrewLink** desktop app. The app name, UI identity, and bundled
desktop client remain BetterCrewLink. `Perfect Crewlink` is the repository and distribution name for
this maintained rewrite.

## Quick start

### Prerequisites

- Windows 10 or Windows 11
- Node.js 20 or newer
- Rust stable toolchain
- Visual Studio 2022 Build Tools with Desktop C++ support
- Microsoft Edge WebView2 Runtime

### Run in development

```bash
git clone https://github.com/LoMce/Perfect-Crewlink.git
cd Perfect-Crewlink
npm ci
npm run tauri -- dev
```

### Build a release locally

```bash
npm run typecheck
npm run tauri -- build
```

Build outputs:

- `src-tauri/target/release/bettercrewlink.exe`
- `src-tauri/target/release/bundle/nsis/BetterCrewLink_3.1.4_x64-setup.exe`

## Development notes

- The renderer lives in [`src/renderer`](src/renderer).
- Shared desktop/game contracts live in [`src/common`](src/common).
- Native windowing, process attach, and overlay logic live in [`src-tauri`](src-tauri).
- Static assets and translations live in [`static`](static).
- Tauri helper scripts live in [`scripts`](scripts).

Useful commands:

```bash
npm ci
npm run dev:web
npm run tauri -- dev
npm run typecheck
npm run build
npm run tauri -- build
```

## Compatibility focus

This desktop rewrite is aimed at modern BetterCrewLink usage on Windows and includes the recent
fixes for:

- instant settings sync
- lobby browser behavior
- overlay focus and visibility
- alt-tab and taskbar interaction
- public lobby publishing
- AleLudu meeting-card compatibility

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, build requirements, and pull
request expectations.

## Credits

- Original BetterCrewLink project: [OhMyGuus/BetterCrewLink](https://github.com/OhMyGuus/BetterCrewLink)
- Original CrewLink project: [ottomated/CrewLink](https://github.com/ottomated/CrewLink)

Perfect Crewlink is inspired by the original BetterCrewLink repository structure and feature set,
but this repo is organized around the rewritten Tauri desktop client you are using here.

## License

Distributed under the GNU General Public License v3.0. See [LICENSE](LICENSE).

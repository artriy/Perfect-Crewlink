# Perfect Crewlink

<p align="center">
  <img src="static/images/logos/sizes/256-BCL-Logo-shadow.png" alt="Perfect Crewlink logo" width="160">
</p>

<p align="center">
  <strong>The modern Among Us proximity chat desktop client built for speed, stability, mods, and clean streaming.</strong>
</p>

<p align="center">
  <a href="https://github.com/artriy/Perfect-Crewlink/releases/latest"><img src="https://img.shields.io/github/v/release/artriy/Perfect-Crewlink?display_name=tag&label=release" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/TypeScript-Vite-3178C6?logo=typescript&logoColor=white" alt="TypeScript and Vite">
  <img src="https://img.shields.io/badge/Desktop-Tauri-24C8DB?logo=tauri&logoColor=white" alt="Tauri desktop shell">
  <img src="https://img.shields.io/badge/Native-Rust-000000?logo=rust&logoColor=white" alt="Rust native layer">
  <img src="https://img.shields.io/badge/Windows-Portable%20%2B%20Installer-0078D4?logo=windows11&logoColor=white" alt="Windows packages">
  <img src="https://img.shields.io/badge/Linux-Supported%20via%20Source%20Build-FCC624?logo=linux&logoColor=black" alt="Linux source-build support">
</p>

Perfect Crewlink is a full desktop fork of the BetterCrewLink lineage, rebuilt around
**TypeScript + Vite**, **Tauri**, and **Rust**. It keeps the Among Us proximity chat experience
people want, then upgrades the desktop client around it: faster startup, lower overhead, sharper
window handling, cleaner overlays, stronger mod support, and better day-to-day quality.

`v1.0.0` is the first full release of Perfect Crewlink.

## Why Perfect Crewlink

- **Full rewrite, lighter runtime**  
  Built on Tauri and Rust instead of the older desktop stack for a faster, leaner client.

- **More stable overlay behavior**  
  Better attach logic, better alt-tab behavior, cleaner focus handling, and fewer ghost overlay bugs.

- **Better mod support**  
  Includes **AleLudu Mode** for resized meeting-card layouts and improved support for extended color palettes.

- **Better multiplayer interoperability**  
  Improved BetterCrewLink peer compatibility and cleaner signaling behavior across mixed lobbies.

- **Better streamer controls**  
  Privacy controls for lobby code visibility, persistent mute/deafen state, and cleaner browser behavior.

## Feature Highlights

| Area | What Perfect Crewlink adds |
| --- | --- |
| Desktop runtime | Modern TypeScript + Vite renderer with a Rust-native Tauri shell |
| Overlay | Better window attach logic, cleaner focus behavior, more position options, top-center backgroundless mode, and live settings updates |
| Public lobby browser | Direct lobby code display, region shown under the code, instant one-click copy, smarter mod filtering, and code persistence when lobbies flip in-game |
| Mod support | AleLudu compatibility, expanded palette sync for modded colors, and cleaner overlay placement for large/modded meetings |
| Voice | Better BetterCrewLink interop, more reliable peer negotiation, and persistent mute/deafen preferences |
| Customization | Overlay visibility modes, always-show-talking-player mode, compact/background variants, privacy toggles, and advanced audio/server settings |
| Packaging | Windows portable exe and Windows installer releases, with Linux supported through source builds |

## What Ships In v1.0.0

- Full `Perfect Crewlink` branding across the repo, desktop app, installer, bundle ID, and release assets
- Rewritten desktop stack using **TypeScript + Vite + Tauri + Rust**
- Overlay fixes for taskbar disappearance, alt-tab behavior, and game-only visibility
- Overlay options for:
  - talking-only avatars by default
  - optional always-show-all-players mode
  - top center without background
  - top center with background
- Public lobby browser improvements:
  - direct lobby code display
  - region shown below each code
  - instant copy button
  - smarter incompatible-mod handling
  - code retention when a tracked lobby moves from lobby state into in-game state
- Better compatibility with BetterCrewLink users in the same room
- AleLudu Mode for resized meeting cards
- Persistent mic mute and speaker mute state between launches
- Better handling for expanded / modded player colors so avatars stop collapsing to red

## Download

Grab the latest release from:

- [Perfect Crewlink Releases](https://github.com/artriy/Perfect-Crewlink/releases/latest)

Release assets include:

- `perfectcrewlink.exe`
- `Perfect.Crewlink_1.0.0_x64-setup.exe`

Linux is supported, but `v1.0.0` ships GitHub release assets for Windows only. Linux builds are expected to come from source on a Linux machine.

## Build From Source

### Prerequisites

- Node.js 20+
- Rust stable toolchain
- Windows 10 or 11 with Visual Studio 2022 Build Tools and WebView2 Runtime
- Or Ubuntu 22.04+ with GTK/WebKitGTK dependencies for Tauri desktop builds

### Development

```bash
git clone https://github.com/artriy/Perfect-Crewlink.git
cd Perfect-Crewlink
npm ci
npm run tauri -- dev
```

### Production build

```bash
npm run typecheck
npm run tauri -- build
```

Typical outputs:

- `src-tauri/target/release/perfectcrewlink.exe`
- `src-tauri/target/release/bundle/nsis/Perfect Crewlink_1.0.0_x64-setup.exe`

### Linux build guide

Perfect Crewlink supports Linux builds, but the first release publishes Windows assets only. To build on Linux:

```bash
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  curl \
  file \
  libssl-dev \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libxdo-dev \
  patchelf

git clone https://github.com/artriy/Perfect-Crewlink.git
cd Perfect-Crewlink
npm ci
npm run typecheck
npm run tauri -- build
```

On Linux, Tauri will produce the appropriate native bundle outputs for the host environment.

## Development Guide

### Repository layout

- `src/renderer`  
  React UI, overlay UI, settings, lobby browser, and voice client logic

- `src/common`  
  Shared desktop/game contracts, state types, IPC messages, and shared utilities

- `src-tauri`  
  Native windowing, process attach, overlay control, asset generation, and Among Us reader logic

- `static`  
  Logos, avatar templates, translation files, and static assets

- `scripts`  
  Build helpers and Tauri launcher helpers

### Useful commands

```bash
npm ci
npm run dev:web
npm run tauri -- dev
npm run typecheck
npm run build
npm run tauri -- build
```

## Release Workflow

GitHub Actions builds and attaches Windows release assets directly to the GitHub release tag:

- Windows portable executable
- Windows NSIS installer

Linux remains supported through documented source builds.

## Changelog

- [CHANGELOG.md](CHANGELOG.md)

## Credits

- Original CrewLink project: [ottomated/CrewLink](https://github.com/ottomated/CrewLink)
- Original BetterCrewLink project: [OhMyGuus/BetterCrewLink](https://github.com/OhMyGuus/BetterCrewLink)

Perfect Crewlink takes that lineage and pushes the desktop client forward with a modern rewrite,
more reliable runtime behavior, and a cleaner release story.

## License

Distributed under the GNU General Public License v3.0. See [LICENSE](LICENSE).

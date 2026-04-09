# Perfect Crewlink

<p align="center">
  <img src="static/images/logos/sizes/256-BCL-Logo-shadow.png" alt="Perfect Crewlink logo" width="160">
</p>

<p align="center">
  <strong>The modern Among Us proximity chat desktop client built for speed, stability, mods, and clean streaming.</strong>
</p>

<p align="center">
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

## Core Capabilities

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

Get Perfect Crewlink from the project releases page:

- [Perfect Crewlink Releases](https://github.com/artriy/Perfect-Crewlink/releases/latest)

Windows downloads include a portable desktop build and an installer. Linux is supported through source builds on a Linux machine.

## Build From Source

If you just want to use the app, download a release build. If you want to run or build it yourself, use the platform guide below.

### Windows quick start

1. Install the required tools:
   - Node.js 20 or newer
   - Rust stable toolchain from `rustup`
   - Visual Studio 2022 Build Tools with `Desktop development with C++`
   - Microsoft WebView2 Runtime
2. Clone the repo and install dependencies:

```bash
git clone https://github.com/artriy/Perfect-Crewlink.git
cd Perfect-Crewlink
npm ci
```

3. Start the desktop app in development mode:

```bash
npm run tauri -- dev
```

4. Build a production version:

```bash
npm run typecheck
npm run tauri -- build
```

5. Find the Windows outputs here:
   - `src-tauri/target/release/perfectcrewlink.exe`
   - `src-tauri/target/release/bundle/nsis/*.exe`

### Linux quick start

1. Install the required tools:
   - Node.js 20 or newer
   - Rust stable toolchain from `rustup`
   - Ubuntu 22.04 or newer
2. Install Tauri desktop dependencies:

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
```

3. Clone the repo and install dependencies:

```bash
git clone https://github.com/artriy/Perfect-Crewlink.git
cd Perfect-Crewlink
npm ci
```

4. Start the desktop app in development mode:

```bash
npm run tauri -- dev
```

5. Build a production version:

```bash
npm run typecheck
npm run tauri -- build
```

6. Tauri will generate the Linux bundle for the host machine from `src-tauri/target/release/bundle/`.

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

## Credits

- Original CrewLink project: [ottomated/CrewLink](https://github.com/ottomated/CrewLink)
- Original BetterCrewLink project: [OhMyGuus/BetterCrewLink](https://github.com/OhMyGuus/BetterCrewLink)

Perfect Crewlink takes that lineage and pushes the desktop client forward with a modern rewrite,
more reliable runtime behavior, and a cleaner release story.

## License

Distributed under the GNU General Public License v3.0. See [LICENSE](LICENSE).

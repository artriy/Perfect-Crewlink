<div align="center">

<img src="static/images/header-banner.svg" alt="Perfect Crewlink" width="100%"/>

<br/>

**Fast, polished proximity chat for Among Us — rebuilt with Tauri, Rust, and a cleaner desktop experience.**

<br/>

<a href="https://github.com/artriy/Perfect-Crewlink/releases/latest"><img src="https://img.shields.io/badge/Download_latest-C51111?style=for-the-badge&logo=github&logoColor=white" alt="Download latest release"/></a>
&nbsp;
<a href="CHANGELOG.md"><img src="https://img.shields.io/badge/Changelog-24C8DB?style=for-the-badge&logo=git&logoColor=white" alt="Changelog"/></a>
&nbsp;
<a href="#build-from-source"><img src="https://img.shields.io/badge/Build_from_source-111827?style=for-the-badge&logo=rust&logoColor=white" alt="Build from source"/></a>

<br/><br/>

<img src="static/images/logos/sizes/256-BCL-Logo-shadow.png" alt="Perfect Crewlink logo" width="120"/>

</div>

<img src="static/images/divider.svg" width="100%" alt="divider"/>

## What is Perfect Crewlink?

Perfect Crewlink is a modern desktop fork of the CrewLink / BetterCrewLink lineage.
It keeps the familiar Among Us proximity chat flow, but upgrades the app around it:
faster startup, stronger overlay behavior, cleaner lobby tools, better mod support,
and a Rust-backed Tauri shell instead of the older Electron-style desktop stack.

## Highlights

<table>
<tr>
<td width="33%" valign="top">

### ⚡ Lean desktop app

Tauri + Rust shell with a Vite renderer for faster launch, lower overhead, and simpler packaging.

</td>
<td width="33%" valign="top">

### 🎯 Reliable overlays

Game-attached overlay behavior, improved alt-tab handling, and meeting highlights backed by Rust-read game state.

</td>
<td width="33%" valign="top">

### 🧩 Mod-friendly

AleLudu meeting support, expanded color palette sync, and better handling for modded cosmetics and lobbies.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 🔊 Better voice flow

Compatible with BetterCrewLink peers, with improved reconnects, stale-stream detection, and persistent mute/deafen state.

</td>
<td width="33%" valign="top">

### 🧭 Cleaner lobbies

Direct lobby codes, region labels, quick copy, smart filtering, and code persistence when games move in and out of lobby state.

</td>
<td width="33%" valign="top">

### 🎥 Stream-ready

Overlay modes, lobby privacy options, compact layouts, and backgroundless positions for cleaner captures.

</td>
</tr>
</table>

<img src="static/images/divider.svg" width="100%" alt="divider"/>

## Download

Get the latest Windows installer or portable executable from:

<div align="center">

### [Perfect Crewlink Releases →](https://github.com/artriy/Perfect-Crewlink/releases/latest)

</div>

**Windows:** prebuilt installer and portable `.exe` are available on each release.  
**Linux:** build from source on a Linux machine using the steps below.

<img src="static/images/divider.svg" width="100%" alt="divider"/>

## Build from source

### Requirements

- Node.js 20+
- Rust stable toolchain
- Tauri desktop dependencies
- Windows: Visual Studio 2022 Build Tools + WebView2 Runtime

### Quick start

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

Windows outputs:

```text
src-tauri/target/release/perfectcrewlink.exe
src-tauri/target/release/bundle/nsis/*.exe
```

Linux builds output bundles under:

```text
src-tauri/target/release/bundle/
```

<details>
<summary><strong>Linux dependency install example</strong></summary>

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

</details>

<img src="static/images/divider.svg" width="100%" alt="divider"/>

## Project layout

```text
src/          React renderer, overlay UI, settings, lobby browser, voice client
src-tauri/    Rust/Tauri shell, process reader, native overlay/window control
static/       Images, translations, avatars, and bundled assets
scripts/      Build helpers and Tauri launch wrappers
```

Useful commands:

```bash
npm run dev:web        # Run renderer only
npm run tauri -- dev   # Run full desktop app
npm run typecheck      # Type-check TypeScript
npm run build          # Build renderer
npm run tauri -- build # Build desktop app
```

<img src="static/images/divider.svg" width="100%" alt="divider"/>

## Credits

Perfect Crewlink exists because of the community work behind:

- [ottomated/CrewLink](https://github.com/ottomated/CrewLink)
- [OhMyGuus/BetterCrewLink](https://github.com/OhMyGuus/BetterCrewLink)

This fork builds on that foundation with a modern desktop runtime, stronger overlays,
and a cleaner release path.

## License

Distributed under the **GNU General Public License v3.0**. See [LICENSE](LICENSE).

<br/>

<div align="center">

<img src="static/images/footer.svg" width="100%" alt="footer"/>

<br/>

<sub><strong>Perfect Crewlink</strong> · Built for the crew</sub>

</div>

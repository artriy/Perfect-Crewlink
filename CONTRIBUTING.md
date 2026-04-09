# Contributing

Perfect Crewlink is the repository for the rewritten **BetterCrewLink** desktop client. The app
name stays BetterCrewLink; this repo tracks the TypeScript + Tauri + Rust rewrite and the ongoing
compatibility and stability work around it.

## Prerequisites

- Windows 10 or Windows 11
- Node.js 20 or newer
- Rust stable
- Visual Studio 2022 Build Tools with Desktop C++ support
- Microsoft Edge WebView2 Runtime

## Local setup

```bash
git clone https://github.com/artriy/Perfect-Crewlink.git
cd Perfect-Crewlink
npm ci
```

## Development

Start the renderer only:

```bash
npm run dev:web
```

Run the desktop app in development:

```bash
npm run tauri -- dev
```

Build checks:

```bash
npm run typecheck
npm run tauri -- build
```

## Pull request expectations

- Keep changes focused and reviewable.
- Run `npm run typecheck` before opening a PR.
- If you touch Tauri or Rust code, also run `npm run tauri -- build`.
- If you change overlay or meeting behavior, include a screenshot or short before/after note.
- If you change process attach or offsets behavior, mention the Among Us build or mod setup you tested against.

## Repository structure

- `src/renderer`: React/TypeScript UI
- `src/common`: shared types, game state contracts, overlay state, desktop helpers
- `src-tauri`: Rust-native shell, windows integration, build config
- `static`: images, translations, static assets
- `scripts`: helper scripts for dev/build

## Support

- Bugs and feature requests: [GitHub Issues](https://github.com/artriy/Perfect-Crewlink/issues)
- Original upstream reference: [OhMyGuus/BetterCrewLink](https://github.com/OhMyGuus/BetterCrewLink)

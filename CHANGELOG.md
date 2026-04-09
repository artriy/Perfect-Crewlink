# Changelog

## v1.0.0 - 2026-04-09

Perfect Crewlink v1.0.0 is the first full release of Perfect Crewlink, built with a modern desktop
stack, dedicated branding, cleaner packaging, and a large pass across overlay behavior, mod
support, public lobbies, and day-to-day usability.

### Platform foundation

- Built the desktop client around **TypeScript + Vite**, **Tauri**, and **Rust**
- Shipped dedicated `Perfect Crewlink` desktop branding, executable naming, installer naming,
  bundle ID, and repository identity
- Prepared the repo and release flow to publish Windows desktop artifacts while keeping Linux
  supported through source builds

### Overlay and in-game behavior

- Fixed overlay visibility so it only appears when attached to Among Us
- Fixed taskbar and alt-tab issues caused by incorrect overlay window behavior
- Added better foreground-window tracking so the overlay hides immediately outside the game
- Added new overlay layout choices, including:
  - top center without background
  - top center with background
- Changed default avatar overlay behavior so only talking players appear by default
- Added an option to restore the old always-show-all-players overlay behavior

### Mod support and visuals

- Added **AleLudu Mode** to align meeting overlays with the AleLudu meeting-card layout
- Fixed modded player-color handling so expanded palettes no longer collapse avatars to red
- Improved native-to-renderer palette sync for large color sets and modded lobbies

### Voice and lobby compatibility

- Fixed BetterCrewLink interoperability issues that left peers stuck in `TRYING`
- Improved peer reuse and signal handling across mixed BetterCrewLink / Perfect Crewlink lobbies
- Fixed renderer bundling so the browser-safe `simple-peer` path is used consistently
- Made mute and deafen state persist across launches

### Public lobby browser

- Reworked the lobby browser to show the lobby code directly instead of using a reveal button
- Added the region label under every visible code
- Added instant one-click copy for lobby codes
- Preserved learned lobby codes when a tracked room flips from lobby state into in-game state
- Made incompatible-mod filtering opt-out by default through `Ignore Incompatible Lobby Mods`
- Added smarter retry behavior for false incompatible responses
- Fixed the privacy path so `Show Lobby Code` now governs the lobby browser as well

### Stability fixes

- Hardened startup reads in the native Among Us session worker so early memory-read failures do not
  kill the session immediately
- Improved attach behavior after third-party edits regressed native session startup
- Cleaned up temporary debug-only tracing after the fixes were verified

### Packaging

- Windows portable build: `perfectcrewlink.exe`
- Windows installer: `Perfect.Crewlink_1.0.0_x64-setup.exe`
- Linux supported through source builds documented in the README

### Notes

- Perfect Crewlink remains compatible with the BetterCrewLink ecosystem while shipping as its own
  standalone desktop client
- Legacy BetterCrewLink history remains upstream; the Perfect Crewlink changelog starts here at
  `v1.0.0`

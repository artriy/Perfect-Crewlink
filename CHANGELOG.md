<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:C51111,50:24C8DB,100:C51111&height=140&section=header&text=Changelog&fontSize=52&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=Every%20release%2C%20every%20fix%2C%20every%20improvement&descSize=16&descAlignY=60&descAlign=50" width="100%" alt="Changelog"/>

</div>

<img src="static/images/divider.svg" width="100%" alt="divider"/>

# <img src="https://img.shields.io/badge/v1.0.0-C51111?style=for-the-badge&logo=rocket&logoColor=white" alt="v1.0.0"/> &nbsp; First Launch

<p>
<img src="https://img.shields.io/badge/RELEASED-2026--04--09-24C8DB?style=for-the-badge" alt="released"/>
&nbsp;
<img src="https://img.shields.io/badge/STATUS-STABLE-2ed573?style=for-the-badge" alt="stable"/>
&nbsp;
<img src="https://img.shields.io/badge/PLATFORM-Windows_%2B_Linux-8b5cf6?style=for-the-badge" alt="platform"/>
</p>

> **Perfect Crewlink v1.0.0** is the first full release — built on a modern desktop stack with dedicated branding, cleaner packaging, and a sweeping pass across overlay behavior, mod support, public lobbies, and day-to-day usability.

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-PLATFORM_FOUNDATION-C51111?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**Rebuilt from the metal up.** Perfect Crewlink now runs on a modern desktop stack and ships with its own identity across every surface.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Built the desktop client around **TypeScript + Vite**, **Tauri**, and **Rust**
- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Dedicated `Perfect Crewlink` desktop branding, executable naming, installer naming, bundle ID, and repository identity
- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Release flow to publish Windows desktop artifacts while keeping Linux supported through source builds

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-OVERLAY_&_IN--GAME-24C8DB?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**The overlay finally behaves.** New attach logic, proper foreground tracking, and new layout options built for modern streaming setups.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Overlay visibility now correctly bound to Among Us being in focus
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Taskbar and alt-tab issues caused by incorrect overlay window behavior
- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Better foreground-window tracking — overlay hides immediately outside the game
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Overlay state now resyncs after alt-tab and focus restore, so speaking badges stop jumping onto the wrong player
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Quieter audible speakers now light the overlay more reliably instead of requiring noticeably louder voice levels
- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Overlay layouts: **top center without background** and **top center with background**
- <img src="https://img.shields.io/badge/CHANGED-ffa502?style=flat-square"/> &nbsp; Default avatar overlay now shows only talking players
- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Option to restore the old always-show-all-players overlay behavior

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-MOD_SUPPORT_&_VISUALS-8b5cf6?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**Mods are first-class citizens.** Avatars stop breaking in modded lobbies, meeting overlays line up with modern mod layouts.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; **AleLudu Mode** to align meeting overlays with the AleLudu meeting-card layout
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Modded player-color handling — expanded palettes no longer collapse avatars to red
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Native-to-renderer palette sync for large color sets and modded lobbies

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-VOICE_&_LOBBY_COMPAT-ffa502?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**No more `TRYING` limbo.** Peers reuse properly, signaling is cleaner, and mute/deafen state survives a restart.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; BetterCrewLink interoperability issues that left peers stuck in `TRYING`
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Peer reuse and signal handling across mixed BetterCrewLink / Perfect Crewlink lobbies
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Renderer bundling so the browser-safe `simple-peer` path is used consistently
- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Mute and deafen state persists across launches

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-PUBLIC_LOBBY_BROWSER-f368e0?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**Finding lobbies just got usable.** Codes are visible by default, regions are labeled, and copy is one click away.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/CHANGED-ffa502?style=flat-square"/> &nbsp; Lobby browser shows the code directly instead of using a reveal button
- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Region label under every visible code
- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Instant one-click copy for lobby codes
- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Learned lobby codes preserved when a tracked room flips from lobby into in-game
- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; `Ignore Incompatible Lobby Mods` toggle — incompatible-mod filtering is opt-out by default
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Smarter retry behavior for false incompatible responses
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Stale public-list rows that were no longer actually joinable no longer sit in the browser as fake `UNAVAILABLE` entries
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Transient code lookup failures now retry automatically instead of getting cached forever
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Privacy path: `Show Lobby Code` now governs the lobby browser as well

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-STABILITY_FIXES-06b6d4?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**Fewer session explosions.** Early memory-read failures no longer kill the whole session, and native attach is more resilient.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Hardened startup reads in the native Among Us session worker — early memory-read failures no longer kill the session immediately
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Attach behavior after third-party edits regressed native session startup
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Closing Among Us now reliably returns Perfect Crewlink to the waiting screen instead of leaving it stranded on the public-lobbies flow
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Cleaned up temporary debug-only tracing after fixes were verified

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-PACKAGING-2ed573?style=flat-square" height="22"/>

<table>
<tr>
<td align="center" width="33%">

<img src="https://img.shields.io/badge/Windows-Portable-0078D4?style=for-the-badge&logo=windows11&logoColor=white" alt="Portable"/>

`perfectcrewlink.exe`

</td>
<td align="center" width="33%">

<img src="https://img.shields.io/badge/Windows-Installer-0078D4?style=for-the-badge&logo=windows11&logoColor=white" alt="Installer"/>

`Perfect.Crewlink_1.0.0_x64-setup.exe`

</td>
<td align="center" width="33%">

<img src="https://img.shields.io/badge/Linux-Source_Build-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux"/>

See the README build guide

</td>
</tr>
</table>

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-NOTES-5a6080?style=flat-square" height="22"/>

> Perfect Crewlink remains compatible with the BetterCrewLink ecosystem while shipping as its own standalone desktop client.

> Legacy BetterCrewLink history remains upstream; the Perfect Crewlink changelog starts here at `v1.0.0`.

<br/>

<div align="center">

<img src="static/images/footer.svg" width="100%" alt="footer"/>

<br/>

<sub><strong>Perfect Crewlink</strong> &middot; Changelog v1.0.0 &middot; 2026-04-09</sub>

</div>

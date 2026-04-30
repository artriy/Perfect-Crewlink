<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:C51111,50:24C8DB,100:C51111&height=140&section=header&text=Changelog&fontSize=52&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=Overlay%2C%20voice%2C%20and%20TOU%20Mira%20cosmetics%20fixed&descSize=16&descAlignY=60&descAlign=50" width="100%" alt="Changelog"/>

</div>

<img src="static/images/divider.svg" width="100%" alt="divider"/>

# <img src="https://img.shields.io/badge/v1.0.4-C51111?style=for-the-badge&logo=rocket&logoColor=white" alt="v1.0.4"/> &nbsp; The Overlay, Voice & TOU Mira Release

<p>
<img src="https://img.shields.io/badge/RELEASED-2026--04--30-24C8DB?style=for-the-badge" alt="released"/>
&nbsp;
<img src="https://img.shields.io/badge/STATUS-STABLE-2ed573?style=for-the-badge" alt="stable"/>
&nbsp;
<img src="https://img.shields.io/badge/HIGHLIGHT-TOU_MIRA_COSMETICS-8b5cf6?style=for-the-badge" alt="highlight"/>
</p>

> **Perfect Crewlink v1.0.4** is the release that locks the overlay to Among Us, keeps meeting highlights on the right players, makes directional audio feel smoother and more accurate, and restores missing Town of Us: Mira cosmetics in player icons. If Alt-Tab, mid-meeting deaths, stale voice highlights, or TOU Mira clothes made your overlay feel wrong, this is the cleanup release.

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-OVERLAY_WINDOW-24C8DB?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**The overlay stays with the game.** Perfect Crewlink now keeps the overlay visible and attached to the Among Us client area after Alt-Tab while the game is still open, without flashing over the taskbar or outside the game window.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Overlay disappearing after Alt-Tab when Among Us was still running
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Overlay briefly becoming a top-level window and covering the taskbar
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Overlay is embedded as an Among Us child window, raised in child z-order, hidden before detach, and refreshed on every visibility change

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-MEETING_HIGHLIGHTS-8b5cf6?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**Meeting highlights stick to the same card.** Player slots are frozen for the whole meeting, placeholders keep disconnected slots from collapsing, late roster entries append instead of reshuffling everyone, and stale dead/disconnected voice state no longer lights the wrong card.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Highlights shifting after deaths, guesses, disconnects, or same-length player replacements
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Dead or disconnected remote players staying highlighted from stale talking state
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Server VAD and analyser updates now require active socket-to-client mapping and recent remote audio evidence

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-DIRECTIONAL_AUDIO-2ed573?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**Proximity audio is more accurate and less jumpy.** Voice now maps Among Us top-down positions onto WebAudio X/Z axes, uses HRTF panning, smooths panner/gain/filter changes, applies effective camera/vent/vision distance, and keeps close voices stable with a real near-field reference distance.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Game Y no longer maps to WebAudio vertical Y; top-down movement uses X/Z like the map
- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; HRTF directional panning, smoothed gain/panner/filter params, and stable near-field loudness
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Camera, vent, radio, wall-blocking, and max-distance behavior are validated by simulations

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-TOU_MIRA_COSMETICS-8b5cf6?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**Town of Us: Mira clothes, skins, and visors show in player icons again.** The avatar renderer now resolves hats, skins, and visors as separate cosmetic types, matches aliases by key, image name, and asset name, and reads the currently visible outfit cosmetics instead of only the default outfit.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; TOU Mira custom clothes/skins missing from player logos and overlay icons
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Skins and visors incorrectly going through hat-only lookup paths
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Current outfit hat, skin, and visor are read by both the TypeScript and Rust game readers

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

`Perfect Crewlink_1.0.4_x64-setup.exe`

</td>
<td align="center" width="33%">

<img src="https://img.shields.io/badge/Linux-Source_Build-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux"/>

See the README build guide

</td>
</tr>
</table>

<img src="static/images/divider.svg" width="100%" alt="divider"/>

<div align="center">

<img src="static/images/footer.svg" width="100%" alt="footer"/>

<br/>

<sub><strong>Perfect Crewlink</strong> &middot; Changelog v1.0.4 &middot; 2026-04-30</sub>

</div>

<img src="static/images/divider.svg" width="100%" alt="divider"/>

# <img src="https://img.shields.io/badge/v1.0.3-C51111?style=for-the-badge&logo=rocket&logoColor=white" alt="v1.0.3"/> &nbsp; The AleLudu Release

<p>
<img src="https://img.shields.io/badge/RELEASED-2026--04--15-24C8DB?style=for-the-badge" alt="released"/>
&nbsp;
<img src="https://img.shields.io/badge/STATUS-STABLE-2ed573?style=for-the-badge" alt="stable"/>
&nbsp;
<img src="https://img.shields.io/badge/HIGHLIGHT-ALELUDU_OVERLAY-8b5cf6?style=for-the-badge" alt="highlight"/>
</p>

> **Perfect Crewlink v1.0.3** is the release where the AleLudu meeting overlay finally *clicks*. Voice boxes land on every tablet card like they're magnets — no 1-degree drift on the outer columns, no reshuffling when a player dies mid-meeting, and Perfect Crewlink cleanly returns to its waiting screen the moment you close Among Us. If you play AleLudu Town of Us, this is the version you've been waiting for.

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-ALELUDU_OVERLAY-24C8DB?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**Pixel-perfect card alignment, out of the box.** The AleLudu tablet doesn't use uniform column pitch — the four columns drift a fraction of a percent apart on purpose, and older single-spacing overlays always landed half-off on columns three and four. v1.0.3 ships with every column hand-calibrated against a live TOU lobby, so the first time you open a meeting the voice boxes are already hugging the real player cards.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Fully independent per-column tuning — each column owns its centre, width, row-0 centre, row height, and row gap
- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Live calibration grid you can summon from Settings → Debug: magenta card boxes, dashed MeetingHud / Tablet rect outlines, and a realtime debug readout
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Default overlay positions now match the in-game AleLudu tablet exactly — no more "close but drifted" alignment on the outer columns
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Legacy single-knob tile fields still work as a fallback so older saved calibrations keep rendering

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-MEETING_STABILITY-8b5cf6?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**The layout no longer scrambles when someone dies.** When a TOU guess lands or a Jailor execute fires mid-meeting and the tablet keeps showing the remaining players, Perfect Crewlink now locks every surviving card in its original slot instead of sliding them all up one position. Your voice boxes stay glued to the same faces all the way through discussion.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Frozen-slot indexing per player ID, captured on the first render of each meeting and reused until the tablet closes
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Overlay cards shifting upward after mid-meeting death events (TOU guess, Jailor execute, forced removal)
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Settings → AleLudu panel shows every per-column section expanded by default, with **Expand all** / **Collapse all** shortcuts next to **Distribute columns evenly**

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-SESSION_LIFECYCLE-2ed573?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**Clean handoff when Among Us comes and goes.** Quitting the game used to leave Perfect Crewlink stuck on the voice screen until you noticed and restarted it — the frame loop would lock on a stale memory handle. v1.0.3 catches that case cleanly and flips you straight back to the **Waiting for Among Us** screen the moment the process dies, ready for the next lobby.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Perfect Crewlink returns to the **Waiting for Among Us** screen immediately after you close the game, instead of hanging on the last voice view
- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Dedicated **Debug** section at the bottom of Settings — one toggle that reveals the AleLudu calibration panel when AleLudu mode is also on, off by default so regular players never see the tuning UI
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; GameReader loop is now crash-resilient against abrupt process termination — stale memory reads force-detach cleanly instead of freezing the frame pump

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

`Perfect Crewlink_1.0.3_x64-setup.exe`

</td>
<td align="center" width="33%">

<img src="https://img.shields.io/badge/Linux-Source_Build-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux"/>

See the README build guide

</td>
</tr>
</table>

<img src="static/images/divider.svg" width="100%" alt="divider"/>

<div align="center">

<img src="static/images/footer.svg" width="100%" alt="footer"/>

<br/>

<sub><strong>Perfect Crewlink</strong> &middot; Changelog v1.0.3 &middot; 2026-04-15</sub>

</div>

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:C51111,50:24C8DB,100:C51111&height=140&section=header&text=Changelog&fontSize=52&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=The%20AleLudu%20meeting%20overlay%20finally%20clicks&descSize=16&descAlignY=60&descAlign=50" width="100%" alt="Changelog"/>

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

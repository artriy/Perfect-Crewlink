<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:C51111,50:24C8DB,100:C51111&height=140&section=header&text=Changelog&fontSize=52&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=AleLudu%20meeting%20overlay%2C%20fully%20fixed&descSize=16&descAlignY=60&descAlign=50" width="100%" alt="Changelog"/>

</div>

<img src="static/images/divider.svg" width="100%" alt="divider"/>

# <img src="https://img.shields.io/badge/v1.0.3-C51111?style=for-the-badge&logo=rocket&logoColor=white" alt="v1.0.3"/> &nbsp; AleLudu Meeting Overlay, Fully Fixed

<p>
<img src="https://img.shields.io/badge/RELEASED-2026--04--15-24C8DB?style=for-the-badge" alt="released"/>
&nbsp;
<img src="https://img.shields.io/badge/STATUS-STABLE-2ed573?style=for-the-badge" alt="stable"/>
&nbsp;
<img src="https://img.shields.io/badge/SCOPE-PATCH_UPDATE-ffa502?style=for-the-badge" alt="scope"/>
</p>

> **Perfect Crewlink v1.0.3** is the AleLudu release. The meeting overlay now locks onto the tablet's real player cards with hand-calibrated, per-column positioning, keeps its slots anchored when someone dies mid-meeting (TOU guess / Jailor execute), and ships a live tuning panel so anyone can re-dial the overlay without touching code.

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-ALELUDU_OVERLAY-24C8DB?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**The meeting overlay finally sits exactly on top of the AleLudu tablet cards.** Each of the four columns has its own independent centre, width, and row metrics — because the tablet columns aren't evenly pitched in the game art, so a single-spacing approach always drifted by 1–2% on the outer columns.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Per-column tuning (centre / width / row 0 centre / row height / row gap) with independent values for every column
- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Live calibration grid toggle — magenta card boxes, dashed rectangles on the MeetingHud and Tablet rects, and a corner debug readout with viewport, rects, and per-player state
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Default overlay positions now match the real in-game tablet cards exactly, calibrated live against an AleLudu TOU lobby
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Legacy single-knob tile fields still work as a fallback for older saved configs that predate per-column data

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-MEETING_STABILITY-8b5cf6?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**Mid-meeting deaths no longer scramble the layout.** When a TOU guess or Jailor execute drops a player from `gameState.players` while the tablet is still on screen, the remaining cards used to slide up one slot each; now every surviving card keeps its exact column and row.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Frozen-slot indexing per player ID — captured on first render of each meeting and reused until the tablet closes
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Overlay cards shifting upward after mid-meeting death events (guess, Jailor execute, forced removal)
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Settings panel opens every per-column section by default, with **Expand all** / **Collapse all** shortcuts next to **Distribute columns evenly**

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

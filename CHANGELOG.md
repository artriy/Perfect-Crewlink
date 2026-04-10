<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:C51111,50:24C8DB,100:C51111&height=140&section=header&text=Changelog&fontSize=52&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=Reliability%20patch%20notes%20for%20Perfect%20Crewlink&descSize=16&descAlignY=60&descAlign=50" width="100%" alt="Changelog"/>

</div>

<img src="static/images/divider.svg" width="100%" alt="divider"/>

# <img src="https://img.shields.io/badge/v1.0.2-C51111?style=for-the-badge&logo=rocket&logoColor=white" alt="v1.0.2"/> &nbsp; Session, Voice & Overlay Reliability

<p>
<img src="https://img.shields.io/badge/RELEASED-2026--04--10-24C8DB?style=for-the-badge" alt="released"/>
&nbsp;
<img src="https://img.shields.io/badge/STATUS-STABLE-2ed573?style=for-the-badge" alt="stable"/>
&nbsp;
<img src="https://img.shields.io/badge/SCOPE-PATCH_UPDATE-ffa502?style=for-the-badge" alt="scope"/>
</p>

> **Perfect Crewlink v1.0.2** is a trust-focused patch release built to behave better in weird real-world lobbies: the session lifecycle is stricter, peer identity is more stable, quieter remote speech is detected more accurately, and overlays stop scrambling during short reconnects.

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-SESSION_LIFECYCLE-24C8DB?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**Attach state is now deliberate instead of optimistic.** Perfect Crewlink no longer treats "reader attached" as "game fully ready," which cuts down on startup races and wrong screen transitions.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Native session phases for detached, attaching, warmup, active, and recovering states
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Premature jumps into the voice screen before a valid game state existed
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Return path back to `Waiting for Among Us` when the game process disappears or is recovering

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-VOICE_&_OVERLAY-8b5cf6?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**Players stay matched to themselves more reliably.** The transport layer now reconciles around `clientId` first, while the overlay keeps stable slots through short reconnects and focus churn.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; ClientId-first peer reconciliation to reduce ghost peers and stale socket mismatches
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Overlay roster scrambling after alt-tab, reconnect, or short transport churn
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Remote speech detection with smoothed audio levels and hysteresis so quieter audible speakers light up more consistently

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

`Perfect Crewlink_1.0.2_x64-setup.exe`

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

<sub><strong>Perfect Crewlink</strong> &middot; Changelog v1.0.2 &middot; 2026-04-10</sub>

</div>

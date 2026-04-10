<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:C51111,50:24C8DB,100:C51111&height=140&section=header&text=Changelog&fontSize=52&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=Focused%20patch%20notes%20for%20Perfect%20Crewlink&descSize=16&descAlignY=60&descAlign=50" width="100%" alt="Changelog"/>

</div>

<img src="static/images/divider.svg" width="100%" alt="divider"/>

# <img src="https://img.shields.io/badge/v1.0.1-C51111?style=for-the-badge&logo=rocket&logoColor=white" alt="v1.0.1"/> &nbsp; Overlay & Lobby Patch

<p>
<img src="https://img.shields.io/badge/RELEASED-2026--04--10-24C8DB?style=for-the-badge" alt="released"/>
&nbsp;
<img src="https://img.shields.io/badge/STATUS-STABLE-2ed573?style=for-the-badge" alt="stable"/>
&nbsp;
<img src="https://img.shields.io/badge/SCOPE-PATCH_UPDATE-ffa502?style=for-the-badge" alt="scope"/>
</p>

> **Perfect Crewlink v1.0.1** is a focused patch release built around polish and correctness: overlay state stays aligned after focus changes, quieter speakers register more reliably, the app returns cleanly to waiting when Among Us closes, and stale public-lobby rows stop pretending to be joinable.

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-OVERLAY_&_VOICE-24C8DB?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**Cleaner overlay behavior in real play.** This patch targets the focus-change bugs and voice-presence edge cases that were making the overlay feel inconsistent.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Alt-tab and focus-restore desync that could make the overlay highlight the wrong player
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Overlay talk detection for quieter but still audible speakers

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-APP_FLOW-8b5cf6?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**The session now exits cleanly.** Perfect Crewlink no longer gets stranded in the wrong screen after the game process is gone.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; App flow that could leave Perfect Crewlink sitting on Public Lobbies after Among Us closed
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Return path back to the proper `Waiting for Among Us` state when the game exits

<img src="static/images/divider.svg" width="100%" alt="divider"/>

### <img src="https://img.shields.io/badge/-PUBLIC_LOBBY_BROWSER-f368e0?style=flat-square" height="22"/>

<table>
<tr>
<td valign="top">

**Less fake availability, fewer dead rows.** The browser now reacts better when the live public feed and the code probe disagree.

</td>
</tr>
</table>

- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Stale public-list entries that were shown as fake `UNAVAILABLE` rows after the server reported the lobby was no longer public
- <img src="https://img.shields.io/badge/IMPROVED-ffa502?style=flat-square"/> &nbsp; Retry handling for transient lobby-code lookup failures so a bad response does not get cached forever

<img src="static/images/divider.svg" width="100%" alt="divider"/>

<div align="center">

<img src="static/images/footer.svg" width="100%" alt="footer"/>

<br/>

<sub><strong>Perfect Crewlink</strong> &middot; Changelog v1.0.1 &middot; 2026-04-10</sub>

</div>

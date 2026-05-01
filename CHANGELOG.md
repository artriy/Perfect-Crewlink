<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:C51111,50:24C8DB,100:C51111&height=140&section=header&text=Changelog&fontSize=52&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=Perfect%20Crewlink%20release%20notes&descSize=16&descAlignY=60&descAlign=50" width="100%" alt="Changelog"/>

</div>

<img src="static/images/divider.svg" width="100%" alt="divider"/>

# <img src="https://img.shields.io/badge/v1.0.5-C51111?style=for-the-badge&logo=rocket&logoColor=white" alt="v1.0.5"/> &nbsp; Reliable Meetings + Voice

<p>
<img src="https://img.shields.io/badge/RELEASED-2026--05--01-24C8DB?style=for-the-badge" alt="released"/>
&nbsp;
<img src="https://img.shields.io/badge/STATUS-STABLE-2ed573?style=for-the-badge" alt="stable"/>
&nbsp;
<img src="https://img.shields.io/badge/HIGHLIGHT-ALELUDU_%2B_VOICE-8b5cf6?style=for-the-badge" alt="highlight"/>
</p>

> **Perfect Crewlink v1.0.5** focuses on correctness: meeting highlights follow real game cards, TOU Mira cosmetics render again, and stale voice links show as broken instead of pretending to work.

### <img src="https://img.shields.io/badge/-MEETING_CARDS-24C8DB?style=flat-square" height="22"/>

- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Highlights use Rust-read `MeetingHud.playerStates` / `PlayerVoteArea.TargetPlayerId`.
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Guesses, deaths, swaps, and disconnects no longer reshuffle card highlights.
- <img src="https://img.shields.io/badge/NEW-2ed573?style=flat-square"/> &nbsp; Added Settings → Overlay → **AleLudu meeting layout**.

### <img src="https://img.shields.io/badge/-VOICE_STATUS-8b5cf6?style=flat-square" height="22"/>

- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Crewlink now detects stale remote audio streams and failed WebRTC transports.
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Players whose voice drops now show the no-voice/disconnected icon without waiting for someone else to talk.

### <img src="https://img.shields.io/badge/-COSMETICS-2ed573?style=flat-square" height="22"/>

- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; TOU Mira hats, skins, visors, and clothing load from active outfit data.
- <img src="https://img.shields.io/badge/FIXED-C51111?style=flat-square"/> &nbsp; Outfit dictionary order no longer drops visible clothes from Crewlink icons.

### <img src="https://img.shields.io/badge/-PACKAGING-2ed573?style=flat-square" height="22"/>

- <img src="https://img.shields.io/badge/Windows-Installer-0078D4?style=flat-square&logo=windows11&logoColor=white"/> &nbsp; `Perfect Crewlink_1.0.5_x64-setup.exe`
- <img src="https://img.shields.io/badge/Windows-Portable-0078D4?style=flat-square&logo=windows11&logoColor=white"/> &nbsp; `perfectcrewlink.exe`

<img src="static/images/divider.svg" width="100%" alt="divider"/>

## Previous releases

### v1.0.4 — Overlay, voice, and TOU Mira cleanup

- Kept overlay attached to Among Us after Alt-Tab.
- Improved proximity audio panning and game-window behavior.
- Improved early TOU Mira cosmetic lookup paths.

### v1.0.3 — AleLudu overlay groundwork

- Added earlier AleLudu meeting overlay support.
- Improved meeting slot stability after mid-meeting deaths.
- Returned to waiting screen cleanly when Among Us closes.

<img src="static/images/divider.svg" width="100%" alt="divider"/>

<div align="center">

<img src="static/images/footer.svg" width="100%" alt="footer"/>

<br/>

<sub><strong>Perfect Crewlink</strong> &middot; Changelog v1.0.5 &middot; 2026-05-01</sub>

</div>

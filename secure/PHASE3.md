# Gridiron Gold — Phase 3 (V7)

This release builds on the secure, season-long Football Squares app. It does **not** change storage, the 100 fixed player positions, weekly digit locks, or the authentication system.

## UI changes
- Fixed board mode: Compact = 650px on desktop / 575px on small screens; Large = 990px / 900px. The actual grid and cell dimensions now change rather than merely changing a minimum width.
- Added on-screen board mode readout; mode saved to local browser preference.
- Improved stadium lighting, field atmosphere, scoreboard depth and current-winner highlight.
- Added a restrained flash when an updated score changes the current leader.
- Refined quarter-winner dialog, reduced confetti count and honored the reduced-motion preference.
- Rebuilt audio mix controls: Enable audio, Stop audio, separate crowd/announcer volume, and an announcer switch. Existing ElevenLabs clips are reused; no synthetic crowd effect was reintroduced.
- Kept the original team icons for this release; helmet replacement postponed as requested.

## Notes
- Vercel still needs an ELEVENLABS_API_KEY and owner-triggered generation for any missing audio clips.
- Existing private Vercel Blob data is reused. No migration or reset.
- Browser verification used a simulated, non-destructive read-only game; production owner workflows should still be tested with the real account.
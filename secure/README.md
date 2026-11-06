# Football Squares — Secure Season Pool

New isolated Vercel app. The originals in `index.html`, `hybrid.html`, `casino.html`, and `hybrid-v3.html` are preserved separately in the repository.

## Rules

- 100 stable season-long square positions. Only authenticated owner edits participant names.
- Every week/game has its own independently assigned 0–9 Bengals (columns) and Steelers (rows) digits.
- New games preserve all season-long square owners; previous games preserve their own score-digit assignments and quarter-winner snapshots.
- Owner controls score and quarter adjudication; public viewing auto-polls the same private server-side record.

## Setup

Create a **private** Vercel Blob store and connect it to the project to provision `BLOB_READ_WRITE_TOKEN`. Configure `OWNER_SETUP_CODE` and `SESSION_SECRET` (cryptographically random, private environment variables). Deploy to Vercel. Open app, select Owner access, use the setup code once to create a 12+ character owner password. The password is scrypt-hashed and stored privately; never commit secrets to Git.

## Security boundaries

Server-side credential verification, HMAC signed 12-hour HttpOnly/Secure/SameSite=Strict cookie, same-origin write checks, and owner-only mutations. Blob state is accessed server-side with `useCache:false`, optimistic ETag `ifMatch` writes, and limited retries. The private store is **object storage, not relational SQL**; it is sufficient for a single owner managing a modest pool but a transactional SQL database and proper auth service are recommended before scaling to multiple owners or high-frequency concurrent edits. There is no automated NFL feed yet, and this build uses manual scores.

Deployment tip: do not enable Vercel Authentication on the entire project, since public visitors must be able to view the board. Access checks are done by the application.


## ElevenLabs sound pack (V4)

The old synthesized noise-generator has been removed. Admin-only **Audio Studio** generates six fixed reusable clips through ElevenLabs (3 crowd/stadium/game effects and 3 announcer voiceovers). Assets are stored as **private** Vercel Blob MP3 objects and proxied through `/api/audio?clip=...` for public playback.

**Required secret:** add `ELEVENLABS_API_KEY` to the **football-squares-season-pool** Vercel project's production (and optional preview) environment, then redeploy. **Optional:** `ELEVENLABS_VOICE_ID` for the voice selected in your ElevenLabs account; default uses ElevenLabs George example ID. Do not commit keys or expose them to browsers.

Once configured, owner signs in, uses **ElevenLabs Audio Studio**, and generates each of six clips once. ElevenLabs credits are used on clip generation only, not repeated playback. Server will refuse overwriting an existing clip. No sound is played until the spectator checks the sound toggle, satisfying browser autoplay rules. If an asset is missing or API not configured, playback is silent (no synthesized fallback).

Templates are fixed to prevent public callers from spending credits or generating arbitrary content. If you want player-name announcements later, implement an owner-approved queue with rate limits, caching and spend caps.


## Phase 1 — redesigned operating experience

- Spectator-first layout: live scores, winning square, board, and recent winners. Owner controls live in a separate workspace with Season Board, Weekly Setup, Game Day, and Audio Studio tabs.
- Mobile board: scroll cue, compact/large square modes, keyboard-accessible fullscreen control with Escape, and selected-square detail. Grid still uses exact 11 columns (one score-digit heading plus ten squares).
- New weekly games require explicit **Save Number Assignments → Review → Lock Weekly Numbers** before scores can be entered. Locking is enforced by the server, not solely by disabled buttons. Names stay fixed by season position and remain owner-editable even after digits are locked.
- Existing historical games without `digitsLocked` or `numbersAssigned` retain their previous behavior to avoid corrupting season history. Newly created games have `digitsLocked:false` and `numbersAssigned:false`.
- The app continues to use the *existing private Blob key* and authentication cookie; deployment does not migrate or erase season data.
- Audio clips remain optional. ElevenLabs settings appear in the owner's Audio Studio, not in the spectator view.

**Verification:** Browser DOM and interaction tests on desktop and mobile with mocked API state, plus new-game/save/lock/score transition tests. Before relying on the live pool, verify authenticated owner and public viewing with a nonproduction test pool.


## Phase 2 — operational confidence (V6)
- Clear visual distinction: unclaimed, claimed, live leader and confirmed quarter winners; mobile-friendly status legend.
- Owner bulk import: paste spreadsheet rows `square,name` or tab-delimited; preview validation, explicit occupied-square replacement opt-in, guarded all-or-nothing save, unique positions.
- Existing single-name edits now send expected prior value to prevent stale overwrite.
- Owner-only `/api/history` provides the latest 100 recorded actions; undo eligible latest square-name change through server-checked `undoName`.
- This preserves the existing state schema, owner authentication, private Vercel Blob store, and prior winners. No data migration.
- Audit logs retain 200 events (existing cap) and are administrative diagnostics, not a permanent compliance ledger.
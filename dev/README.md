# Gridiron Gold DEV — ESPN Live Feed (V8)

This release is **DEV ONLY**, not the live pool. Its public demo lives at https://football-squares-season-pool-dev.vercel.app and uses a separate private Vercel Blob store and developer owner account.

## Configure

1. Sign in to the DEV owner account.
2. If this is a new pool week, create the week under **Weekly Setup** and assign/shuffle the numbers. Save and LOCK the digits.
3. Open **Game Day → ESPN live NFL scores · DEV**.
4. Choose the Monday marking the beginning of the NFL week, then **Find NFL games**. The date lookup includes the following Monday-night game.
5. Select one Bengals game and one Steelers game (they often play **different opponents**), then **Connect games to this week**.
6. The public scoreboard refreshes ESPN scores every 30 seconds while a viewer has the page open. An authenticated DEV owner viewing the active week automatically saves changed ESPN scores, subject to the saved/locked game rules.
7. At the end of a quarter in **both teams' games**, **Confirm completed ESPN quarter** uses each team's independently derived historical quarter score; it never uses a potentially later live score for an earlier quarter. Quarter winner confirmation remains manual to avoid prematurely awarding a prize.
8. Manual entry and **Disable ESPN for this week** remain available until quarters are recorded. After a quarter has been confirmed, game-event changes and disabling ESPN are blocked to protect winner records.

## Important limitations

* The ESPN data source is undocumented and unofficial; reliability, permission, formats, and availability can change without notice. Not recommended for production prizes without verifying source terms and manually cross-checking the results.
* No automatic process runs when everybody closes the page. The public display fetches live scores while pages are open; authenticated owner pages additionally persist scores. An independent scheduled job would be needed for continuous background persistence.
* Automatic quarter **winner confirmation is deliberately disabled**. The owner must confirm each winner using the button once both teams have finished the period, including the final.
* NFL overtime: Q4/FINAL uses the actual final team score, including overtime.
* Requires ESPN_DEV_ENABLED=true in **DEV only** Vercel environment. Production remains unchanged.
* The unauthenticated live-feed endpoint reads the configured game data but does not write it. Server-side access controls protect setup, syncing, and confirmations.
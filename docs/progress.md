# Progress

## Build steps
- [x] 0. Project setup
- [x] 1. Foundation: design system, page layouts, Tiger Data database and core schema
- [x] 2. Accounts and teams: Auth0 login, team membership, participant and organizer roles, server-side access checks
- [x] 3. Help workflow: post, accept, chat, submit outcome, confirm
- [x] 4. Scoring: the 20/5/0 pair rule, duplicate-award prevention, auditable points ledger
- [ ] 5. Gemini review: contribution summaries, evidence-backed flags, organizer review queue
- [ ] 6. Presentation: live leaderboard, contribution receipts, activity charts, labelled demo scenarios
- [ ] 7. Deployment and verification: Vultr, end-to-end testing, fixes, demo rehearsal

## Decisions

### Product
- Organizer role is the Auth0 RBAC role `organizer`, added to the ID token as the claim `https://lifts.app/roles` by a post-login Action. Until Hack the Hill's organizers opt in, our team acts as the organizers on Lifts.
- Live updates use polling every 3–5 seconds.
- Evidence in the MVP is links, diffs, or text. Screenshot upload is a stretch goal.
- Demo teams (`is_demo`) are labelled "Demo" and hidden from the leaderboard unless someone turns them on.
- Help threads show a notice: visible to both teams and organizers, and reviewed by an AI model for scoring integrity.
- Leaderboard ties: more distinct teams helped wins, then whoever reached the score first.
- Our proposed award is "Best Community Contribution". It is not an official Hack the Hill prize, and it is never called "Open Source".

### Step 0
- Environment variables are validated one at a time, on first read, through the zod schema in `src/server/env.ts`. Builds and CI need no secrets; a missing variable only fails the feature that reads it.
- API errors share one JSON shape: `{ "error": { "code", "message", "details"? } }`. `errorResponse()` in `src/server/errors.ts` maps typed errors to 400/401/403/404/409, turns zod errors into 400 with field errors, and hides anything else behind a generic 500.
- The template's Geist fonts, favicon, and sample images were removed. Step 1's design system picks fonts and icons.
- CI uses `actions/checkout@v7` and `actions/setup-node@v7`, the current major versions.

### Step 1
- The design system is in `docs/design.md`: six colors, Atkinson Hyperlegible Next for the interface and Atkinson Hyperlegible Mono for the receipt, codes, and snippets. Tailwind's default palette and shadows are cleared in `globals.css`, so only our tokens can be used.
- Pages run on typed mock data from `src/lib/mock.ts`, with Team Maple as the signed-in team. Buttons are inert and the "Log in" link points at `/auth/login`, which 404s until step 2 adds Auth0.
- The local database uses `timescale/timescaledb:latest-pg18` rather than pg17, because new Tiger Cloud services have used Postgres 18 by default since January 2026.
- `npm run typecheck` runs `next typegen` first, because the page components use the generated `PageProps` route types.
- Migrations marked `-- no-transaction` are split into statements and run one at a time on a single reserved connection, so statements like `create index concurrently` work.
- `organizer_actions` is append-only through a trigger that rejects updates, deletes, and truncates.
- `activity_events.team_id` is the acting team and `counterpart_team_id` the other team. `duration_s` holds the wait time on `request_accepted` and the solve time on `resolution_confirmed`, which is what `response_times_15m` averages. `is_demo` comes from the acting team, or the counterpart when there's no acting team.
- Seeding refuses a database that already has teams. `db:reset` and the test setup drop and migrate on separate connections, because the TimescaleDB extension is dropped with the schema.
- "Local" means a loopback host only (`localhost`, `127.0.0.1`, `::1`), so a container host named `db` never counts as local.
- The build prints "Failed to find font override values" for both Atkinson fonts. Next.js has no fallback metrics for them yet; it's harmless, and the CSS fallback stack applies.
- Integration tests share the one test database. Later steps that add more integration test files need to keep their data separate (their own teams, or `fileParallelism: false`).

### Step 2
- Auth0 setup is in `docs/auth0-setup.md`. The session keeps the default ID token claims plus `https://lifts.app/roles` through `beforeSessionSaved`. Roles are read from the session on every request, never stored in the database or taken from the client.
- The Auth0 client is created lazily from `env.ts`. Without the four `AUTH0_*` variables, the proxy lets pages through signed out and `/auth/*` returns a 503 that says sign-in isn't set up, so builds and CI still need no secrets.
- The pure checks (`assertUser`, `assertTeamMember`, `assertOrganizer`, `assertCanViewThread`) are in `src/server/auth/access.ts`, so services, scripts, and the worker can use them without loading the Auth0 SDK. `guards.ts` adds the session-reading `getViewer()` and `require*()` helpers; `pages.ts` has the page versions, which redirect instead of returning 401/403.
- Services take `(tx, actor, ...)`. Organizer services call `assertOrganizer` themselves, so a participant gets a 403 however the service is reached.
- Migration `0003` adds the activity types `user_created` (first sign-in creates the `users` row) and `invite_issued`.
- Creating a team and issuing an invite write `organizer_actions` rows with a reason Lifts fills in ("Registered Team Maple", "Issued an invite code … with 4 uses"). Moving a member requires the organizer's own reason.
- Invite codes allow 1 to 20 uses (default 4). Joining claims a use atomically (`uses < max_uses`), and `team_members`' primary key still stops a second team if two joins race.
- A signed-in participant without a team is sent to `/join` from every page. Organizers don't need a team, so they aren't. Organizers see "Review queue" and "Teams" in the header.
- `/requests/[id]` only requires a team for now; step 3 adds `assertCanViewThread` there (including its metadata) once requests come from the database.
- Integration tests for services run each test in a transaction that rolls back, so they don't disturb the seeded counts in `db.integration.test.ts`. Route tests fake only the Auth0 session and the database (`test/route-auth.ts`) and keep the real guards.

### Step 3
- The state machine is in `src/domain/requests.ts`. `checkTransition` checks the team before the status, so the wrong team gets 403 and the right team at the wrong time gets 409. Services lock the request row (`for update`) before checking; accepting instead uses one conditional update on `status = 'open'`, so of two teams accepting at once exactly one wins and the other gets 409.
- A reopened request can be helped and confirmed again, but it never gets a second confirmed outcome or a second award. Migration `0004` adds `outcomes.reconfirmed_by` and `reconfirmed_at` for the later confirmation, a check that an outcome has at most one decision (confirmed, reconfirmed, or rejected), and the activity type `resolution_reconfirmed`, so analytics don't count the request twice. Only the first confirmation calls `onResolutionConfirmed` (`src/server/services/awards.ts`, a no-op until step 4).
- Reopening and releasing clear `helping_team_id`, so the request goes back on the board for any team. The earlier helper loses access to the thread; the confirmed outcome stays, with the submitter's team shown on it.
- `request_accepted.duration_s` is the wait since the request was last opened: posted, released, or reopened. `resolution_confirmed.duration_s` is the time since it was accepted.
- Every state change also adds a system message to the thread ("Team Orbit is helping"). Posting does too, so a thread's history starts with who asked.
- Anyone signed in can read a blocker's details, like on the board. Messages and outcomes need thread access (`assertCanViewThread`); only the two teams write, and only while someone is helping. Organizers can read every thread but take no request actions.
- The board shows open blockers. "My team's requests" shows everything the team posted or is helping with, in any status, labelled. Tags keep the case they were typed in; duplicates and the tag filter ignore case.
- Result messages come back from the API with each action. Actions outside the brief's table: "Stop helping" → "You stopped helping Team Aurora", "Cancel blocker" → "Blocker cancelled", "Reopen blocker" → "Blocker reopened". "Stop helping" and "Cancel blocker" ask for confirmation first. Until step 4, confirming shows "Fix confirmed." with no points.
- "Meet at our table" posts "Meet at our table: Table 12." with the sender's table, or without it when the team has none.
- Link and screenshot evidence must be an `http(s)` URL, so a `javascript:` link can't be stored.
- The board and thread poll every 4 seconds with `usePoll`, which pauses while the tab is hidden. The thread only fetches messages newer than the last one it has.
- Vitest runs test files one at a time (`fileParallelism: false`). The accept race needs committed data in two real transactions; `test/fixtures.ts` removes it afterwards, so the seeded counts in `db.integration.test.ts` still hold.
- The mock blockers and threads are gone from `src/lib/mock.ts`. The leaderboard, receipts, and review queue still use mock awards until steps 4 to 6, so their "Request #104"-style links now go to 404 pages.

### Step 4
- The migration is `0005_scoring.sql`, since `0003` and `0004` were already taken. Besides the columns the step lists, `awards` keeps `outcome_id` (the request's first confirmed outcome, which the receipt links to) and `created_at`, and checks that `team_low_id`/`team_high_id` match the helper and recipient and that a reversed award has a reason.
- `points_after` on a ledger row is the award's points after the change, so each award's deltas add up to its points. Team totals are the sum of a team's deltas. A row is written whenever an award's points or sequence change, including 0-point changes (a 3rd resolution, or one moving from 3rd to 4th), so the ledger shows every re-sequencing. Reasons: `awarded` for an award's first row, `reversed`, `restored` for a reversed award counting again, and `resequenced` for everything else. Rows caused by an organizer decision, including the other awards it re-sequences, carry that `organizer_action_id`.
- The pair lock is `pg_advisory_xact_lock(hashtextextended('awards:<low>:<high>', 0))`. `reverseAward` and `restoreAward` take it before locking the award row, the same order `recomputePair` uses, so they can't deadlock with a confirmation.
- An award's `confirmed_at` is the outcome's confirmation time at millisecond precision (as JavaScript carries it), so `sequencePair`'s ordering and the SQL index agree exactly.
- `onResolutionConfirmed` returns the new award, so the confirm route says "Fix confirmed. Team Maple earned 20 points." with the real numbers. A reconfirmation after a reopen still says "Fix confirmed." The points-landing animation is left for step 6.
- The leaderboard lists teams with at least one award that counts. "Teams helped" counts distinct recipients of those awards, including 0-point ones. "Reached the score first" is the time of the team's latest counted award worth more than 0; the team name breaks any tie that's left.
- Receipts are public and show the request title, the helper's summary (what the requesting team confirmed), and the scoring explanation, never messages. The evidence link is the URL for link and screenshot evidence, and otherwise the outcome on the request page. The outcome and confirmation anchors only render for people who can see the thread (step 3's rule); everyone else lands on the blocker details.
- A reversed award shows 0 points, its explanation ("Reversed by an organizer: …"), and the Reversed badge. Reverse and restore are API-only (`POST /api/awards/[id]/reverse` and `/restore`, body `{ "reason" }`) until step 5's review queue adds the buttons.
- The team page reads members and skills from `getTeamProfile`, which is public like the receipt. `src/lib/mock.ts` now only feeds the review queue.
- The seed resolves Maple's four blockers in its one transaction, so they share a confirmation time and are ordered by award id.
- `npm run ledger:verify` is read-only and runs in one repeatable-read snapshot, so it's safe against production.
- Test cleanup (`removeTeams`) turns off the ledger's append-only trigger inside its own transaction to remove committed test data. The concurrent-confirmation test holds both confirmations at the award insert with a share lock on `awards` and releases them together; without the pair lock it fails with two 20-point awards.

### Design change: Hack the Hill III theme
- Not a numbered step. The look now matches Hack the Hill III (hackthehill.com and its tracker app), with the colors taken from their CSS: maroon `#84010B`, ink `#650014`, cream `#FFF3B6`, golden `#F6BF70`, brick `#C11F25`, sand `#F5C18C`, and the tracker's hero gradient `#C7734F → #EA8A60 → #EE9E6F → #F6BC83`. The existing tokens kept their names and were re-mapped; `brick`, `sand`, and `sunset-1`–`4` were added. Details and the contrast table are in `docs/design.md`.
- Rubik (the event's interface face, OFL) is used for headings, the wordmark, nav, and the hero. Body text and forms stay in Atkinson Hyperlegible Next, because Rubik's `I`, `l`, and `1` are hard to tell apart at arm's length. Coolvetica, the event's display face, is commercial, so the hero uses Rubik ExtraBold instead.
- `ink-soft` is now 82% ink (was 72%) so secondary paragraphs still reach 7:1 on the cream ground.
- Radii went from 4/8px to 6/12px; buttons use the 12px radius, like the site's "Apply Now".
- The landing page's explanatory paragraph moved below the hero band, because the gradient's top stop can't carry body text at 7:1. The event line sits in a maroon pill for the same reason.
- None of the event's logo, wordmark, illustrations, leaf art, or files are used; the three hero leaves are drawn from scratch and never move. The footer says "Built at Hack the Hill III" and nothing presents Lifts as official.
- Added a themed `not-found.tsx`, since Next's built-in 404 ignored the theme (and went black in dark mode). Its action is "Go to the board".

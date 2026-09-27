# Progress

## Build steps
- [x] 0. Project setup
- [x] 1. Foundation: design system, page layouts, Tiger Data database and core schema
- [x] 2. Accounts and teams: Auth0 login, team membership, participant and organizer roles, server-side access checks
- [ ] 3. Help workflow: post, accept, chat, submit outcome, confirm
- [ ] 4. Scoring: the 20/5/0 pair rule, duplicate-award prevention, auditable points ledger
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

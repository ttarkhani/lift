# Progress

## Build steps
- [x] 0. Project setup
- [x] 1. Foundation: design system, page layouts, Tiger Data database and core schema
- [ ] 2. Accounts and teams: Auth0 login, team membership, participant and organizer roles, server-side access checks
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

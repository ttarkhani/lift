# Lifts

Lifts rewards hackathon teams for helping other teams get unblocked, with evidence behind every point. Teams post blockers, other teams help, and every confirmed fix earns the helpers points and a contribution receipt.

Built at Hack the Hill III (uOttawa, September 25–27, 2026). Live at **https://lifts-mbjt.onrender.com**. It runs on a free Render instance, so the first visit after a quiet spell can take about a minute to load.

Try the demo at **https://lifts-mbjt.onrender.com/demo**, a read-only tour with invented teams. No login needed.

## How it works

1. **Join your team.** Use the invite code from the organizers and list the skills you can help with.
2. **Post a blocker.** Describe the problem, add tags, and say what you already tried.
3. **Another team helps.** They accept the blocker and get a private help thread to chat, share code, or meet at your table.
4. **Submit the outcome.** The helpers explain what they did and add evidence. Your team confirms it's fixed or sends it back.
5. **Earn points and a receipt.** The helping team earns points once per request, and the leaderboard updates.

## Scoring

Points go to the helping team and are counted per pair of teams across the whole event, in either direction:

| Confirmed resolutions between the same two teams | Points to the helper |
|---|---|
| 1st | 20 |
| 2nd | 5 |
| 3rd and later | 0 (still listed on the receipt) |

Helping a new team always starts at 20. For example, A helps B, B, C, then B: 20 + 5 + 20 + 0 = 45 points. Messages, time spent, opening blockers, and reopening them earn nothing.

## Keeping points honest

- **Invite codes.** Organizers create teams and invite codes. Each person joins one team, and membership locks once they join. Only an organizer can move someone, and moving someone needs a reason.
- **The team that asked confirms.** Helpers can't confirm their own fix.
- **One award per blocker.** Confirming twice or reopening a blocker never pays again.
- **An append-only points ledger.** Every points change adds a ledger row. `npm run ledger:verify` checks that the ledger matches the awards and the leaderboard.
- **Reversals need a reason.** Organizers can reverse or restore an award through the API. The reason is recorded, and the pair is re-scored.
- **Checked on the server.** Pages and API routes that need a sign-in, a team, or the organizer role check it on the server, never only in the browser.
- **An activity history.** Every state change writes a row to a TimescaleDB hypertable in the same transaction.

## Pages

| Page | What it's for |
|---|---|
| `/` | What Lifts is, sign-in, and a link to the demo |
| `/join` | Join your team with an invite code |
| `/board` | Open blockers, filterable by tag and by your own team's |
| `/requests/new` | Post a blocker |
| `/requests/[id]` | The help thread: messages, the outcome, and confirming the fix |
| `/leaderboard` | Team rankings. Demo teams are hidden unless you switch them on. Public. |
| `/teams/[slug]` | A team's contribution receipt. Public. |
| `/organizer/teams` | Organizers create teams, issue invite codes, and move members |
| `/demo` | A read-only tour with invented teams: the board, a worked help thread whose fix you can confirm in the page, the leaderboard, and Team Maple's receipt. Nothing is saved, and it never reads the database. Public. |

## Stack

- **Next.js 16** (App Router) and **TypeScript**: the web app, its API routes, and the scripts.
- **Tailwind CSS**: mobile-first styling in the Hack the Hill III palette (see [docs/design.md](docs/design.md)).
- **Tiger Cloud (PostgreSQL 18 + TimescaleDB)**: teams, requests, awards, the points ledger, and the activity history, with continuous aggregates for analytics.
- **Auth0**: sign-in, team membership, and the organizer role.
- **Render**: hosts the app and redeploys on every push to `main`.
- **Vitest and GitHub Actions**: 24 test files, including database integration tests that CI runs against a TimescaleDB container.

## Getting started

Prerequisites: Node 24 (see `.nvmrc`), npm, and Docker (or a free Tiger Cloud service, below).

```sh
npm install
cp .env.example .env.local
npm run db:up        # starts TimescaleDB on localhost:5432 and waits until it's healthy
npm run db:migrate   # applies db/migrations/*.sql
npm run db:seed      # adds teams, members, open blockers, and Team Maple's four confirmed fixes (65 points), and prints each team's invite code
npm run dev
```

Fill in the `AUTH0_*` values in `.env.local` first. The Auth0 application, the `organizer` role, and the post-login Action are set up once per tenant; [docs/auth0-setup.md](docs/auth0-setup.md) walks through them and how to make someone an organizer. The team shares the Auth0 values privately, never through the repo. Without them the app still runs, but everyone is signed out.

Open http://localhost:3000 (use `localhost`, not `127.0.0.1`, or login fails with a state mismatch). Log in, then join a team at `/join` with an invite code from `npm run db:seed` or from an organizer's **Teams** page. `GET /api/health` returns `{ "ok": true, "db": "up" }` when the database is reachable, and a 503 with `"db": "down"` when it isn't.

The local database runs `timescale/timescaledb:latest-pg18` from `compose.yaml` with a named volume, so data survives restarts. The first start also creates a `lift_test` database for integration tests. `npm run db:reset` drops everything, migrates, and seeds again (local databases only). To wipe the volume completely, run `docker compose down -v`.

### Using Tiger Cloud instead of Docker

1. Create a free service at [console.cloud.tigerdata.com](https://console.cloud.tigerdata.com). New services run Postgres 18 with TimescaleDB, the same as the local container.
2. Copy the service URL into `DATABASE_URL` in `.env.local`. Keep `?sslmode=require` on the end, because Tiger Cloud only accepts SSL connections.
3. Run `npm run db:migrate`. Seeding a remote database needs `ALLOW_REMOTE_SEED=1`, and must never be run against production.

If you use Tiger Cloud's connection pooler, the transaction pool is the database named `tsdb_transaction`. The app detects it and turns off prepared statements, which that pool doesn't support.

Integration tests only ever use `TEST_DATABASE_URL`, and they wipe it on every run. Test files run one at a time, because they share that database. It has to be a local database unless `CI` is set. When it's unset, those tests are skipped.

## Deployment

Production runs on Render as a Node web service connected to this repository, with the database on Tiger Cloud.

| Render setting | Value |
|---|---|
| Build command | `npm ci --include=dev && npm run db:migrate && npm run build` |
| Start command | `npm run start` |
| Health check path | `/api/health` |
| Node version | Read from `.nvmrc` (24) |

Environment variables:

- `DATABASE_URL`: the Tiger Cloud service URL with its password, ending in `?sslmode=require`.
- `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`: from the Auth0 application.
- `AUTH0_SECRET`: a separate value for production (`openssl rand -hex 32`).
- `APP_BASE_URL`: the exact public URL, with no trailing slash.
- `EVENT_NAME` and `EVENT_TIMEZONE`: for example `Hack the Hill` and `America/Toronto`. The time zone must be a valid IANA name, or the help thread and receipt pages fail to load.

The Auth0 application lists `<APP_BASE_URL>/auth/callback` as a callback URL and `<APP_BASE_URL>` as a logout URL and web origin, alongside the localhost ones. Migrations run during every build. Production is never seeded: organizers create teams and invite codes on the **Teams** page.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the development server. |
| `npm run build` | Builds the production app (standalone output). |
| `npm run start` | Serves the production build. |
| `npm run lint` | Runs ESLint. |
| `npm run typecheck` | Generates route types with `next typegen`, then type-checks with `tsc --noEmit`. |
| `npm run test` | Runs the Vitest suite once, including database integration tests when `TEST_DATABASE_URL` is set. |
| `npm run check` | Runs lint, then typecheck, then tests. |
| `npm run db:up` | Starts the local TimescaleDB container and waits until it's healthy. |
| `npm run db:migrate` | Applies pending SQL migrations to `DATABASE_URL`. |
| `npm run db:seed` | Seeds an empty database and prints invite codes. Refuses non-local databases unless `ALLOW_REMOTE_SEED=1`. |
| `npm run db:reset` | Drops the schema, migrates, and seeds. Local databases only. |
| `npm run ledger:verify` | Checks that every award's ledger rows add up to its points and every team's ledger total matches the leaderboard. Exits non-zero on any mismatch. Read-only. |

## Project structure

```
src/app/              pages and thin API route handlers
src/components/       UI components
src/lib/              client helpers
src/demo/             the public demo's invented data (shared with the seed) and components
src/domain/           pure logic and types: scoring, request states, schemas
src/server/           env, errors, auth, database, and activity events
src/server/services/  business rules and state changes
db/migrations/        numbered SQL migrations
db/docker-init/       scripts the local database runs on first start
scripts/              migrate, seed, reset, and ledger-check scripts
test/                 Vitest global setup for the test database
docs/                 brief, progress, design, and the Auth0 setup guide
.github/workflows/    CI
```

## Build steps

| Step | What it adds | Run by |
|---|---|---|
| 0 | Project setup | ttarkhani |
| 1 | Foundation: design system, page layouts, Tiger Data database and core schema | ttarkhani |
| 2 | Accounts and teams: Auth0 login, team membership, participant and organizer roles, server-side access checks | RayanKetata |
| 3 | Help workflow: post, accept, chat, submit outcome, confirm | RayanKetata |
| 4 | Scoring: the 20/5/0 pair rule, duplicate-award prevention, auditable points ledger | Nabil Hersi |
| 5 | Presentation: the Hack the Hill III theme and the judges' demo | Whole Team |
| 6 | Deployment and verification: Render and Tiger Cloud in production, end-to-end testing, fixes, demo rehearsal | Moustapha Ahmed |
| Final change | Public demo: a read-only tour at `/demo` with invented teams, no login needed | ZakariaKandid |

## Team

- Taha Tarkhani
- Moustapha Ahmed
- Rayan Ketata
- Nabil Hersi

# Lifts

Lifts rewards hackathon teams for helping other teams get unblocked, with evidence behind every point. Teams post blockers, other teams help, and every confirmed fix earns the helpers points and a contribution receipt.

## How it works

1. **Join your team.** Use the invite code from the organizers and list the skills you can help with.
2. **Post a blocker.** Describe the problem, add tags, and say what you already tried.
3. **Another team helps.** They accept the blocker and get a private help thread to chat, share code, or meet at your table.
4. **Submit the outcome.** The helpers explain what they did and add evidence. Your team confirms it's fixed or sends it back.
5. **Earn points and a receipt.** The helping team earns points once per request, and the leaderboard updates.

Points go to the helping team and are counted per pair of teams across the whole event, in either direction:

| Confirmed resolutions between the same two teams | Points to the helper |
|---|---|
| 1st | 20 |
| 2nd | 5 |
| 3rd and later | 0 (still listed on the receipt) |

Helping a new team always starts at 20. For example, A helps B, B, C, then B: 20 + 5 + 20 + 0 = 45 points.

## Stack

- **Next.js** (App Router): the web app and its API routes.
- **TypeScript**: one typed codebase for the app, scripts, and review worker.
- **Tailwind CSS**: mobile-first styling.
- **Tiger Cloud (PostgreSQL + TimescaleDB)**: teams, requests, awards, the points ledger, and time-series activity analytics.
- **Auth0**: login, team membership, and the organizer role.
- **Gemini**: contribution summaries and evidence-backed flags for organizer review.
- **Vultr**: hosts the app and the background review worker.

## Getting started

Prerequisites: Node 24 (see `.nvmrc`), npm, and Docker (or a free Tiger Cloud service, below).

```sh
npm install
cp .env.example .env.local
npm run db:up        # starts TimescaleDB on localhost:5432 and waits until it's healthy
npm run db:migrate   # applies db/migrations/*.sql
npm run db:seed      # adds teams, members, and open blockers, and prints each team's invite code
npm run dev
```

Open http://localhost:3000. `GET /api/health` returns `{ "ok": true, "db": "up" }` when the database is reachable, and a 503 with `"db": "down"` when it isn't.

The local database runs `timescale/timescaledb:latest-pg18` from `compose.yaml` with a named volume, so data survives restarts. The first start also creates a `lift_test` database for integration tests. `npm run db:reset` drops everything, migrates, and seeds again (local databases only). To wipe the volume completely, run `docker compose down -v`.

### Using Tiger Cloud instead of Docker

1. Create a free service at [console.cloud.tigerdata.com](https://console.cloud.tigerdata.com). New services run Postgres 18 with TimescaleDB, the same as the local container.
2. Copy the service URL into `DATABASE_URL` in `.env.local`. Keep `?sslmode=require` on the end, because Tiger Cloud only accepts SSL connections.
3. Run `npm run db:migrate`. Seeding a remote database needs `ALLOW_REMOTE_SEED=1`, and must never be run against production.

If you use Tiger Cloud's connection pooler, the transaction pool is the database named `tsdb_transaction`. The app detects it and turns off prepared statements, which that pool doesn't support.

Integration tests only ever use `TEST_DATABASE_URL`, and they wipe it on every run. It has to be a local database unless `CI` is set. When it's unset, those tests are skipped.

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

## Project structure

```
src/app/              pages and thin API route handlers
src/components/       UI components
src/lib/              client helpers
src/domain/           pure logic and types: scoring, request states, schemas
src/server/           env, errors, auth, database, and review code
src/server/services/  business rules and state changes
db/migrations/        numbered SQL migrations
db/docker-init/       scripts the local database runs on first start
scripts/              migrate, seed, demo, and check scripts
test/                 Vitest global setup for the test database
docs/                 brief, progress, design, and runbooks
.github/workflows/    CI
```

## Build steps

| Step | What it adds | Run by |
|---|---|---|
| 0 | Project setup | ttarkhani |
| 1 | Foundation: design system, page layouts, Tiger Data database and core schema | ttarkhani |
| 2 | Accounts and teams: Auth0 login, team membership, participant and organizer roles, server-side access checks | |
| 3 | Help workflow: post, accept, chat, submit outcome, confirm | |
| 4 | Scoring: the 20/5/0 pair rule, duplicate-award prevention, auditable points ledger | |
| 5 | Gemini review: contribution summaries, evidence-backed flags, organizer review queue | |
| 6 | Presentation: live leaderboard, contribution receipts, activity charts, labelled demo scenarios | |
| 7 | Deployment and verification: Vultr, end-to-end testing, fixes, demo rehearsal | |

## Team

- _Name_
- _Name_
- _Name_
- _Name_

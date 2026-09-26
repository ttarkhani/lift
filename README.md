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

Prerequisites: Node 24 (see `.nvmrc`) and npm. Docker arrives in step 1.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. `GET /api/health` returns `{ "ok": true }`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the development server. |
| `npm run build` | Builds the production app (standalone output). |
| `npm run start` | Serves the production build. |
| `npm run lint` | Runs ESLint. |
| `npm run typecheck` | Type-checks with `tsc --noEmit`. |
| `npm run test` | Runs the Vitest suite once. |
| `npm run check` | Runs lint, then typecheck, then tests. |

## Project structure

```
src/app/              pages and thin API route handlers
src/components/       UI components
src/lib/              client helpers
src/domain/           pure logic and types: scoring, request states, schemas
src/server/           env, errors, auth, database, and review code
src/server/services/  business rules and state changes
db/migrations/        numbered SQL migrations
scripts/              migrate, seed, demo, and check scripts
docs/                 brief, progress, design, and runbooks
.github/workflows/    CI
```

## Build steps

| Step | What it adds | Run by |
|---|---|---|
| 0 | Project setup | ttarkhani |
| 1 | Foundation: design system, page layouts, Tiger Data database and core schema | |
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

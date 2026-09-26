# Lifts: project brief

Lifts rewards teams for helping other teams finish, with evidence behind every point. Target Auth0 + Tiger Data + Vultr, with Gemini reviewing suspicious activity and generating contribution summaries.

The compelling part: people can use it during Hack the Hill, and we can show judges actual problems the platform helped resolve.

## How it works
1. **Join your registered team.** Members list skills they can help with: deployment, design, hardware, APIs, debugging.
2. **Post a blocker.** "Our backend works locally but fails on deployment." Include a description, tags, and what you already tried.
3. **Another team accepts.** They enter a shared help thread. They can chat, share snippets, or meet at a table.
4. **Submit the outcome.** The helper explains what they did; the requesting team confirms what changed. Attach a screenshot, code diff, link, or written explanation.
5. **Receive points and a receipt.** The leaderboard updates, and both teams have a record of the contribution.
For the MVP, assign one helping team per request. Members contribute together without multiplying the reward.

## Scoring that encourages helping different people
Use a transparent starting rule:

| Completed help between the same two teams | Points to the helping team |
|---|---|
| First confirmed resolution | 20 |
| Second distinct resolution | 5 |
| Further resolutions during the event | 0 |
| Helping a new team for the first time | 20 |

Count the pair in both directions, across the entire event. A helping B and B helping A share the same allowance. Helping C does not reset the allowance for B.

Example: A helps B, B again, C, then B again → 20 + 5 + 20 + 0 = 45 points.

People can keep helping their friends, and every contribution still appears in their receipt. The prize score rewards reaching more teams.

No points for message counts, time spent, self-help, opening tickets, or repeatedly reopening the same issue.

## Preventing point farming

| Attempt | System response |
|---|---|
| Create fake teams or switch teams to reset limits | Link accounts to the event roster or organizer-issued invitations; lock scoring membership once participation begins. Auth0 login alone does not establish attendance. |
| Confirm the same resolution several times | Each request has one scoring record; repeated submissions cannot award it again. |
| Split one problem into many tickets | Flag related tickets for review; reopening an existing issue earns no new award. |
| A small group circulates fake help | Detect concentrated exchanges and cycles between teams, then inspect the evidence. |
| Generate long conversations to appear helpful | Conversation length has no scoring value. |
| Invent convincing completion summaries | Require recipient confirmation and supporting context; organizers review the leading teams before awards. |

No scoring formula can eliminate collusion. The combination of limited rewards, registered teams, evidence, and review makes it harder and more visible.

## Where the Gemini agent fits
The agent examines completed requests and team interaction patterns. It produces:
- A concise explanation of the help provided.
- Possible duplicate tickets or unsupported completion claims.
- Suspicious patterns, with links to the relevant messages and requests.
- A recommendation to accept the evidence or request organizer review.
Example finding:

> "These three teams confirmed eight resolutions within four minutes. Six use nearly identical descriptions. Review requests #21–#28."

Automatic rules calculate points; the agent flags uncertainty. An organizer can approve, reject, or reverse an award with a recorded reason. Teams can respond to the flag. Fast answers and repeated collaboration are signals to investigate, not proof of cheating.

Give the agent read access to evidence, while reserving score changes for authorized organizers. Gemini supports structured output, so its findings can become consistent review cards (source: ai.google.dev).

## The contribution receipt
Each team gets a readable record such as:

**Team Maple — 65 confirmed points**
- Helped Team Aurora repair its deployment configuration — 20 points.
- Helped Team Orbit identify a database connection issue — 20 points.
- Helped Team Cedar test its keyboard navigation — 20 points.
- Helped Team Aurora resolve a separate API issue — 5 points.
Each entry links to the request, outcome, recipient confirmation, evidence, and scoring explanation. Pending or reversed awards are labelled.

Track in-app conversations and actions. In-person help gets a summary confirmed by both teams. Full conversations stay available to participants and authorized reviewers; public receipts show agreed summaries.

## Best sponsor challenges
All four of these challenges appear on the MLH prize page for the event. Ranking for this implementation:

| Priority | Challenge | Substantial use in Lifts |
|---|---|---|
| 1 | Auth0 | Team identity, private help threads, participant/organizer permissions, and protected review actions. |
| 2 | Tiger Data | Timestamped interaction history, repeated-pair activity, resolution trends, waiting times, and contribution analytics. |
| 3 | Vultr | Host the API, live updates, and background review workers; demonstrate responsiveness under a measured load. |
| 4 | Gemini | Evidence-based review findings and contribution receipts grounded in actual interactions. |

Use Tiger Data's continuous aggregates for historical metrics; calculate awarded points from the authoritative scoring records. Its time-series aggregation features fit those analytics (source: Tiger Data Docs).

## The proposed award and demo
Call the top-three award "Best Community Contribution." "Open Source" would imply contributions to openly licensed projects, which ordinary help might not involve. This contributor award wasn't found on the MLH prize list; presenting it as an official Hack the Hill prize requires organizer agreement.

Build five screens: help board, help thread, leaderboard, team receipt, organizer review queue.

The demo should show:
1. A team posts a blocker and receives real help.
2. The recipient confirms it; points and the receipt appear.
3. Repeated exchanges earn fewer points.
4. A staged collusion pattern generates an evidence-backed review.
5. An organizer resolves the flag, and the leaderboard updates.
The strongest evidence for judges would be a small live pilot: real teams helped, confirmed blockers resolved, and receipts they can inspect.

## Demo stack and sponsor roles
Use Auth0 + Gemini + Tiger Data, and deploy on Vultr. That gives four relevant sponsor challenges, each with a clear role.

| Challenge | What we build | What judges see |
|---|---|---|
| Auth0 | Login, team membership checks, participant and organizer permissions | A participant cannot modify points; an organizer can review disputed awards. |
| Gemini | Contribution summaries and suspicious-activity analysis | A staged farming pattern gets flagged with specific evidence. |
| Tiger Data | Store interaction events and analyze repeat exchanges, response times, and resolutions | A live activity timeline and leaderboard, with receipts explaining the scores. |
| Vultr | Host the app, API, and background review worker | The entire demo runs on a deployed service that judges can open. |

Development stack:
- Next.js + TypeScript: frontend and API.
- Tailwind: interface.
- Tiger Cloud/PostgreSQL: users, teams, requests, conversations, scoring records, and timestamped events.
- Auth0: authentication and role permissions; the backend checks team access.
- Gemini: runs after a help session closes.
- Vultr: deployed app and background worker.
Prioritize the demo in this order:
1. Request help → another team accepts → recipient confirms → points appear.
2. Show the repeat-team discount working automatically.
3. Show Gemini flagging a suspicious exchange.
4. Switch to the organizer account, review it, and display the contribution receipt.
Auth0 and Gemini give the clearest stage moments. Tiger Data makes the history and scoring analysis substantial. Vultr supports the working deployment. Get that complete flow polished before adding more features.

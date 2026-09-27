import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSql, type Sql } from "@/server/db/client";
import { seed, SEED_REQUESTS, SEED_TEAMS, type SeedResult } from "@/server/db/seed";
import { emitActivity } from "@/server/events";

// Runs against TEST_DATABASE_URL, which test/global-setup.ts resets and migrates.
describe.skipIf(!process.env.TEST_DATABASE_URL)("database", () => {
  let sql: Sql;
  let seeded: SeedResult;

  beforeAll(async () => {
    sql = createSql(process.env.TEST_DATABASE_URL!, { max: 2 });
    seeded = await seed(sql);
  });

  afterAll(async () => {
    await sql?.end();
  });

  async function count(table: string, where = "true"): Promise<number> {
    const [row] = await sql.unsafe<{ n: number }[]>(`select count(*)::int as n from ${table} where ${where}`);
    return row.n;
  }

  it("records every migration", async () => {
    const rows = await sql<{ filename: string }[]>`select filename from schema_migrations order by filename`;
    expect(rows.map((r) => r.filename)).toEqual([
      "0001_core.sql",
      "0002_activity.sql",
      "0003_account_events.sql",
      "0004_reconfirmed_outcomes.sql",
    ]);
  });

  it("seeds teams, members, invites, and open requests", async () => {
    const members = SEED_TEAMS.reduce((n, team) => n + team.members.length, 0);
    expect(await count("teams")).toBe(9);
    expect(await count("teams", "is_demo")).toBe(5);
    expect(await count("users")).toBe(members);
    expect(await count("team_members")).toBe(members);
    expect(await count("invites")).toBe(9);
    expect(await count("help_requests", "status = 'open'")).toBe(SEED_REQUESTS.length);
    expect(await count("activity_events")).toBe(SEED_TEAMS.length + members + SEED_REQUESTS.length);
    expect(seeded.invites).toHaveLength(9);
    for (const { code } of seeded.invites) expect(code).toMatch(/^[A-Z]+-[A-HJ-NP-Z2-9]{4}$/);
  });

  it("refuses to seed twice", async () => {
    await expect(seed(sql)).rejects.toThrow(/already has teams/);
  });

  it("makes activity_events a hypertable with real-time continuous aggregates", async () => {
    const hypertables = await sql`
      select 1 from timescaledb_information.hypertables where hypertable_name = 'activity_events'
    `;
    expect(hypertables).toHaveLength(1);

    const aggregates = await sql<{ view_name: string; materialized_only: boolean }[]>`
      select view_name, materialized_only from timescaledb_information.continuous_aggregates order by view_name
    `;
    expect(aggregates).toEqual([
      { view_name: "activity_5m", materialized_only: false },
      { view_name: "pair_resolutions_1h", materialized_only: false },
      { view_name: "response_times_15m", materialized_only: false },
    ]);

    const policies = await sql`
      select 1 from timescaledb_information.jobs where proc_name = 'policy_refresh_continuous_aggregate'
    `;
    expect(policies).toHaveLength(3);
  });

  it("copies is_demo from the team when emitting activity", async () => {
    const [demo] = await sql<{ id: string }[]>`select id from teams where slug = 'quartz'`;
    const [real] = await sql<{ id: string }[]>`select id from teams where slug = 'maple'`;
    await sql.begin(async (tx) => {
      await emitActivity(tx, { type: "flag_raised", teamId: demo.id, payload: { test: "demo" } });
      await emitActivity(tx, { type: "flag_raised", teamId: real.id, payload: { test: "real" } });
    });
    const rows = await sql<{ is_demo: boolean; test: string }[]>`
      select is_demo, payload->>'test' as test from activity_events where event_type = 'flag_raised' order by test
    `;
    expect(rows).toEqual([
      { is_demo: true, test: "demo" },
      { is_demo: false, test: "real" },
    ]);
  });

  it("feeds the continuous aggregates in real time", async () => {
    const [row] = await sql<{ events: number }[]>`
      select sum(events)::int as events from activity_5m where event_type = 'team_created'
    `;
    expect(row.events).toBe(9);
  });

  it("stops a team from helping itself", async () => {
    await expect(sql`
      update help_requests set helping_team_id = requesting_team_id, status = 'accepted'
      where id = (select min(id) from help_requests)
    `).rejects.toThrow(/help_requests_helper_is_other_team/);
  });

  it("allows only one confirmed outcome per request", async () => {
    const [request] = await sql<{ id: string; created_by: string }[]>`
      select id, created_by from help_requests order by id limit 1
    `;
    const insert = () => sql`
      insert into outcomes (request_id, helper_summary, evidence_kind, evidence, submitted_by, confirmed_by, confirmed_at)
      values (${request.id}, 'Fixed it', 'text', 'Explained the fix', ${request.created_by}, ${request.created_by}, now())
    `;
    await insert();
    await expect(insert()).rejects.toThrow(/outcomes_one_confirmed_per_request/);
  });

  it("keeps organizer actions append-only and requires a reason", async () => {
    const [user] = await sql<{ id: string }[]>`select id from users order by id limit 1`;
    await expect(sql`
      insert into organizer_actions (organizer_user_id, action, target_type, target_id, reason)
      values (${user.id}, 'approve', 'award', 1, '   ')
    `).rejects.toThrow(/organizer_actions_reason_check/);

    const [action] = await sql<{ id: string }[]>`
      insert into organizer_actions (organizer_user_id, action, target_type, target_id, reason)
      values (${user.id}, 'approve', 'award', 1, 'Evidence checks out')
      returning id
    `;
    await expect(sql`update organizer_actions set reason = 'changed' where id = ${action.id}`).rejects.toThrow(
      /append-only/,
    );
    await expect(sql`delete from organizer_actions where id = ${action.id}`).rejects.toThrow(/append-only/);
  });
});

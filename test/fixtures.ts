// Test data for integration tests: teams with one member each, inserted directly.
import { randomUUID } from "node:crypto";
import type { TeamViewer } from "../src/server/auth/access";
import type { Viewer } from "../src/server/auth/viewer";
import type { Sql, Tx } from "../src/server/db/client";

type Db = Sql | Tx;

/** A new team with one member, returned as that member's viewer. Names are unique per call. */
export async function makeTeam(db: Db, label: string, table: string | null = null): Promise<TeamViewer> {
  const key = `${label}-${randomUUID().slice(0, 8)}`.toLowerCase();
  const name = `${label} ${key.slice(-8)}`;
  const run = db as Tx;
  const [team] = await run<{ id: string }[]>`
    insert into teams (slug, name, table_location) values (${key}, ${name}, ${table}) returning id
  `;
  const [user] = await run<{ id: string }[]>`
    insert into users (auth0_sub, display_name) values (${`test|${key}`}, ${`${label} member`}) returning id
  `;
  await run`insert into team_members (user_id, team_id) values (${user.id}, ${team.id})`;
  return {
    userId: user.id,
    displayName: `${label} member`,
    email: null,
    team: { id: team.id, slug: key, name, isDemo: false },
    roles: [],
  };
}

/** A second member of an existing team. */
export async function addMember(db: Db, teamViewer: TeamViewer, label: string): Promise<TeamViewer> {
  const run = db as Tx;
  const [user] = await run<{ id: string }[]>`
    insert into users (auth0_sub, display_name) values (${`test|${randomUUID()}`}, ${label}) returning id
  `;
  await run`insert into team_members (user_id, team_id) values (${user.id}, ${teamViewer.team.id})`;
  return { ...teamViewer, userId: user.id, displayName: label };
}

export async function makeOrganizer(db: Db): Promise<Viewer> {
  const run = db as Tx;
  const [user] = await run<{ id: string }[]>`
    insert into users (auth0_sub, display_name) values (${`test|${randomUUID()}`}, 'Organizer') returning id
  `;
  return { userId: user.id, displayName: "Organizer", email: null, team: null, roles: ["organizer"] };
}

/** Deletes committed test teams and everything that hangs off them. */
export async function removeTeams(sql: Sql, teams: TeamViewer[]): Promise<void> {
  const teamIds = teams.map((t) => t.team.id);
  if (teamIds.length === 0) return;
  await sql.begin(async (tx) => {
    const requests = tx`select id from help_requests where requesting_team_id in ${tx(teamIds)} or helping_team_id in ${tx(teamIds)}`;
    const users = tx`select user_id from team_members where team_id in ${tx(teamIds)}`;
    await tx`delete from activity_events where request_id in (${requests}) or team_id in ${tx(teamIds)} or counterpart_team_id in ${tx(teamIds)}`;
    // The ledger is append-only; only test cleanup lifts that, inside this transaction.
    await tx`alter table points_ledger disable trigger points_ledger_append_only`;
    await tx`delete from points_ledger where award_id in (select id from awards where request_id in (${requests}))`;
    await tx`alter table points_ledger enable trigger points_ledger_append_only`;
    await tx`delete from awards where request_id in (${requests})`;
    await tx`delete from outcomes where request_id in (${requests})`;
    await tx`delete from messages where request_id in (${requests})`;
    await tx`delete from help_requests where id in (${requests})`;
    const userIds = (await tx<{ user_id: string }[]>`${users}`).map((row) => row.user_id);
    await tx`delete from team_members where team_id in ${tx(teamIds)}`;
    if (userIds.length > 0) await tx`delete from users where id in ${tx(userIds)}`;
    await tx`delete from teams where id in ${tx(teamIds)}`;
  });
}

const rollback = new Error("rollback");

/** Runs `fn` in a transaction that always rolls back, so its data never reaches other tests. */
export async function inRollback(sql: Sql, fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await sql.begin(async (tx) => {
      await fn(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTeamSchema, issueInviteSchema, joinTeamSchema, moveMemberSchema } from "@/domain/teams";
import { loadViewer, type Viewer } from "@/server/auth/viewer";
import { createSql, type Sql, type Tx } from "@/server/db/client";
import { createTeam, issueInvite, joinTeam, listTeamsForOrganizer, moveMember } from "./teams";

// Every test runs in a transaction that rolls back, so nothing here is visible to the
// other integration test files sharing TEST_DATABASE_URL.
describe.skipIf(!process.env.TEST_DATABASE_URL)("team services", () => {
  let sql: Sql;

  beforeAll(() => {
    sql = createSql(process.env.TEST_DATABASE_URL!, { max: 2 });
  });

  afterAll(async () => {
    await sql?.end();
  });

  const rollback = new Error("rollback");
  async function inRollback(fn: (tx: Tx) => Promise<void>) {
    await expect(
      sql.begin(async (tx) => {
        await fn(tx);
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  }

  let n = 0;
  async function person(tx: Tx, roles: Viewer["roles"] = []): Promise<Viewer> {
    n += 1;
    return loadViewer(tx, {
      sub: `test|teams-${n}`,
      name: `Tester ${n}`,
      "https://lifts.app/roles": roles,
    });
  }

  async function setup(tx: Tx) {
    const organizer = await person(tx, ["organizer"]);
    const alpha = await createTeam(tx, organizer, createTeamSchema.parse({ name: `It Alpha ${n}` }));
    const beta = await createTeam(tx, organizer, createTeamSchema.parse({ name: `It Beta ${n}` }));
    return { organizer, alpha, beta };
  }

  async function events(tx: Tx, type: string, actorUserId: string) {
    return tx`select * from activity_events where event_type = ${type} and actor_user_id = ${actorUserId}`;
  }

  it("creates a users row and a user_created event on first sign-in, once", async () => {
    await inRollback(async (tx) => {
      const first = await loadViewer(tx, { sub: "test|first-sign-in", name: "Robin" });
      const again = await loadViewer(tx, { sub: "test|first-sign-in", name: "Robin" });
      expect(again.userId).toBe(first.userId);
      expect(first).toMatchObject({ displayName: "Robin", team: null, roles: [] });
      expect(await events(tx, "user_created", first.userId)).toHaveLength(1);
    });
  });

  it("joins a team with a valid code and records the join", async () => {
    await inRollback(async (tx) => {
      const { organizer, alpha } = await setup(tx);
      const invite = await issueInvite(tx, organizer, alpha.id, issueInviteSchema.parse({ maxUses: 2 }));
      const member = await person(tx);

      const team = await joinTeam(tx, member, joinTeamSchema.parse({ code: invite.code.toLowerCase(), skills: ["design"] }));
      expect(team.id).toBe(alpha.id);

      const [row] = await tx`select team_id, skills from team_members where user_id = ${member.userId}`;
      expect(row).toEqual({ team_id: alpha.id, skills: ["design"] });
      const [{ uses }] = await tx`select uses from invites where code = ${invite.code}`;
      expect(uses).toBe(1);
      expect(await events(tx, "member_joined", member.userId)).toHaveLength(1);

      const reloaded = await loadViewer(tx, { sub: `test|teams-${n}` });
      expect(reloaded.team).toEqual(alpha);
    });
  });

  it("rejects an exhausted code", async () => {
    await inRollback(async (tx) => {
      const { organizer, alpha } = await setup(tx);
      const invite = await issueInvite(tx, organizer, alpha.id, { maxUses: 1 });
      await joinTeam(tx, await person(tx), { code: invite.code, skills: [] });

      const late = await person(tx);
      await expect(joinTeam(tx, late, { code: invite.code, skills: [] })).rejects.toMatchObject({
        status: 409,
        message: expect.stringMatching(/used 1 times/),
      });
      const [membership] = await tx`select 1 from team_members where user_id = ${late.userId}`;
      expect(membership).toBeUndefined();
    });
  });

  it("rejects an unknown code", async () => {
    await inRollback(async (tx) => {
      await expect(joinTeam(tx, await person(tx), { code: "NOPE-2345", skills: [] })).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  it("rejects joining a second team and leaves the first membership and code untouched", async () => {
    await inRollback(async (tx) => {
      const { organizer, alpha, beta } = await setup(tx);
      const alphaCode = await issueInvite(tx, organizer, alpha.id, { maxUses: 4 });
      const betaCode = await issueInvite(tx, organizer, beta.id, { maxUses: 4 });
      const member = await person(tx);
      await joinTeam(tx, member, { code: alphaCode.code, skills: [] });

      await expect(joinTeam(tx, member, { code: betaCode.code, skills: [] })).rejects.toMatchObject({
        status: 409,
        message: expect.stringContaining(alpha.name),
      });
      const [row] = await tx`select team_id from team_members where user_id = ${member.userId}`;
      expect(row.team_id).toBe(alpha.id);
      const [{ uses }] = await tx`select uses from invites where code = ${betaCode.code}`;
      expect(uses).toBe(0);
    });
  });

  it("forbids participants from every organizer service with 403", async () => {
    await inRollback(async (tx) => {
      const { organizer, alpha, beta } = await setup(tx);
      const invite = await issueInvite(tx, organizer, alpha.id, { maxUses: 4 });
      const participant = await person(tx);
      await joinTeam(tx, participant, { code: invite.code, skills: [] });
      const asParticipant = { ...participant, team: alpha };

      await expect(createTeam(tx, asParticipant, { name: "Sneaky", tableLocation: null, isDemo: false })).rejects.toMatchObject({ status: 403 });
      await expect(issueInvite(tx, asParticipant, alpha.id, { maxUses: 4 })).rejects.toMatchObject({ status: 403 });
      await expect(
        moveMember(tx, asParticipant, participant.userId, { teamId: beta.id, reason: "I want to" }),
      ).rejects.toMatchObject({ status: 403 });
      await expect(listTeamsForOrganizer(tx, asParticipant)).rejects.toMatchObject({ status: 403 });

      const [row] = await tx`select team_id from team_members where user_id = ${participant.userId}`;
      expect(row.team_id).toBe(alpha.id);
    });
  });

  it("lets an organizer move a member, with the reason on record", async () => {
    await inRollback(async (tx) => {
      const { organizer, alpha, beta } = await setup(tx);
      const invite = await issueInvite(tx, organizer, alpha.id, { maxUses: 4 });
      const member = await person(tx);
      await joinTeam(tx, member, { code: invite.code, skills: [] });

      const input = moveMemberSchema.parse({ teamId: beta.id, reason: "Registered with Beta at check-in" });
      expect(await moveMember(tx, organizer, member.userId, input)).toEqual({ from: alpha, to: beta });

      const [row] = await tx`select team_id from team_members where user_id = ${member.userId}`;
      expect(row.team_id).toBe(beta.id);
      const [action] = await tx`
        select action, target_type, target_id, reason from organizer_actions
        where organizer_user_id = ${organizer.userId} and action = 'move_member'
      `;
      expect(action).toEqual({
        action: "move_member",
        target_type: "user",
        target_id: member.userId,
        reason: "Registered with Beta at check-in",
      });
      const [moved] = await events(tx, "member_moved", organizer.userId);
      expect(moved).toMatchObject({ team_id: beta.id, counterpart_team_id: alpha.id });

      await expect(moveMember(tx, organizer, member.userId, input)).rejects.toMatchObject({ status: 409 });
    });
  });

  it("records organizer actions and events for new teams and invites", async () => {
    await inRollback(async (tx) => {
      const { organizer, alpha } = await setup(tx);
      await issueInvite(tx, organizer, alpha.id, { maxUses: 3 });
      const actions = await tx`
        select action from organizer_actions where organizer_user_id = ${organizer.userId} order by id
      `;
      expect(actions.map((a) => a.action)).toEqual(["create_team", "create_team", "issue_invite"]);
      expect(await events(tx, "team_created", organizer.userId)).toHaveLength(2);
      expect(await events(tx, "invite_issued", organizer.userId)).toHaveLength(1);

      await expect(createTeam(tx, organizer, { name: alpha.name, tableLocation: null, isDemo: false })).rejects.toMatchObject({
        status: 409,
      });
    });
  });

  it("lists teams with their invites and members for organizers", async () => {
    await inRollback(async (tx) => {
      const { organizer, alpha } = await setup(tx);
      const invite = await issueInvite(tx, organizer, alpha.id, { maxUses: 2 });
      const member = await person(tx);
      await joinTeam(tx, member, { code: invite.code, skills: ["APIs"] });

      const teams = await listTeamsForOrganizer(tx, organizer);
      expect(teams.find((t) => t.id === alpha.id)).toMatchObject({
        name: alpha.name,
        invites: [{ code: invite.code, uses: 1, maxUses: 2 }],
        members: [{ userId: member.userId, displayName: member.displayName, skills: ["APIs"] }],
      });
    });
  });
});

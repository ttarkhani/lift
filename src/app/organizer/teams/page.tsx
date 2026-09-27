import type { Metadata } from "next";
import { Page } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { MAX_INVITE_USES } from "@/domain/teams";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TagList } from "@/components/tag";
import { requireOrganizerPage } from "@/server/auth/pages";
import { withTx } from "@/server/db/client";
import { listTeamsForOrganizer, type OrganizerTeam } from "@/server/services/teams";
import { CreateTeamForm, IssueInviteForm, MoveMemberForm } from "./forms";

export const metadata: Metadata = { title: "Teams" };

export default async function OrganizerTeamsPage() {
  const organizer = await requireOrganizerPage("/organizer/teams");
  if (!organizer) return <NoAccess title="Teams" />;

  const teams = await withTx((tx) => listTeamsForOrganizer(tx, organizer));
  const options = teams.map(({ id, name }) => ({ id, name }));

  return (
    <Page wide>
      <PageHeader
        title="Teams"
        description="Register teams and hand out invite codes. People join with a code and stay on that team unless you move them."
      />
      <div className="flex flex-col gap-6">
        <CreateTeamForm />
        {teams.length === 0 ? (
          <EmptyState title="No teams yet.">Add the first registered team above.</EmptyState>
        ) : (
          <ul className="grid gap-6 lg:grid-cols-2">
            {teams.map((team) => (
              <li key={team.id}>
                <TeamCard team={team} teams={options} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Page>
  );
}

function TeamCard({ team, teams }: { team: OrganizerTeam; teams: { id: string; name: string }[] }) {
  const headingId = `team-${team.id}`;
  const memberCount = `${team.members.length} ${team.members.length === 1 ? "member" : "members"}`;

  return (
    <article
      aria-labelledby={headingId}
      className="flex h-full flex-col gap-4 rounded-md border-2 border-rule bg-paper p-4 sm:p-5"
    >
      <header>
        <h2 id={headingId} className="flex flex-wrap items-center gap-2 text-lg font-bold">
          Team {team.name}
          {team.isDemo && <StatusBadge status="demo" />}
        </h2>
        <p className="text-sm text-ink-soft">
          {team.tableLocation ?? "No table yet"} · {memberCount}
        </p>
      </header>

      <section aria-labelledby={`${headingId}-invites`}>
        <h3 id={`${headingId}-invites`} className="font-bold">
          Invite codes
        </h3>
        {team.invites.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">None yet.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {team.invites.map((invite) => (
              <li key={invite.code} className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-mono font-bold">{invite.code}</span>
                <span className="text-sm text-ink-soft">
                  {invite.uses} of {invite.maxUses} used
                  {invite.uses >= invite.maxUses && " (full)"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <IssueInviteForm teamId={team.id} teamName={team.name} maxUses={MAX_INVITE_USES} />
        </div>
      </section>

      <section aria-labelledby={`${headingId}-members`}>
        <h3 id={`${headingId}-members`} className="font-bold">
          Members
        </h3>
        {team.members.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">Nobody has joined yet.</p>
        ) : (
          <ul className="mt-1 divide-y-2 divide-ground">
            {team.members.map((member) => (
              <li key={member.userId} className="py-2">
                <p className="font-bold">{member.displayName}</p>
                {member.email && <p className="text-sm break-all text-ink-soft">{member.email}</p>}
                {member.skills.length > 0 && (
                  <div className="mt-1">
                    <TagList tags={member.skills} label={`Skills of ${member.displayName}`} />
                  </div>
                )}
                <MoveMemberForm
                  userId={member.userId}
                  memberName={member.displayName}
                  currentTeamId={team.id}
                  teams={teams}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

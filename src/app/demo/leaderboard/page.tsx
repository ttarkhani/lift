import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { LeaderboardList } from "@/components/leaderboard-list";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { demoLeaderboard } from "@/demo/fixtures";

export const metadata: Metadata = { title: "Leaderboard" };

export default function DemoLeaderboard() {
  const rows = demoLeaderboard();

  return (
    <>
      <PageHeader
        title="Leaderboard"
        meta={<StatusBadge status="demo" />}
        description="Points for confirmed help. Ties go to the team that helped more different teams, then to whoever got there first."
      />
      {rows.length === 0 ? (
        <EmptyState title="No points yet." />
      ) : (
        <>
          <LeaderboardList rows={rows} teamsPath="/demo/teams" />
          <p className="mt-3 text-sm text-ink-soft">
            Only teams with a confirmed fix are listed. In this demo, that&apos;s {rows.length === 1 ? "one team" : `${rows.length} teams`} so far.
          </p>
        </>
      )}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { LeaderboardList } from "@/components/leaderboard-list";
import { PageHeader } from "@/components/page-header";
import { getPageViewer } from "@/server/auth/pages";
import { withTx } from "@/server/db/client";
import { getLeaderboard } from "@/server/services/awards";

export const metadata: Metadata = { title: "Leaderboard" };

export default async function LeaderboardPage(props: PageProps<"/leaderboard">) {
  await getPageViewer();
  const { demo } = await props.searchParams;
  const includeDemo = demo === "1";
  const rows = await withTx((tx) => getLeaderboard(tx, { includeDemo }));

  return (
    <Page>
      <PageHeader
        title="Leaderboard"
        description="Points for confirmed help. Ties go to the team that helped more different teams, then to whoever got there first."
        action={
          <Link
            href={includeDemo ? "/leaderboard" : "/leaderboard?demo=1"}
            className="inline-flex min-h-tap items-center font-bold text-stamp underline underline-offset-4 hover:text-ink"
          >
            {includeDemo ? "Hide demo teams" : "Show demo teams"}
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No points yet."
          action={{ label: "Find a blocker to help with", href: "/board" }}
        >
          The first team to help another team gets on the board.
        </EmptyState>
      ) : (
        <LeaderboardList rows={rows} />
      )}
    </Page>
  );
}

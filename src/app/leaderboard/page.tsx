import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
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
        <ol className="divide-y-2 divide-ground rounded-md border-2 border-rule bg-paper">
          {rows.map((row) => (
            <li key={row.team.slug} className="flex items-center gap-4 px-4 py-3">
              <span className="w-8 shrink-0 font-mono text-lg font-bold text-ink-soft tabular-nums">
                <span className="sr-only">Rank </span>
                {row.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/teams/${row.team.slug}`}
                    className="font-bold underline-offset-4 hover:text-stamp hover:underline"
                  >
                    Team {row.team.name}
                  </Link>
                  {row.team.isDemo && <StatusBadge status="demo" />}
                </p>
                <p className="text-sm text-ink-soft">
                  Helped {row.teamsHelped} {row.teamsHelped === 1 ? "team" : "teams"} ·{" "}
                  {row.resolutions} {row.resolutions === 1 ? "fix" : "fixes"}
                </p>
              </div>
              <p className="shrink-0 text-right">
                <span className="font-mono text-xl font-bold tabular-nums">{row.points}</span>
                <span className="block text-xs text-ink-soft">points</span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </Page>
  );
}

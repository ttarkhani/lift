import Link from "next/link";
import { StatusBadge } from "./status-badge";

export type LeaderboardListRow = {
  rank: number;
  team: { slug: string; name: string; isDemo: boolean };
  points: number;
  teamsHelped: number;
  resolutions: number;
};

type LeaderboardListProps = {
  rows: LeaderboardListRow[];
  /** Where team names link to: "/teams" in the app, "/demo/teams" in the demo. */
  teamsPath?: string;
};

/** The ranked teams, as rows. Shared by the leaderboard and the demo's leaderboard. */
export function LeaderboardList({ rows, teamsPath = "/teams" }: LeaderboardListProps) {
  return (
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
                href={`${teamsPath}/${row.team.slug}`}
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
  );
}

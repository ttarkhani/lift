import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/app-shell";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TagList } from "@/components/tag";
import { getPageViewer } from "@/server/auth/pages";
import { timeAgo } from "@/lib/format";
import { CURRENT_TEAM_SLUG, getOpenBlockers, getTeam, MOCK_NOW } from "@/lib/mock";

export const metadata: Metadata = { title: "Board" };

export default async function BoardPage() {
  await getPageViewer();
  const blockers = getOpenBlockers();

  return (
    <Page>
      <PageHeader
        title="Board"
        description="Open blockers from other teams. Help one and your team earns points when they confirm the fix."
        action={<Button href="/requests/new" block>Post a blocker</Button>}
      />

      {blockers.length === 0 ? (
        <EmptyState
          title="No open blockers."
          action={{ label: "Post a blocker", href: "/requests/new" }}
        >
          Post one if you&apos;re stuck.
        </EmptyState>
      ) : (
        <ul className="divide-y-2 divide-ground rounded-md border-2 border-rule bg-paper">
          {blockers.map((blocker) => {
            const team = getTeam(blocker.requestingTeam)!;
            const ours = team.slug === CURRENT_TEAM_SLUG;
            return (
              <li key={blocker.id} className="flex flex-col gap-3 p-4">
                <div className="flex flex-col gap-1">
                  <Link
                    href={`/requests/${blocker.id}`}
                    className="text-lg font-bold text-balance underline-offset-4 hover:text-stamp hover:underline"
                  >
                    {blocker.title}
                  </Link>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
                    <span>
                      Team {team.name} · {team.table}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{timeAgo(blocker.postedAt, MOCK_NOW)}</span>
                    {team.isDemo && <StatusBadge status="demo" />}
                  </p>
                </div>
                <p className="line-clamp-2 text-ink-soft">{blocker.description}</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <TagList tags={blocker.tags} />
                  {ours ? (
                    <p className="text-sm font-bold text-ink-soft">Your team&apos;s blocker</p>
                  ) : (
                    <Button variant="secondary" block>
                      Help with this
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}

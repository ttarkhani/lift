import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TagList } from "@/components/tag";
import { formatTime } from "@/lib/format";
import { DEMO_TIME_ZONE, openDemoRequests } from "@/demo/fixtures";

export const metadata: Metadata = { title: "Board" };

/** The board's open blockers, read-only: no polling, no filters, and no "Help with this" here. */
export default function DemoBoard() {
  const requests = openDemoRequests();

  return (
    <>
      <PageHeader
        title="Board"
        meta={<StatusBadge status="demo" />}
        description="Open blockers from other teams. Help one and your team earns points when they confirm the fix."
      />

      {requests.length === 0 ? (
        <EmptyState title="No open blockers." />
      ) : (
        <ul className="divide-y-2 divide-ground rounded-md border-2 border-rule bg-paper">
          {requests.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 p-4">
              <div className="flex flex-col gap-1">
                <Link
                  href={`/demo/requests/${item.id}`}
                  className="text-lg font-bold text-balance underline-offset-4 hover:text-stamp hover:underline"
                >
                  {item.title}
                </Link>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
                  <span>
                    Team {item.requestingTeam.name}
                    {item.requestingTeam.tableLocation && ` · ${item.requestingTeam.tableLocation}`}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Posted {formatTime(item.createdAt, DEMO_TIME_ZONE)}</span>
                  <StatusBadge status="demo" />
                </p>
              </div>
              <p className="line-clamp-2 text-ink-soft">{item.description}</p>
              <TagList tags={item.tags} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

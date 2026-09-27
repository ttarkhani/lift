"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { TagList } from "@/components/tag";
import { getJson, postJson, type Serialized } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { usePoll } from "@/lib/usePoll";
import type { Board, RequestSummary } from "@/server/services/requests";

type Item = Serialized<RequestSummary>;

type Props = {
  initial: Item[];
  filters: { mine: boolean; tag: string | null };
  hasTeam: boolean;
};

export function BoardList({ initial, filters, hasTeam }: Props) {
  const router = useRouter();
  const [requests, setRequests] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (filters.mine) params.set("mine", "1");
  if (filters.tag) params.set("tag", filters.tag);

  usePoll(async () => {
    const result = await getJson<Serialized<Board>>(`/api/requests?${params}`);
    if (result.ok) setRequests(result.data.requests);
  });

  async function help(item: Item) {
    setPendingId(item.id);
    setError(null);
    const result = await postJson(`/api/requests/${item.id}/accept`, {});
    if (result.ok) {
      router.push(`/requests/${item.id}?done=accept`);
      return;
    }
    setPendingId(null);
    setError(result.message);
  }

  if (requests.length === 0) {
    return filters.mine ? (
      <EmptyState title="Your team has no requests yet." action={{ label: "Post a blocker", href: "/requests/new" }}>
        Blockers your team posts or helps with show up here.
      </EmptyState>
    ) : (
      <EmptyState
        title={filters.tag ? `No open blockers tagged ${filters.tag}.` : "No open blockers."}
        action={hasTeam ? { label: "Post a blocker", href: "/requests/new" } : undefined}
      >
        Post one if you&apos;re stuck.
      </EmptyState>
    );
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 rounded-md border-2 border-alert bg-alert-wash px-4 py-3 font-bold text-alert">
          Error: {error}
        </p>
      )}
      <ul className="divide-y-2 divide-ground rounded-md border-2 border-rule bg-paper">
        {requests.map((item) => (
          <li key={item.id} className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-1">
              <Link
                id={`request-${item.id}-title`}
                href={`/requests/${item.id}`}
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
                <span suppressHydrationWarning>{timeAgo(item.createdAt)}</span>
                {item.status !== "open" && <StatusLabel item={item} />}
                {item.requestingTeam.isDemo && <StatusBadge status="demo" />}
              </p>
            </div>
            <p className="line-clamp-2 text-ink-soft">{item.description}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TagList tags={item.tags} />
              <RowAction item={item} hasTeam={hasTeam} pending={pendingId === item.id} onHelp={() => help(item)} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function StatusLabel({ item }: { item: Item }) {
  if (item.status === "cancelled") return <span className="text-sm font-bold">Cancelled</span>;
  return <StatusBadge status={item.status} />;
}

function RowAction({
  item,
  hasTeam,
  pending,
  onHelp,
}: {
  item: Item;
  hasTeam: boolean;
  pending: boolean;
  onHelp: () => void;
}) {
  if (item.party === "requester") return <p className="text-sm font-bold text-ink-soft">Your team&apos;s blocker</p>;
  if (item.party === "helper") {
    return (
      <p className="text-sm font-bold text-ink-soft">
        Your team is helping Team {item.requestingTeam.name}
      </p>
    );
  }
  if (item.status !== "open" || !hasTeam) return null;
  return (
    <Button
      variant="secondary"
      block
      disabled={pending}
      aria-busy={pending}
      aria-describedby={`request-${item.id}-title`}
      onClick={onHelp}
    >
      Help with this
    </Button>
  );
}

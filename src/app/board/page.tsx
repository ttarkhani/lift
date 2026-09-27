import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Page } from "@/components/app-shell";
import { Button } from "@/components/button";
import { PageHeader } from "@/components/page-header";
import { listRequestsSchema } from "@/domain/requests";
import { serialize } from "@/lib/api";
import { cx } from "@/lib/cx";
import { getPageViewer, loginHref } from "@/server/auth/pages";
import { withTx } from "@/server/db/client";
import { listRequests } from "@/server/services/requests";
import { BoardList } from "./board-list";

export const metadata: Metadata = { title: "Board" };

function boardHref(filters: { mine: boolean; tag?: string }) {
  const params = new URLSearchParams();
  if (filters.mine) params.set("mine", "1");
  if (filters.tag) params.set("tag", filters.tag);
  const query = params.toString();
  return query ? `/board?${query}` : "/board";
}

export default async function BoardPage(props: PageProps<"/board">) {
  const viewer = await getPageViewer();
  if (!viewer) redirect(loginHref("/board"));

  const searchParams = await props.searchParams;
  const parsed = listRequestsSchema.safeParse({
    tag: typeof searchParams.tag === "string" ? searchParams.tag : undefined,
    mine: searchParams.mine === "1" && viewer.team ? "1" : undefined,
  });
  const filters = parsed.success ? parsed.data : { mine: false, tag: undefined };
  const board = await withTx((tx) => listRequests(tx, viewer, filters));

  const scopes = [
    { label: "Open blockers", mine: false },
    ...(viewer.team ? [{ label: "My team's requests", mine: true }] : []),
  ];

  return (
    <Page>
      <PageHeader
        title="Board"
        description="Open blockers from other teams. Help one and your team earns points when they confirm the fix."
        action={
          viewer.team && (
            <Button href="/requests/new" block>
              Post a blocker
            </Button>
          )
        }
      />

      <nav aria-label="Board filters" className="mb-6 flex flex-col gap-3">
        <ul className="flex flex-wrap gap-2">
          {scopes.map((scope) => {
            const current = scope.mine === filters.mine;
            return (
              <li key={scope.label}>
                <Link
                  href={boardHref({ mine: scope.mine })}
                  aria-current={current ? "page" : undefined}
                  className={cx(
                    "inline-flex min-h-tap items-center rounded-sm border-2 px-3 font-bold",
                    current ? "border-stamp bg-stamp-wash text-ink" : "border-rule bg-paper text-ink-soft hover:border-ink",
                  )}
                >
                  {scope.label}
                </Link>
              </li>
            );
          })}
        </ul>
        {board.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-soft">Tag:</span>
            <ul className="flex flex-wrap gap-1.5">
              {[undefined, ...board.tags].map((tag) => {
                const current = (tag ?? "").toLowerCase() === (filters.tag ?? "").toLowerCase();
                return (
                  <li key={tag ?? "all"}>
                    <Link
                      href={boardHref({ mine: filters.mine, tag })}
                      aria-current={current ? "true" : undefined}
                      className={cx(
                        "inline-flex min-h-tap items-center rounded-sm border px-2 font-mono text-xs",
                        current ? "border-2 border-stamp bg-stamp-wash font-bold" : "border-rule bg-ground hover:border-ink",
                      )}
                    >
                      {tag ?? "All"}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>

      <BoardList
        key={boardHref(filters)}
        initial={serialize(board.requests)}
        filters={{ mine: filters.mine, tag: filters.tag ?? null }}
        hasTeam={Boolean(viewer.team)}
      />
    </Page>
  );
}

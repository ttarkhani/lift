import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Page } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Receipt, type ReceiptLine } from "@/components/receipt";
import { StatusBadge } from "@/components/status-badge";
import { TagList } from "@/components/tag";
import { getPageViewer } from "@/server/auth/pages";
import { withTx } from "@/server/db/client";
import { env } from "@/server/env";
import { NotFoundError } from "@/server/errors";
import { formatTime } from "@/lib/format";
import { getReceipt } from "@/server/services/awards";
import { getTeamProfile } from "@/server/services/teams";

async function load(params: PageProps<"/teams/[slug]">["params"]) {
  const { slug } = await params;
  try {
    return await withTx(async (tx) => ({ profile: await getTeamProfile(tx, slug), receipt: await getReceipt(tx, slug) }));
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

export async function generateMetadata(props: PageProps<"/teams/[slug]">): Promise<Metadata> {
  const { profile } = await load(props.params);
  return { title: `Team ${profile.name}` };
}

export default async function TeamPage(props: PageProps<"/teams/[slug]">) {
  await getPageViewer();
  const { profile, receipt } = await load(props.params);
  const timeZone = env.eventTimezone;
  const lines: ReceiptLine[] = receipt.lines.map((line) => ({
    awardId: line.awardId,
    requestId: line.requestId,
    requestTitle: line.requestTitle,
    helpedTeam: line.helpedTeam.name,
    summary: line.summary,
    points: line.points,
    explanation: line.explanation,
    confirmedBy: line.confirmedBy,
    confirmedAt: line.confirmedAt.toISOString(),
    state: line.status === "reversed" ? "reversed" : "counted",
    links: line.links,
  }));
  const details = [profile.tableLocation, profile.members.join(", ")].filter(Boolean).join(" · ");

  return (
    <Page>
      <PageHeader
        title={`Team ${profile.name}`}
        meta={
          <>
            {profile.isDemo && <StatusBadge status="demo" />}
            {details && <span className="text-sm text-ink-soft">{details}</span>}
          </>
        }
      />
      <div className="mb-8">
        <TagList tags={profile.skills} label="Skills" />
      </div>

      {lines.length === 0 ? (
        <EmptyState
          title="No confirmed help yet."
          action={{ label: "Find a blocker to help with", href: "/board" }}
        >
          Every fix another team confirms shows up here as a line on this
          team&apos;s receipt.
        </EmptyState>
      ) : (
        <Receipt teamName={profile.name} table={profile.tableLocation} lines={lines} timeZone={timeZone} />
      )}

      <section aria-labelledby="received" className="mt-12">
        <h2 id="received" className="text-lg font-bold">
          Help received
        </h2>
        {receipt.helpReceived.length === 0 ? (
          <p className="mt-2 text-ink-soft">
            No confirmed help yet.{" "}
            <Link href="/requests/new" className="text-stamp underline underline-offset-4 hover:text-ink">
              Post a blocker
            </Link>{" "}
            if you&apos;re stuck.
          </p>
        ) : (
          <ul className="mt-3 divide-y-2 divide-ground rounded-md border-2 border-rule bg-paper">
            {receipt.helpReceived.map((help) => (
              <li key={help.awardId} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <Link
                  href={`/requests/${help.requestId}`}
                  className="min-w-0 break-words underline-offset-4 hover:text-stamp hover:underline"
                >
                  Team {help.helpingTeam.name} helped with “{help.requestTitle}”
                </Link>
                <span className="shrink-0 text-sm text-ink-soft">
                  {formatTime(help.confirmedAt.toISOString(), timeZone)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}

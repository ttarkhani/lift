import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Page } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Receipt } from "@/components/receipt";
import { StatusBadge } from "@/components/status-badge";
import { TagList } from "@/components/tag";
import { formatTime } from "@/lib/format";
import { getHelpReceived, getReceipt, getTeam, MOCK_TIMEZONE } from "@/lib/mock";

async function load(params: PageProps<"/teams/[slug]">["params"]) {
  const { slug } = await params;
  const team = getTeam(slug);
  if (!team) notFound();
  return team;
}

export async function generateMetadata(props: PageProps<"/teams/[slug]">): Promise<Metadata> {
  const team = await load(props.params);
  return { title: `Team ${team.name}` };
}

export default async function TeamPage(props: PageProps<"/teams/[slug]">) {
  const team = await load(props.params);
  const lines = getReceipt(team.slug).map((award) => ({
    ...award,
    helpedTeam: getTeam(award.helped)!.name,
  }));
  const received = getHelpReceived(team.slug);

  return (
    <Page>
      <PageHeader
        title={`Team ${team.name}`}
        meta={
          <>
            {team.isDemo && <StatusBadge status="demo" />}
            <span className="text-sm text-ink-soft">
              {team.table} · {team.members.join(", ")}
            </span>
          </>
        }
      />
      <div className="mb-8">
        <TagList tags={team.skills} label="Skills" />
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
        <Receipt teamName={team.name} table={team.table} lines={lines} timeZone={MOCK_TIMEZONE} />
      )}

      <section aria-labelledby="received" className="mt-12">
        <h2 id="received" className="text-lg font-bold">
          Help received
        </h2>
        {received.length === 0 ? (
          <p className="mt-2 text-ink-soft">
            No confirmed help yet.{" "}
            <Link href="/requests/new" className="text-stamp underline underline-offset-4 hover:text-ink">
              Post a blocker
            </Link>{" "}
            if you&apos;re stuck.
          </p>
        ) : (
          <ul className="mt-3 divide-y-2 divide-ground rounded-md border-2 border-rule bg-paper">
            {received.map((award) => (
              <li key={award.requestId} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <Link
                  href={`/requests/${award.requestId}`}
                  className="underline-offset-4 hover:text-stamp hover:underline"
                >
                  Team {getTeam(award.helper)!.name} helped {award.summary.replace(/\bits\b/, "our")}
                </Link>
                <span className="shrink-0 text-sm text-ink-soft">
                  {formatTime(award.confirmedAt, MOCK_TIMEZONE)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}

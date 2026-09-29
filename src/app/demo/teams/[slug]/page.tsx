import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Receipt } from "@/components/receipt";
import { StatusBadge } from "@/components/status-badge";
import { TagList } from "@/components/tag";
import { formatTime } from "@/lib/format";
import { DEMO_TIME_ZONE, demoHelpReceived, demoReceiptLines, getDemoTeam } from "@/demo/fixtures";

async function load(params: PageProps<"/demo/teams/[slug]">["params"]) {
  const team = getDemoTeam((await params).slug);
  if (!team) notFound();
  return team;
}

export async function generateMetadata({ params }: PageProps<"/demo/teams/[slug]">): Promise<Metadata> {
  const team = getDemoTeam((await params).slug);
  return { title: team ? `Team ${team.name}` : "Team" };
}

export default async function DemoTeamPage({ params }: PageProps<"/demo/teams/[slug]">) {
  const team = await load(params);
  const lines = demoReceiptLines(team);
  const helpReceived = demoHelpReceived(team);
  const details = [team.tableLocation, team.members.join(", ")].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        title={`Team ${team.name}`}
        meta={
          <>
            <StatusBadge status="demo" />
            {details && <span className="text-sm text-ink-soft">{details}</span>}
          </>
        }
      />
      <div className="mb-8">
        <TagList tags={team.skills} label="Skills" />
      </div>

      {lines.length === 0 ? (
        <EmptyState title="No confirmed help yet." action={{ label: "Find a blocker to help with", href: "/demo/board" }}>
          Every fix another team confirms shows up here as a line on this team&apos;s receipt.
        </EmptyState>
      ) : (
        <Receipt teamName={team.name} table={team.tableLocation} lines={lines} timeZone={DEMO_TIME_ZONE} />
      )}

      <section aria-labelledby="received" className="mt-12">
        <h2 id="received" className="text-lg font-bold">
          Help received
        </h2>
        {helpReceived.length === 0 ? (
          <p className="mt-2 text-ink-soft">No confirmed help yet.</p>
        ) : (
          <ul className="mt-3 divide-y-2 divide-ground rounded-md border-2 border-rule bg-paper">
            {helpReceived.map((request) => (
              <li key={request.id} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <Link
                  href={`/demo/requests/${request.id}`}
                  className="min-w-0 break-words underline-offset-4 hover:text-stamp hover:underline"
                >
                  Team {request.helpingTeam!.name} helped with “{request.title}”
                </Link>
                <span className="shrink-0 text-sm text-ink-soft">
                  {formatTime(request.award!.confirmedAt, DEMO_TIME_ZONE)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

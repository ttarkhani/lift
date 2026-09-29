import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { pointsForSequence } from "@/domain/scoring";
import { canonicalExample, demoLeaderboard, getDemoRequest, openDemoRequests, WORKED_REQUEST_ID } from "@/demo/fixtures";

export const metadata: Metadata = { title: { absolute: "Demo · Lifts" } };

export default function DemoTour() {
  const example = canonicalExample();
  const worked = getDemoRequest(WORKED_REQUEST_ID)!;
  const maple = demoLeaderboard().find((row) => row.team.slug === "maple")!;
  const open = openDemoRequests().length;

  const stops = [
    {
      title: "The board",
      href: "/demo/board",
      body: `${open} open blockers, posted by teams that are stuck.`,
    },
    {
      title: "A fix, start to finish",
      href: `/demo/requests/${worked.id}`,
      body: `Team ${worked.helpingTeam!.name} helps Team ${worked.requestingTeam.name} in a private thread. You get to confirm the fix.`,
    },
    {
      title: "The leaderboard",
      href: "/demo/leaderboard",
      body: "Teams ranked by points for confirmed help.",
    },
    {
      title: `Team ${maple.team.name}'s receipt`,
      href: `/demo/teams/${maple.team.slug}`,
      body: `${maple.resolutions} confirmed fixes for ${maple.teamsHelped} teams, ${maple.points} points, and the evidence behind each one.`,
    },
  ];

  return (
    <>
      <PageHeader
        title="Take a tour of Lifts"
        meta={<StatusBadge status="demo" />}
        description="Lifts rewards hackathon teams for helping other teams get unblocked, with evidence behind every point."
      />

      <section aria-labelledby="how">
        <h2 id="how" className="text-lg font-bold">
          How it works
        </h2>
        <p className="mt-2 text-ink-soft">
          A team posts a blocker. Another team helps in a private thread. The team that asked confirms
          what changed, and the helping team earns points and a line on its contribution receipt.
        </p>
      </section>

      <section aria-labelledby="points" className="mt-10">
        <h2 id="points" className="text-lg font-bold">
          How points work
        </h2>
        <p className="mt-2 text-ink-soft">
          Points go to the helping team, once per blocker, and count per pair of teams across the whole
          event, in either direction.
        </p>
        <dl className="mt-3 grid grid-cols-3 rounded-md border-2 border-rule bg-paper text-center">
          {[
            ["1st fix", pointsForSequence(1)],
            ["2nd fix", pointsForSequence(2)],
            ["After that", pointsForSequence(3)],
          ].map(([label, points]) => (
            <div key={label} className="border-rule px-2 py-3 not-last:border-r-2">
              <dt className="text-sm text-ink-soft">{label}</dt>
              <dd className="font-mono text-xl font-bold">{points}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4">
          For example, Team A helps B, B, C, then B:{" "}
          <span className="font-mono font-bold whitespace-nowrap">
            {example.steps.map((step) => step.points).join(" + ")} = {example.total}
          </span>{" "}
          points.
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          Helping a new team always starts at 20. Messages, time spent, and reopened blockers never earn
          points.
        </p>
      </section>

      <section aria-labelledby="look" className="mt-10">
        <h2 id="look" className="text-lg font-bold">
          What to look at
        </h2>
        <ol className="mt-3 divide-y-2 divide-ground rounded-md border-2 border-rule bg-paper">
          {stops.map((stop, i) => (
            <li key={stop.href} className="flex gap-4 px-4 py-3">
              <span className="font-mono text-lg font-bold text-stamp tabular-nums" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <Link href={stop.href} className="font-bold text-stamp underline underline-offset-4 hover:text-ink">
                  {stop.title}
                </Link>
                <p className="text-ink-soft">{stop.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

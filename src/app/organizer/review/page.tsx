import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/app-shell";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TextArea } from "@/components/text-field";
import { formatTime } from "@/lib/format";
import { getReviewQueue, getTeam, MOCK_TIMEZONE, type ReviewCard } from "@/lib/mock";

export const metadata: Metadata = { title: "Review queue" };

export default function ReviewPage() {
  const cards = getReviewQueue();

  return (
    <Page wide>
      <PageHeader
        title="Review queue"
        description="Flagged awards keep counting, marked Under review, until you decide. Every decision needs a reason."
      />
      {cards.length === 0 ? (
        <EmptyState
          title="Nothing to review."
          action={{ label: "Check the leaderboard", href: "/leaderboard" }}
        >
          New flags show up here as soon as the review finds them.
        </EmptyState>
      ) : (
        <ol className="flex flex-col gap-6">
          {cards.map((card) => (
            <li key={card.id}>
              <ReviewItem card={card} />
            </li>
          ))}
        </ol>
      )}
    </Page>
  );
}

function ReviewItem({ card }: { card: ReviewCard }) {
  const helper = getTeam(card.award.helper)!;
  const helped = getTeam(card.award.helped)!;
  const headingId = `flag-${card.id}`;

  return (
    <article
      aria-labelledby={headingId}
      className="grid rounded-md border-2 border-rule bg-paper lg:grid-cols-[1fr_22rem]"
    >
      <div className="p-4 sm:p-5">
        <p className="flex flex-wrap items-center gap-2">
          <StatusBadge status="under_review" />
          {helper.isDemo && <StatusBadge status="demo" />}
          <span className="text-sm text-ink-soft">
            Flag #{card.id} · raised {formatTime(card.raisedAt, MOCK_TIMEZONE)}
          </span>
        </p>
        <h2 id={headingId} className="mt-3 text-lg font-bold">
          {card.title}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">Signals: {card.detectors.join(", ")}</p>

        <h3 className="mt-4 font-bold">Gemini&apos;s explanation</h3>
        <p className="mt-1">{card.explanation}</p>
        <p className="mt-3 text-sm">
          <strong>Gemini recommends:</strong>{" "}
          {card.recommendation === "accept" ? "accept the evidence" : "organizer review"}
        </p>

        <h3 className="mt-4 font-bold">Evidence</h3>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {card.evidence.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="font-mono text-sm text-stamp underline underline-offset-4 hover:text-ink"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <h3 className="mt-4 font-bold">Team response</h3>
        {card.teamResponse ? (
          <blockquote className="mt-1 border-l-4 border-rule pl-3">
            <p>{card.teamResponse.body}</p>
            <footer className="mt-1 text-sm text-ink-soft">
              {card.teamResponse.by}, Team {getTeam(card.teamResponse.team)!.name}
            </footer>
          </blockquote>
        ) : (
          <p className="mt-1 text-ink-soft">No response yet.</p>
        )}
      </div>

      <form className="flex flex-col gap-4 border-t-2 border-ground p-4 sm:p-5 lg:border-t-0 lg:border-l-2">
        <div>
          <h3 className="font-bold">Award under review</h3>
          <p className="mt-1">
            Team {helper.name} helped Team {helped.name}
          </p>
          <p className="text-sm text-ink-soft">
            Request #{card.award.requestId} ·{" "}
            <span className="font-mono font-bold text-ink">{card.award.points} points</span>
          </p>
        </div>
        <TextArea
          name={`reason-${card.id}`}
          label="Reason"
          hint="Both teams can see this."
          rows={3}
        />
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Button block className="lg:w-full">
            Approve
          </Button>
          <Button variant="danger" block className="lg:w-full">
            Reject
          </Button>
        </div>
      </form>
    </article>
  );
}

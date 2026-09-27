import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Page } from "@/components/app-shell";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { CheckIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TagList } from "@/components/tag";
import { Checkbox, SelectField, TextArea } from "@/components/text-field";
import { EVIDENCE_KIND_LABELS, EVIDENCE_KINDS } from "@/domain/types";
import { formatTime } from "@/lib/format";
import {
  getRequest,
  getTeam,
  MOCK_TIMEZONE,
  type MockMessage,
  type MockOutcome,
  type MockRequest,
  type MockTeam,
} from "@/lib/mock";

async function load(params: PageProps<"/requests/[id]">["params"]) {
  const { id } = await params;
  const request = /^\d+$/.test(id) ? getRequest(Number(id)) : undefined;
  if (!request) notFound();
  return request;
}

export async function generateMetadata(props: PageProps<"/requests/[id]">): Promise<Metadata> {
  const request = await load(props.params);
  return { title: request.title };
}

export default async function RequestPage(props: PageProps<"/requests/[id]">) {
  const request = await load(props.params);
  const requester = getTeam(request.requestingTeam)!;
  const helper = request.helpingTeam ? getTeam(request.helpingTeam)! : null;
  const threadOpen = request.status === "accepted" || request.status === "outcome_submitted";

  return (
    <Page>
      <PageHeader
        title={request.title}
        back={{ label: "Board", href: "/board" }}
        meta={
          <>
            {request.status === "cancelled" ? (
              <span className="text-sm font-bold">Cancelled</span>
            ) : (
              <StatusBadge status={request.status} />
            )}
            {requester.isDemo && <StatusBadge status="demo" />}
            <span className="text-sm text-ink-soft">
              Team {requester.name} asked
              {helper && <> · Team {helper.name} is helping</>}
            </span>
          </>
        }
      />

      <div className="flex flex-col gap-8">
        <BlockerDetails request={request} requester={requester} />

        {request.status === "open" ? (
          <section aria-label="Help" className="rounded-md border-2 border-rule bg-paper p-4">
            <p className="font-bold">Nobody is helping yet.</p>
            <p className="mt-1 text-ink-soft">
              Take it on and you&apos;ll get a private thread with Team {requester.name}.
            </p>
            <div className="mt-4">
              <Button block>Help with this</Button>
            </div>
          </section>
        ) : (
          <>
            <ThreadNotice />
            <Thread messages={request.messages} canWrite={threadOpen} />
            {request.status === "accepted" && helper && <OutcomeForm requester={requester} />}
            {request.outcome && helper && (
              <OutcomeCard
                outcome={request.outcome}
                requester={requester}
                helper={helper}
                awaitingConfirmation={request.status === "outcome_submitted"}
              />
            )}
          </>
        )}
      </div>
    </Page>
  );
}

function BlockerDetails({ request, requester }: { request: MockRequest; requester: MockTeam }) {
  return (
    <section aria-labelledby="details" className="rounded-md border-2 border-rule bg-paper p-4">
      <h2 id="details" className="sr-only">
        Blocker details
      </h2>
      <p className="text-sm text-ink-soft">
        Posted by {request.postedBy}, Team {requester.name} · {requester.table} ·{" "}
        {formatTime(request.postedAt, MOCK_TIMEZONE)}
      </p>
      <p className="mt-3 whitespace-pre-line">{request.description}</p>
      {request.tried && (
        <>
          <h3 className="mt-4 font-bold">What they already tried</h3>
          <p className="mt-1 whitespace-pre-line text-ink-soft">{request.tried}</p>
        </>
      )}
      {request.tags.length > 0 && (
        <div className="mt-4">
          <TagList tags={request.tags} />
        </div>
      )}
    </section>
  );
}

function ThreadNotice() {
  return (
    <p role="note" className="rounded-md border-2 border-stamp bg-stamp-wash px-4 py-3 text-sm">
      <strong>This thread is visible to both teams and organizers.</strong> An AI
      model reviews it for scoring integrity.
    </p>
  );
}

function Thread({ messages, canWrite }: { messages: MockMessage[]; canWrite: boolean }) {
  return (
    <section aria-labelledby="thread">
      <h2 id="thread" className="mb-3 text-lg font-bold">
        Help thread
      </h2>
      {messages.length === 0 ? (
        <EmptyState title="No messages yet.">
          Say hello, share what you&apos;ve found, or offer to meet at your table.
        </EmptyState>
      ) : (
        <ol className="flex flex-col gap-4">
          {messages.map((message) => (
            <li key={message.id}>
              <Message message={message} />
            </li>
          ))}
        </ol>
      )}
      {canWrite && <Composer />}
    </section>
  );
}

function Message({ message }: { message: MockMessage }) {
  const time = formatTime(message.at, MOCK_TIMEZONE);
  if (message.kind === "system" || !message.author) {
    return (
      <p className="flex items-center gap-3 text-sm text-ink-soft">
        <span className="h-0.5 flex-1 bg-rule" aria-hidden="true" />
        <span className="text-center">
          {message.body} <span className="whitespace-nowrap">· {time}</span>
        </span>
        <span className="h-0.5 flex-1 bg-rule" aria-hidden="true" />
      </p>
    );
  }
  const team = getTeam(message.author.team)!;
  return (
    <article className="rounded-md border-2 border-rule bg-paper p-3">
      <p className="text-sm">
        <strong>{message.author.name}</strong>{" "}
        <span className="text-ink-soft">
          Team {team.name} · {time} · #{message.id}
        </span>
      </p>
      {message.kind === "snippet" ? (
        <pre className="mt-2 overflow-x-auto rounded-sm bg-ground p-3 font-mono text-sm">
          <code>{message.body}</code>
        </pre>
      ) : (
        <p className="mt-1 whitespace-pre-line">{message.body}</p>
      )}
    </article>
  );
}

function Composer() {
  return (
    <form className="mt-4 flex flex-col gap-4 rounded-md border-2 border-rule bg-paper p-4">
      <TextArea name="body" label="Message" rows={3} />
      <Checkbox
        name="snippet"
        label="Format as a code snippet"
        hint="Keeps spacing and uses a monospace font."
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button block>Send</Button>
        <Button variant="secondary" block>
          Meet at our table
        </Button>
      </div>
    </form>
  );
}

function OutcomeForm({ requester }: { requester: MockTeam }) {
  return (
    <section aria-labelledby="outcome-form">
      <h2 id="outcome-form" className="mb-1 text-lg font-bold">
        Submit outcome
      </h2>
      <p className="mb-3 text-ink-soft">
        When it&apos;s fixed, explain what you did. Team {requester.name} confirms it or
        sends it back.
      </p>
      <form className="flex flex-col gap-5 rounded-md border-2 border-rule bg-paper p-4">
        <TextArea
          name="summary"
          label="What you did"
          hint="One or two sentences. This becomes the line on your receipt."
          rows={3}
        />
        <SelectField
          name="evidenceKind"
          label="Evidence type"
          options={EVIDENCE_KINDS.map((kind) => ({ value: kind, label: EVIDENCE_KIND_LABELS[kind] }))}
        />
        <TextArea
          name="evidence"
          label="Evidence"
          hint="A link, a code diff, or a written explanation of the fix."
          rows={4}
          mono
        />
        <Checkbox
          name="inPerson"
          label="We helped in person"
          hint="In-person help needs a written summary of what changed."
        />
        <Button block>Submit outcome</Button>
      </form>
    </section>
  );
}

function OutcomeCard({
  outcome,
  requester,
  helper,
  awaitingConfirmation,
}: {
  outcome: MockOutcome;
  requester: MockTeam;
  helper: MockTeam;
  awaitingConfirmation: boolean;
}) {
  const isUrl = outcome.evidenceKind === "link" || outcome.evidenceKind === "screenshot_link";
  return (
    <section aria-labelledby="outcome" className="rounded-md border-2 border-rule bg-paper p-4">
      <h2 id="outcome" className="text-lg font-bold">
        Outcome
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Submitted by {outcome.submittedBy}, Team {helper.name} ·{" "}
        {formatTime(outcome.submittedAt, MOCK_TIMEZONE)}
        {outcome.inPerson && " · Helped in person"}
      </p>
      <p className="mt-3">{outcome.summary}</p>
      <h3 className="mt-4 font-bold">Evidence: {EVIDENCE_KIND_LABELS[outcome.evidenceKind]}</h3>
      {isUrl ? (
        <a
          href={outcome.evidence}
          className="mt-1 inline-block font-mono text-sm break-all text-stamp underline underline-offset-4 hover:text-ink"
          rel="noreferrer"
          target="_blank"
        >
          {outcome.evidence}
        </a>
      ) : (
        <p className="mt-1 whitespace-pre-line text-ink-soft">{outcome.evidence}</p>
      )}

      {awaitingConfirmation ? (
        <div className="mt-5 border-t-2 border-ground pt-4">
          <p className="font-bold">Is it fixed?</p>
          <p className="mt-1 text-sm text-ink-soft">
            Only Team {requester.name} can answer. Confirming gives Team {helper.name} its points.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button block>Confirm it&apos;s fixed</Button>
            <Button variant="danger" block>
              Not fixed yet
            </Button>
          </div>
        </div>
      ) : (
        outcome.confirmedBy &&
        outcome.confirmedAt && (
          <p className="mt-5 flex flex-wrap items-center gap-2 border-t-2 border-ground pt-4 text-sm">
            <span className="inline-flex items-center gap-1.5 font-bold text-stamp">
              <CheckIcon />
              Confirmed by Team {requester.name}
            </span>
            <span className="text-ink-soft">
              {outcome.confirmedBy} · {formatTime(outcome.confirmedAt, MOCK_TIMEZONE)}
            </span>
            <Link
              href={`/teams/${helper.slug}`}
              className="text-stamp underline underline-offset-4 hover:text-ink"
            >
              See Team {helper.name}&apos;s receipt
            </Link>
          </p>
        )
      )}
    </section>
  );
}

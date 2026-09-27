"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { CheckIcon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { Checkbox, SelectField, TextArea } from "@/components/text-field";
import { EVIDENCE_KIND_LABELS, EVIDENCE_KINDS, type EvidenceKind } from "@/domain/types";
import type { Serialized } from "@/lib/api";
import { formatTime } from "@/lib/format";
import type { AwardView } from "@/server/services/awards";
import type { OutcomeView, TeamSummary, ThreadMessage } from "@/server/services/requests";

export type Message = Serialized<ThreadMessage>;
export type Award = Serialized<AwardView>;
export type Outcome = Serialized<OutcomeView>;
export type Team = Serialized<TeamSummary>;

export function ThreadNotice() {
  return (
    <p role="note" className="rounded-md border-2 border-stamp bg-stamp-wash px-4 py-3 text-sm">
      <strong>This thread is visible to both teams and organizers.</strong> An AI model reviews it for
      scoring integrity.
    </p>
  );
}

export function MessageList({ messages, timeZone }: { messages: Message[]; timeZone: string }) {
  if (messages.length === 0) {
    return (
      <EmptyState title="No messages yet.">
        Say hello, share what you&apos;ve found, or offer to meet at your table.
      </EmptyState>
    );
  }
  return (
    <ol className="flex flex-col gap-4">
      {messages.map((message) => (
        <li key={message.id}>
          <MessageItem message={message} timeZone={timeZone} />
        </li>
      ))}
    </ol>
  );
}

function MessageItem({ message, timeZone }: { message: Message; timeZone: string }) {
  const time = formatTime(message.createdAt, timeZone);
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
  return (
    <article className="rounded-md border-2 border-rule bg-paper p-3">
      <p className="text-sm">
        <strong>{message.author.name}</strong>{" "}
        <span className="text-ink-soft">
          {message.author.team && `Team ${message.author.team} · `}
          {time} · #{message.id}
        </span>
      </p>
      {message.kind === "snippet" ? (
        <pre className="mt-2 overflow-x-auto rounded-sm bg-ground p-3 font-mono text-sm">
          <code>{message.body}</code>
        </pre>
      ) : (
        <p className="mt-1 break-words whitespace-pre-line">{message.body}</p>
      )}
    </article>
  );
}

type Send = (body: { kind: "text" | "snippet"; body: string }) => Promise<boolean>;

export function Composer({ onSend, table }: { onSend: Send; table: string | null }) {
  const [pending, setPending] = useState(false);

  async function send(body: Parameters<Send>[0], form?: HTMLFormElement) {
    setPending(true);
    const sent = await onSend(body);
    setPending(false);
    if (sent) form?.reset();
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void send(
          { kind: form.get("snippet") === "on" ? "snippet" : "text", body: String(form.get("body") ?? "") },
          event.currentTarget,
        );
      }}
      className="mt-4 flex flex-col gap-4 rounded-md border-2 border-rule bg-paper p-4"
    >
      <TextArea name="body" label="Message" rows={3} />
      <Checkbox name="snippet" label="Format as a code snippet" hint="Keeps spacing and uses a monospace font." />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" block disabled={pending} aria-busy={pending}>
          Send
        </Button>
        <Button
          variant="secondary"
          block
          disabled={pending}
          onClick={() => void send({ kind: "text", body: table ? `Meet at our table: ${table}.` : "Meet at our table." })}
        >
          Meet at our table
        </Button>
      </div>
    </form>
  );
}

type Submit = (body: {
  summary: string;
  evidenceKind: EvidenceKind;
  evidence: string;
  inPerson: boolean;
}) => Promise<Record<string, string> | null>;

export function OutcomeForm({ requester, onSubmit }: { requester: Team; onSubmit: Submit }) {
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  return (
    <section aria-labelledby="outcome-form">
      <h2 id="outcome-form" className="mb-1 text-lg font-bold">
        Submit outcome
      </h2>
      <p className="mb-3 text-ink-soft">
        When it&apos;s fixed, explain what you did. Team {requester.name} confirms it or sends it back.
      </p>
      <form
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          const element = event.currentTarget;
          const form = new FormData(element);
          setPending(true);
          const errors = await onSubmit({
            summary: String(form.get("summary") ?? ""),
            evidenceKind: String(form.get("evidenceKind")) as EvidenceKind,
            evidence: String(form.get("evidence") ?? ""),
            inPerson: form.get("inPerson") === "on",
          });
          setPending(false);
          setFieldErrors(errors ?? {});
          if (!errors) element.reset();
        }}
        className="flex flex-col gap-5 rounded-md border-2 border-rule bg-paper p-4"
      >
        <TextArea
          name="summary"
          label="What you did"
          hint="One or two sentences. This becomes the line on your receipt."
          rows={3}
          error={fieldErrors.summary}
        />
        <SelectField
          name="evidenceKind"
          label="Evidence type"
          options={EVIDENCE_KINDS.map((kind) => ({ value: kind, label: EVIDENCE_KIND_LABELS[kind] }))}
          error={fieldErrors.evidenceKind}
        />
        <TextArea
          name="evidence"
          label="Evidence"
          hint="A link, a code diff, or a written explanation of the fix. Links start with https://."
          rows={4}
          mono
          error={fieldErrors.evidence}
        />
        <Checkbox
          name="inPerson"
          label="We helped in person"
          hint="In-person help needs a written summary of what changed."
        />
        <Button type="submit" block disabled={pending} aria-busy={pending}>
          Submit outcome
        </Button>
      </form>
    </section>
  );
}

export function OutcomeCard({
  outcome,
  requester,
  timeZone,
  decision,
  award,
}: {
  outcome: Outcome;
  requester: Team;
  timeZone: string;
  /** The confirm and send-back buttons, when the viewer's team decides. */
  decision: React.ReactNode;
  /** The request's award, shown on the confirmed outcome it came from. */
  award: Award | null;
}) {
  const isUrl = outcome.evidenceKind === "link" || outcome.evidenceKind === "screenshot_link";
  return (
    <section aria-labelledby={`outcome-${outcome.id}`} className="rounded-md border-2 border-rule bg-paper p-4">
      <h2 id={`outcome-${outcome.id}`} className="text-lg font-bold">
        Outcome
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Submitted by {outcome.submittedBy}
        {outcome.team && `, Team ${outcome.team.name}`} · {formatTime(outcome.submittedAt, timeZone)}
        {outcome.inPerson && " · Helped in person"}
      </p>
      <p className="mt-3">{outcome.summary}</p>
      <h3 className="mt-4 font-bold">Evidence: {EVIDENCE_KIND_LABELS[outcome.evidenceKind]}</h3>
      {isUrl ? (
        <a
          href={outcome.evidence}
          className="mt-1 inline-block font-mono text-sm break-all text-stamp underline underline-offset-4 hover:text-ink"
          rel="noreferrer noopener"
          target="_blank"
        >
          {outcome.evidence}
        </a>
      ) : outcome.evidenceKind === "code_diff" ? (
        <pre className="mt-1 overflow-x-auto rounded-sm bg-ground p-3 font-mono text-sm">
          <code>{outcome.evidence}</code>
        </pre>
      ) : (
        <p className="mt-1 break-words whitespace-pre-line text-ink-soft">{outcome.evidence}</p>
      )}

      {outcome.state === "pending" && (
        <div className="mt-5 border-t-2 border-ground pt-4">
          {decision ?? (
            <p className="text-sm text-ink-soft">Waiting for Team {requester.name} to confirm.</p>
          )}
        </div>
      )}
      {(outcome.state === "confirmed" || outcome.state === "reconfirmed") && outcome.decidedAt && (
        <p
          id={`confirmation-${outcome.id}`}
          className="mt-5 flex flex-wrap items-center gap-2 border-t-2 border-ground pt-4 text-sm"
        >
          <span className="inline-flex items-center gap-1.5 font-bold text-stamp">
            <CheckIcon />
            {outcome.state === "confirmed" ? "Confirmed" : "Confirmed again"} by Team {requester.name}
          </span>
          <span className="text-ink-soft">
            {outcome.decidedBy} · {formatTime(outcome.decidedAt, timeZone)}
          </span>
          {outcome.state === "confirmed" && outcome.team && (
            <Link
              href={`/teams/${outcome.team.slug}`}
              className="text-stamp underline underline-offset-4 hover:text-ink"
            >
              See Team {outcome.team.name}&apos;s receipt
            </Link>
          )}
        </p>
      )}
      {outcome.state === "confirmed" && award && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-mono font-bold tabular-nums">
            {award.points} {award.points === 1 ? "point" : "points"} to Team {award.helpingTeam.name}
          </span>
          {award.status === "reversed" && <StatusBadge status="reversed" />}
          <span className="text-ink-soft">{award.explanation}</span>
        </div>
      )}
    </section>
  );
}

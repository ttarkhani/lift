"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TagList } from "@/components/tag";
import type { RequestAction } from "@/domain/requests";
import { getJson, postJson, type Serialized } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { usePoll } from "@/lib/usePoll";
import type { RequestView } from "@/server/services/requests";
import { Composer, MessageList, OutcomeCard, OutcomeForm, ThreadNotice, type Message } from "./thread-parts";

type View = Serialized<RequestView>;

/** Arrival notices after a redirect from the board or the new-blocker form. */
export type Done = "post" | "accept";

const ACTION_PATHS: Partial<Record<RequestAction, string>> = {
  accept: "accept",
  release: "release",
  cancel: "cancel",
  reject_outcome: "reject-outcome",
  confirm: "confirm",
  reopen: "reopen",
};

const CONFIRM_FIRST: Partial<Record<RequestAction, string>> = {
  release: "Stop helping? The blocker goes back on the board for another team.",
  cancel: "Cancel this blocker? It comes off the board and nobody can help with it.",
};

type Props = { initialView: View; initialMessages: Message[]; timeZone: string; done: Done | null };

export function RequestThread({ initialView, initialMessages, timeZone, done }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView] = useState(initialView);
  const [messages, setMessages] = useState(initialMessages);
  const [notice, setNotice] = useState<string | null>(() => {
    if (done === "post") return "Blocker posted";
    if (done === "accept") return `You're helping Team ${initialView.request.requestingTeam.name}`;
    return null;
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<RequestAction | null>(null);

  const { request } = view;
  const id = request.id;

  // Drop ?done= so a reload doesn't repeat the notice.
  useEffect(() => {
    if (done) router.replace(pathname, { scroll: false });
  }, [done, pathname, router]);

  async function refresh() {
    const next = await getJson<View>(`/api/requests/${id}`);
    if (!next.ok) return;
    setView(next.data);
    if (!next.data.canViewThread) {
      setMessages([]);
      return;
    }
    // Only fetch what's new. A stale id just re-fetches a few messages, which are de-duplicated.
    const last = messages.at(-1)?.id;
    const fetched = await getJson<{ messages: Message[] }>(
      `/api/requests/${id}/messages${last ? `?after=${last}` : ""}`,
    );
    if (fetched.ok && fetched.data.messages.length > 0) {
      setMessages((current) => {
        const known = new Set(current.map((m) => m.id));
        return [...current, ...fetched.data.messages.filter((m) => !known.has(m.id))];
      });
    }
  }

  usePoll(refresh);

  async function act(action: RequestAction) {
    const question = CONFIRM_FIRST[action];
    if (question && !window.confirm(question)) return;
    setPending(action);
    setError(null);
    setNotice(null);
    const result = await postJson<{ message: string }>(`/api/requests/${id}/${ACTION_PATHS[action]}`, {});
    setPending(null);
    if (result.ok) setNotice(result.data.message);
    else setError(result.message);
    await refresh();
  }

  async function sendMessage(body: { kind: "text" | "snippet"; body: string }): Promise<boolean> {
    setError(null);
    const result = await postJson(`/api/requests/${id}/messages`, body);
    if (!result.ok) {
      setError(result.fieldErrors.body ?? result.message);
      return false;
    }
    await refresh();
    return true;
  }

  async function submitOutcome(body: Parameters<Parameters<typeof OutcomeForm>[0]["onSubmit"]>[0]) {
    setError(null);
    setNotice(null);
    const result = await postJson<{ message: string }>(`/api/requests/${id}/outcome`, body);
    if (!result.ok) {
      if (Object.keys(result.fieldErrors).length > 0) return result.fieldErrors;
      setError(result.message);
      return {};
    }
    setNotice(result.data.message);
    await refresh();
    return null;
  }

  const can = (action: RequestAction) => view.actions.includes(action);
  const requester = request.requestingTeam;
  const helper = request.helpingTeam;
  const outcomes = (view.outcomes ?? []).filter((outcome) => outcome.state !== "rejected");
  const ownTable =
    request.party === "requester" ? requester.tableLocation : request.party === "helper" ? helper?.tableLocation ?? null : null;
  const showThread = view.canViewThread && (request.status !== "open" || messages.length > 1);

  return (
    <>
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
        <div aria-live="polite" className="empty:hidden">
          {notice && (
            <p role="status" className="rounded-md border-2 border-stamp bg-stamp-wash px-4 py-3 font-bold">
              {notice}
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="rounded-md border-2 border-alert bg-alert-wash px-4 py-3 font-bold text-alert">
            Error: {error}
          </p>
        )}

        <section aria-labelledby="details" className="rounded-md border-2 border-rule bg-paper p-4">
          <h2 id="details" className="sr-only">
            Blocker details
          </h2>
          <p className="text-sm text-ink-soft">
            Posted by {request.postedBy}, Team {requester.name}
            {requester.tableLocation && ` · ${requester.tableLocation}`} · {formatTime(request.createdAt, timeZone)}
            {request.reopenCount > 0 && ` · Reopened ${request.reopenCount === 1 ? "once" : `${request.reopenCount} times`}`}
          </p>
          <p className="mt-3 break-words whitespace-pre-line">{request.description}</p>
          {request.tried && (
            <>
              <h3 className="mt-4 font-bold">What they already tried</h3>
              <p className="mt-1 break-words whitespace-pre-line text-ink-soft">{request.tried}</p>
            </>
          )}
          {request.tags.length > 0 && (
            <div className="mt-4">
              <TagList tags={request.tags} />
            </div>
          )}
        </section>

        {request.status === "open" && (
          <section aria-label="Help" className="rounded-md border-2 border-rule bg-paper p-4">
            <p className="font-bold">Nobody is helping yet.</p>
            {can("accept") ? (
              <>
                <p className="mt-1 text-ink-soft">
                  Take it on and you&apos;ll get a private thread with Team {requester.name}.
                </p>
                <div className="mt-4">
                  <Button block disabled={pending !== null} aria-busy={pending === "accept"} onClick={() => act("accept")}>
                    Help with this
                  </Button>
                </div>
              </>
            ) : request.party === "requester" ? (
              <p className="mt-1 text-ink-soft">It&apos;s on the board. You&apos;ll see here when a team starts helping.</p>
            ) : null}
          </section>
        )}

        {!view.canViewThread && request.status !== "open" && (
          <p className="rounded-md border-2 border-rule bg-paper p-4 text-ink-soft">
            {helper ? `Team ${helper.name} is helping. ` : ""}The thread is private to the two teams and organizers.
          </p>
        )}

        {showThread && (
          <>
            <ThreadNotice />
            <section aria-labelledby="thread">
              <h2 id="thread" className="mb-3 text-lg font-bold">
                Help thread
              </h2>
              <MessageList messages={messages} timeZone={timeZone} />
              {view.canSendMessage && <Composer onSend={sendMessage} table={ownTable} />}
            </section>
          </>
        )}

        {can("submit_outcome") && <OutcomeForm requester={requester} onSubmit={submitOutcome} />}

        {outcomes.map((outcome) => (
          <OutcomeCard
            key={outcome.id}
            outcome={outcome}
            requester={requester}
            timeZone={timeZone}
            decision={
              outcome.state === "pending" && can("confirm") ? (
                <>
                  <p className="font-bold">Is it fixed?</p>
                  <p className="mt-1 text-sm text-ink-soft">Only Team {requester.name} can answer.</p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <Button block disabled={pending !== null} aria-busy={pending === "confirm"} onClick={() => act("confirm")}>
                      Confirm it&apos;s fixed
                    </Button>
                    <Button
                      variant="danger"
                      block
                      disabled={pending !== null}
                      aria-busy={pending === "reject_outcome"}
                      onClick={() => act("reject_outcome")}
                    >
                      Not fixed yet
                    </Button>
                  </div>
                </>
              ) : null
            }
          />
        ))}

        {(can("release") || can("cancel") || can("reopen")) && (
          <div className="flex flex-col gap-3 border-t-2 border-ground pt-6 sm:flex-row">
            {can("reopen") && (
              <Button variant="secondary" block disabled={pending !== null} aria-busy={pending === "reopen"} onClick={() => act("reopen")}>
                Reopen blocker
              </Button>
            )}
            {can("release") && (
              <Button variant="secondary" block disabled={pending !== null} aria-busy={pending === "release"} onClick={() => act("release")}>
                Stop helping
              </Button>
            )}
            {can("cancel") && (
              <Button variant="danger" block disabled={pending !== null} aria-busy={pending === "cancel"} onClick={() => act("cancel")}>
                Cancel blocker
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

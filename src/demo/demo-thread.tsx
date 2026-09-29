"use client";

import { useEffect, useRef, useState } from "react";
import { MessageList, OutcomeCard, ThreadNotice } from "@/app/requests/[id]/thread-parts";
import { Button } from "@/components/button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TagList } from "@/components/tag";
import { confirmMessage } from "@/domain/scoring";
import { formatTime } from "@/lib/format";
import { beforeConfirmation, DEMO_TIME_ZONE, type DemoRequest } from "./fixtures";

type Props = {
  /** The request as it ends up. */
  request: DemoRequest;
  /** True for the worked thread: it opens at "Outcome submitted" and "Confirm it's fixed" works in the page. */
  interactive: boolean;
  /** Open the worked thread already confirmed, for links to its confirmation. */
  startConfirmed: boolean;
};

/**
 * A blocker and its help thread, read-only. Nothing here sends a request: the one live button,
 * "Confirm it's fixed" on the worked thread, only switches this page to the confirmed version.
 */
export function DemoThread({ request, interactive, startConfirmed }: Props) {
  const [confirmed, setConfirmed] = useState(!interactive || startConfirmed);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  // The confirm button goes away once it's used, so keyboard focus moves to the result.
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  const view = confirmed ? request : beforeConfirmation(request);
  const requester = view.requestingTeam;
  const helper = view.helpingTeam;
  const timeZone = DEMO_TIME_ZONE;

  function confirm() {
    setConfirmed(true);
    setNotice(confirmMessage(request.award));
  }

  return (
    <>
      <PageHeader
        title={view.title}
        back={{ label: "Board", href: "/demo/board" }}
        meta={
          <>
            {view.status === "cancelled" ? (
              <span className="text-sm font-bold">Cancelled</span>
            ) : (
              <StatusBadge status={view.status} />
            )}
            <StatusBadge status="demo" />
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
            <p
              ref={noticeRef}
              role="status"
              tabIndex={-1}
              className="rounded-md border-2 border-stamp bg-stamp-wash px-4 py-3 font-bold"
            >
              {notice}
            </p>
          )}
        </div>

        <section aria-labelledby="details" className="rounded-md border-2 border-rule bg-paper p-4">
          <h2 id="details" className="sr-only">
            Blocker details
          </h2>
          <p className="text-sm text-ink-soft">
            Posted by {view.postedBy}, Team {requester.name}
            {requester.tableLocation && ` · ${requester.tableLocation}`} · {formatTime(view.createdAt, timeZone)}
          </p>
          <p className="mt-3 break-words whitespace-pre-line">{view.description}</p>
          {view.tried && (
            <>
              <h3 className="mt-4 font-bold">What they already tried</h3>
              <p className="mt-1 break-words whitespace-pre-line text-ink-soft">{view.tried}</p>
            </>
          )}
          {view.tags.length > 0 && (
            <div className="mt-4">
              <TagList tags={view.tags} />
            </div>
          )}
        </section>

        {view.status === "open" ? (
          <section aria-label="Help" className="rounded-md border-2 border-rule bg-paper p-4">
            <p className="font-bold">Nobody is helping yet.</p>
            <p className="mt-1 text-ink-soft">
              Take it on and you&apos;ll get a private thread with Team {requester.name}.
            </p>
            <div className="mt-4">
              <Button block disabled aria-describedby="demo-only-help">
                Help with this
              </Button>
            </div>
            <p id="demo-only-help" className="mt-2 text-sm text-ink-soft">
              Demo only: helping needs a team, so it&apos;s turned off here.
            </p>
          </section>
        ) : (
          <>
            <ThreadNotice />
            <section aria-labelledby="thread">
              <h2 id="thread" className="mb-3 text-lg font-bold">
                Help thread
              </h2>
              <MessageList messages={view.messages} timeZone={timeZone} />
            </section>
          </>
        )}

        {view.outcome && (
          <OutcomeCard
            outcome={view.outcome}
            requester={requester}
            timeZone={timeZone}
            award={view.award}
            teamsPath="/demo/teams"
            linkEvidence={false}
            decision={
              <>
                <p className="font-bold">Is it fixed?</p>
                <p className="mt-1 text-sm text-ink-soft">
                  Only Team {requester.name} can answer. In the demo, you answer for them.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Button block onClick={confirm} aria-describedby="demo-only-decision">
                    Confirm it&apos;s fixed
                  </Button>
                  <Button variant="danger" block disabled aria-describedby="demo-only-decision">
                    Not fixed yet
                  </Button>
                </div>
                <p id="demo-only-decision" className="mt-3 text-sm text-ink-soft">
                  Demo only: confirming changes this page and sends nothing. &ldquo;Not fixed yet&rdquo; is turned
                  off.
                </p>
              </>
            }
          />
        )}
      </div>
    </>
  );
}

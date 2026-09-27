import Link from "next/link";
import { cx } from "@/lib/cx";
import { formatTime, ordinal } from "@/lib/format";
import { CheckIcon } from "./icons";
import { StatusBadge } from "./status-badge";

export type ReceiptLine = {
  requestId: number;
  helpedTeam: string;
  summary: string;
  points: number;
  pairIndex: number;
  confirmedBy: string;
  confirmedAt: string;
  state: "counted" | "under_review" | "reversed";
};

type ReceiptProps = {
  teamName: string;
  table: string;
  lines: ReceiptLine[];
  timeZone: string;
};

/** Adds the running total after each line. Reversed lines stay listed but add nothing. */
export function withRunningTotals<T extends Pick<ReceiptLine, "points" | "state">>(
  lines: T[],
): (T & { running: number })[] {
  return lines.reduce<(T & { running: number })[]>((rows, line) => {
    const previous = rows.at(-1)?.running ?? 0;
    const running = line.state === "reversed" ? previous : previous + line.points;
    return [...rows, { ...line, running }];
  }, []);
}

/**
 * The contribution receipt: the one loud element in the app (see docs/design.md).
 * Reversed awards stay listed but don't count toward the total.
 */
export function Receipt({ teamName, table, lines, timeZone }: ReceiptProps) {
  const rows = withRunningTotals(lines);
  const total = rows.at(-1)?.running ?? 0;
  const headingId = `receipt-${teamName.toLowerCase()}`;

  return (
    <div className="drop-shadow-paper">
      <article
        aria-labelledby={headingId}
        className="torn-edges bg-paper px-5 py-9 font-mono text-ink sm:px-8"
      >
        <header className="text-center">
          <p className="text-xs text-ink-soft">Lifts contribution receipt</p>
          <h2 id={headingId} className="mt-1 text-xl font-bold">
            Team {teamName}
          </h2>
          <p className="text-xs text-ink-soft">{table}</p>
        </header>

        <div className="my-5 border-t-2 border-dashed border-rule" />

        <ol className="flex flex-col gap-6">
          {rows.map((line) => (
            <li key={line.requestId}>
              <div className="flex items-baseline justify-between gap-3 text-xs text-ink-soft">
                <Link
                  href={`/requests/${line.requestId}`}
                  className="text-stamp underline underline-offset-4 hover:text-ink"
                >
                  Request #{line.requestId}
                </Link>
                <span>{formatTime(line.confirmedAt, timeZone)}</span>
              </div>

              <div className="mt-1 flex items-start justify-between gap-4">
                <p className="text-sm font-bold">
                  Helped Team {line.helpedTeam} {line.summary}
                </p>
                <p
                  className={cx(
                    "shrink-0 text-right text-lg font-bold tabular-nums",
                    line.state === "reversed" && "text-alert line-through",
                  )}
                >
                  <span className="sr-only">
                    {line.state === "reversed" ? "Reversed, was " : ""}
                  </span>
                  +{line.points}
                </p>
              </div>

              <p className="mt-0.5 text-xs text-ink-soft">
                {ordinal(line.pairIndex)} confirmed fix between these two teams
              </p>

              <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                <span className="inline-block -rotate-2 rounded-sm border-3 border-double border-stamp px-2 py-1 text-xs text-stamp">
                  <span className="flex items-center gap-1.5 font-bold">
                    <CheckIcon className="shrink-0" />
                    Confirmed by Team {line.helpedTeam}
                  </span>
                  <span className="block">{line.confirmedBy}</span>
                </span>
                <span className="text-xs text-ink-soft tabular-nums">
                  Running total {line.running}
                </span>
              </div>

              {line.state !== "counted" && (
                <StatusBadge
                  status={line.state}
                  className="mt-2 font-sans"
                />
              )}
            </li>
          ))}
        </ol>

        <div className="my-5 border-t-2 border-dashed border-rule" />

        <div className="flex items-end justify-between gap-4">
          <p className="font-bold">Confirmed points</p>
          <p className="text-2xl font-bold tabular-nums sm:text-display">
            <span className="bg-marker px-1.5">{total}</span>
          </p>
        </div>
        <p className="mt-4 text-xs text-ink-soft">
          Between any two teams: 20 points for the first confirmed fix, 5 for
          the second, and 0 after that. Under review still counts until an
          organizer decides.
        </p>
      </article>
    </div>
  );
}

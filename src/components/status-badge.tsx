import { cx } from "@/lib/cx";
import {
  CheckIcon,
  CircleIcon,
  DiamondIcon,
  FlagIcon,
  HalfCircleIcon,
  HourglassIcon,
  ReverseIcon,
} from "./icons";

export type BadgeStatus =
  | "open"
  | "accepted"
  | "outcome_submitted"
  | "resolved"
  | "under_review"
  | "reversed"
  | "demo";

// Each status has its own icon, word, and border style, so color is never the only signal.
const styles: Record<BadgeStatus, { label: string; Icon: typeof CircleIcon; className: string }> = {
  open: { label: "Open", Icon: CircleIcon, className: "border-ink text-ink bg-paper" },
  accepted: { label: "Accepted", Icon: HalfCircleIcon, className: "border-stamp text-stamp bg-paper" },
  outcome_submitted: { label: "Outcome submitted", Icon: HourglassIcon, className: "border-stamp text-stamp bg-stamp-wash" },
  resolved: { label: "Resolved", Icon: CheckIcon, className: "border-stamp bg-stamp text-paper" },
  under_review: { label: "Under review", Icon: FlagIcon, className: "border-dashed border-ink text-ink bg-paper" },
  reversed: { label: "Reversed", Icon: ReverseIcon, className: "border-alert text-alert bg-alert-wash" },
  demo: { label: "Demo", Icon: DiamondIcon, className: "border-dotted border-ink text-ink bg-paper" },
};

export function StatusBadge({ status, className }: { status: BadgeStatus; className?: string }) {
  const { label, Icon, className: tone } = styles[status];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border-2 px-2 py-0.5 text-xs font-bold",
        tone,
        className,
      )}
    >
      <Icon className="shrink-0" />
      {label}
    </span>
  );
}

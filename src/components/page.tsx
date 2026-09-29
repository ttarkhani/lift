import { cx } from "@/lib/cx";

/** Page width: one 40rem column, or 72rem for organizer screens. */
export function Page({ wide, children }: { wide?: boolean; children: React.ReactNode }) {
  return <div className={cx("mx-auto w-full", wide ? "max-w-wide" : "max-w-page")}>{children}</div>;
}

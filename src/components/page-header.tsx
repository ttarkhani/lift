import Link from "next/link";

type PageHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** A link back up one level, such as the board. */
  back?: { label: string; href: string };
  /** Badges or other details shown under the title. */
  meta?: React.ReactNode;
  /** The page's primary action. */
  action?: React.ReactNode;
};

export function PageHeader({ title, description, back, meta, action }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="mb-2 inline-block text-sm text-stamp underline underline-offset-4 hover:text-ink"
          >
            ← {back.label}
          </Link>
        )}
        <h1 className="text-xl font-bold text-balance sm:text-2xl">{title}</h1>
        {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
        {description && <p className="mt-2 max-w-prose text-ink-soft">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

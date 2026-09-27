import { cx } from "@/lib/cx";

/** A topic label on a blocker, such as "deployment". */
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-sm border border-rule bg-ground px-2 py-0.5 font-mono text-xs text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TagList({ tags, label = "Tags" }: { tags: string[]; label?: string }) {
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={label}>
      {tags.map((tag) => (
        <li key={tag}>
          <Tag>{tag}</Tag>
        </li>
      ))}
    </ul>
  );
}

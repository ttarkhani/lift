import { Button } from "./button";

type EmptyStateProps = {
  title: string;
  children?: React.ReactNode;
  action?: { label: string; href: string };
};

/** Shown in place of an empty list. Always points at the next useful action. */
export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <div className="rounded-md border-2 border-dashed border-rule bg-paper px-4 py-8 text-center">
      <p className="text-lg font-bold">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-sm text-ink-soft">{children}</div>}
      {action && (
        <div className="mt-5">
          <Button href={action.href}>{action.label}</Button>
        </div>
      )}
    </div>
  );
}

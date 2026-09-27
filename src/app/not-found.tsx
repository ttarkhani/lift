import { Page } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function NotFound() {
  return (
    <Page>
      <PageHeader title="Page not found" />
      <EmptyState title="There's nothing at this address." action={{ label: "Go to the board", href: "/board" }}>
        The link may be mistyped, or the page may have been removed.
      </EmptyState>
    </Page>
  );
}

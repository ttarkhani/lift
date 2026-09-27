import { Page } from "./app-shell";
import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";

/** Shown in place of an organizer page to someone signed in without the organizer role. */
export function NoAccess({ title }: { title: string }) {
  return (
    <Page>
      <PageHeader title={title} />
      <EmptyState title="Only organizers can see this page." action={{ label: "Go to the board", href: "/board" }}>
        If you should be an organizer, ask the Lifts team to add the role, then log out and back in.
      </EmptyState>
    </Page>
  );
}

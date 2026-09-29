import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function DemoNotFound() {
  return (
    <>
      <PageHeader title="Page not found" />
      <EmptyState title="That page isn't part of the demo." action={{ label: "Back to the tour", href: "/demo" }}>
        The link may be mistyped. Everything in the demo starts from the tour.
      </EmptyState>
    </>
  );
}

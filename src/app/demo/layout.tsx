import type { Metadata } from "next";
import { Page } from "@/components/page";
import { DemoBanner } from "@/demo/demo-banner";

export const metadata: Metadata = {
  title: { default: "Demo", template: "%s · Demo · Lifts" },
  description: "A read-only tour of Lifts with invented teams. No login needed.",
};

// The demo's pages use invented data from src/demo only. They never read the database, the
// session, or an /api route; ESLint and src/demo/boundary.test.ts hold them to it.
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <Page>
      <DemoBanner />
      {children}
    </Page>
  );
}

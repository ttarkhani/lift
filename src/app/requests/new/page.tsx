import type { Metadata } from "next";
import { Page } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { requireTeamPage } from "@/server/auth/pages";
import { NewRequestForm } from "./new-request-form";

export const metadata: Metadata = { title: "Post a blocker" };

export default async function NewRequestPage() {
  await requireTeamPage("/requests/new");
  return (
    <Page>
      <PageHeader
        title="Post a blocker"
        back={{ label: "Board", href: "/board" }}
        description="Other teams see this on the board. Be specific so the right team picks it up."
      />
      <NewRequestForm />
    </Page>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Page } from "@/components/app-shell";
import { Button } from "@/components/button";
import { PageHeader } from "@/components/page-header";
import { getViewer } from "@/server/auth/guards";
import { loginHref } from "@/server/auth/pages";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join your team" };

export default async function JoinPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(loginHref("/join"));

  if (viewer.team) {
    return (
      <Page>
        <PageHeader
          title={`You're on Team ${viewer.team.name}`}
          description="Your team is locked in. If you joined the wrong team, ask an organizer to move you."
        />
        <Button href="/board" block>
          Go to the board
        </Button>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Join your team"
        description="Your organizers gave each registered team an invite code. You can only join one team."
      />
      <JoinForm />
    </Page>
  );
}

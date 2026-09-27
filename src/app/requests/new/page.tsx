import type { Metadata } from "next";
import { Page } from "@/components/app-shell";
import { Button } from "@/components/button";
import { PageHeader } from "@/components/page-header";
import { requireTeamPage } from "@/server/auth/pages";
import { TextArea, TextField } from "@/components/text-field";

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
      <form className="flex flex-col gap-6 rounded-md border-2 border-rule bg-paper p-4 sm:p-6">
        <TextField
          name="title"
          label="Title"
          hint="One line. For example: Our backend works locally but fails on deployment."
          maxLength={120}
        />
        <TextArea
          name="description"
          label="Description"
          hint="What's happening, what you expected, and any error messages."
          rows={5}
        />
        <TextField
          name="tags"
          label="Tags"
          hint="Separate with commas, for example: deployment, docker."
          optional
        />
        <TextArea
          name="tried"
          label="What you already tried"
          hint="Saves your helpers from suggesting it again."
          rows={3}
        />
        <Button block>Post a blocker</Button>
      </form>
    </Page>
  );
}

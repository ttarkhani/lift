import type { Metadata } from "next";
import { Page } from "@/components/app-shell";
import { Button } from "@/components/button";
import { PageHeader } from "@/components/page-header";
import { ChoiceGroup, TextField } from "@/components/text-field";
import { SKILLS } from "@/domain/types";

export const metadata: Metadata = { title: "Join your team" };

export default function JoinPage() {
  return (
    <Page>
      <PageHeader
        title="Join your team"
        description="Your organizers gave each registered team an invite code. You can only join one team."
      />
      <form className="flex flex-col gap-6 rounded-md border-2 border-rule bg-paper p-4 sm:p-6">
        <TextField
          name="code"
          label="Invite code"
          hint="For example, MAPLE-7K3Q. Ask an organizer if you don't have one."
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          mono
        />
        <ChoiceGroup
          name="skills"
          legend="What can you help with?"
          hint="Pick any that fit. Other teams see these when they're stuck."
          options={SKILLS.map((skill) => ({ value: skill, label: skill }))}
        />
        <Button block>Join team</Button>
      </form>
    </Page>
  );
}

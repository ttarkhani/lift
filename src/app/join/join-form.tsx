"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/button";
import { ChoiceGroup, TextField } from "@/components/text-field";
import { SKILLS } from "@/domain/types";
import { postJson } from "@/lib/api";

export function JoinForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ error?: string; codeError?: string; done?: string }>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setStatus({});
    const result = await postJson<{ team: { name: string } }>("/api/join", {
      code: form.get("code"),
      skills: form.getAll("skills"),
    });
    if (result.ok) {
      setStatus({ done: `You joined Team ${result.data.team.name}.` });
      router.push("/board");
      router.refresh();
      return;
    }
    setPending(false);
    setStatus(
      result.fieldErrors.code || result.status === 404 || result.status === 409
        ? { codeError: result.fieldErrors.code ?? result.message }
        : { error: result.message },
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-6 rounded-md border-2 border-rule bg-paper p-4 sm:p-6"
    >
      <TextField
        name="code"
        label="Invite code"
        hint="For example, MAPLE-7K3Q. Ask an organizer if you don't have one."
        error={status.codeError}
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
      <p role="status" aria-live="polite" className="empty:hidden font-bold">
        {status.done}
      </p>
      {status.error && (
        <p role="alert" className="font-bold text-alert">
          Error: {status.error}
        </p>
      )}
      <Button type="submit" block disabled={pending} aria-busy={pending}>
        Join team
      </Button>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/button";
import { TextArea, TextField } from "@/components/text-field";
import { postJson } from "@/lib/api";

export function NewRequestForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setFieldErrors({});
    const result = await postJson<{ request: { id: string } }>("/api/requests", {
      title: form.get("title"),
      description: form.get("description"),
      tags: form.get("tags"),
      tried: form.get("tried"),
    });
    if (result.ok) {
      router.push(`/requests/${result.data.request.id}?done=post`);
      return;
    }
    setPending(false);
    setFieldErrors(result.fieldErrors);
    if (Object.keys(result.fieldErrors).length === 0) setError(result.message);
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-6 rounded-md border-2 border-rule bg-paper p-4 sm:p-6"
    >
      <TextField
        name="title"
        label="Title"
        hint="One line. For example: Our backend works locally but fails on deployment."
        maxLength={120}
        error={fieldErrors.title}
      />
      <TextArea
        name="description"
        label="Description"
        hint="What's happening, what you expected, and any error messages."
        rows={5}
        error={fieldErrors.description}
      />
      <TextField
        name="tags"
        label="Tags"
        hint="Separate with commas, for example: deployment, docker."
        optional
        error={fieldErrors.tags}
      />
      <TextArea
        name="tried"
        label="What you already tried"
        hint="Saves your helpers from suggesting it again."
        rows={3}
        optional
        error={fieldErrors.tried}
      />
      {error && (
        <p role="alert" className="font-bold text-alert">
          Error: {error}
        </p>
      )}
      <Button type="submit" block disabled={pending} aria-busy={pending}>
        Post a blocker
      </Button>
    </form>
  );
}

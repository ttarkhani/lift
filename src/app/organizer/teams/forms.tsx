"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/button";
import { Checkbox, SelectField, TextArea, TextField } from "@/components/text-field";
import { postJson } from "@/lib/api";

type Outcome = { message?: string; error?: string; fieldErrors?: Record<string, string> };

/** Posts a form's values, then refreshes the page so the server-rendered lists update. */
function useAction<T>(url: string, success: (data: T) => string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({});

  async function run(body: unknown, form?: HTMLFormElement) {
    setPending(true);
    setOutcome({});
    const result = await postJson<T>(url, body);
    setPending(false);
    if (!result.ok) {
      setOutcome({ error: result.message, fieldErrors: result.fieldErrors });
      return;
    }
    setOutcome({ message: success(result.data) });
    form?.reset();
    router.refresh();
  }

  return { pending, outcome, run };
}

function Feedback({ outcome }: { outcome: Outcome }) {
  return (
    <>
      <p role="status" aria-live="polite" className="text-sm font-bold empty:hidden">
        {outcome.message}
      </p>
      {outcome.error && (
        <p role="alert" className="text-sm font-bold text-alert">
          Error: {outcome.error}
        </p>
      )}
    </>
  );
}

export function CreateTeamForm() {
  const { pending, outcome, run } = useAction<{ team: { name: string } }>(
    "/api/organizer/teams",
    ({ team }) => `Team ${team.name} added. Issue it an invite code below.`,
  );

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        run(
          {
            name: form.get("name"),
            tableLocation: form.get("tableLocation"),
            isDemo: form.get("isDemo") === "on",
          },
          event.currentTarget,
        );
      }}
      className="flex flex-col gap-4 rounded-md border-2 border-rule bg-paper p-4 sm:p-5"
    >
      <h2 className="text-lg font-bold">Add a team</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Team name" autoComplete="off" error={outcome.fieldErrors?.name} />
        <TextField
          name="tableLocation"
          label="Table"
          hint="For example, Table 12."
          optional
          autoComplete="off"
          error={outcome.fieldErrors?.tableLocation}
        />
      </div>
      <Checkbox
        name="isDemo"
        label="Demo team"
        hint="Labelled Demo and hidden from the leaderboard unless someone turns demo teams on."
      />
      <Feedback outcome={outcome} />
      <div>
        <Button type="submit" block disabled={pending} aria-busy={pending}>
          Add team
        </Button>
      </div>
    </form>
  );
}

export function IssueInviteForm({
  teamId,
  teamName,
  maxUses,
}: {
  teamId: string;
  teamName: string;
  maxUses: number;
}) {
  const { pending, outcome, run } = useAction<{ invite: { code: string } }>(
    `/api/organizer/teams/${teamId}/invites`,
    ({ invite }) => `Invite code ${invite.code} issued.`,
  );

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        run({ maxUses: Number(new FormData(event.currentTarget).get("maxUses")) });
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-28">
          <TextField
            id={`max-uses-${teamId}`}
            name="maxUses"
            label="Uses"
            type="number"
            inputMode="numeric"
            min={1}
            max={maxUses}
            defaultValue={4}
            error={outcome.fieldErrors?.maxUses}
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={pending}
          aria-busy={pending}
          aria-label={`Issue invite code for Team ${teamName}`}
        >
          Issue invite code
        </Button>
      </div>
      <Feedback outcome={outcome} />
    </form>
  );
}

type TeamOption = { id: string; name: string };

export function MoveMemberForm({
  userId,
  memberName,
  currentTeamId,
  teams,
}: {
  userId: string;
  memberName: string;
  currentTeamId: string;
  teams: TeamOption[];
}) {
  const { pending, outcome, run } = useAction<{ to: { name: string } }>(
    `/api/organizer/members/${userId}/move`,
    ({ to }) => `Moved ${memberName} to Team ${to.name}.`,
  );
  const others = teams.filter((team) => team.id !== currentTeamId);
  if (others.length === 0) return null;

  return (
    <details className="mt-1">
      <summary className="inline-flex min-h-tap cursor-pointer items-center text-sm font-bold text-stamp underline underline-offset-4 hover:text-ink">
        Move {memberName}
      </summary>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          run({ teamId: form.get("teamId"), reason: form.get("reason") }, event.currentTarget);
        }}
        className="mt-2 flex flex-col gap-3 border-l-4 border-rule pl-3"
      >
        <SelectField
          id={`move-team-${userId}`}
          name="teamId"
          label="New team"
          options={others.map((team) => ({ value: team.id, label: `Team ${team.name}` }))}
          error={outcome.fieldErrors?.teamId}
        />
        <TextArea
          id={`move-reason-${userId}`}
          name="reason"
          label="Reason"
          hint="Kept on record with the move."
          rows={2}
          error={outcome.fieldErrors?.reason}
        />
        <Feedback outcome={outcome} />
        <div>
          <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>
            Move member
          </Button>
        </div>
      </form>
    </details>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api, type RouterOutputs } from "~/trpc/react";
import { FormError } from "../ReasonField";

type Member = NonNullable<RouterOutputs["thinkpagesForumMod"]["resolveMember"]>;

interface MemberLookupProps {
  /** The button's label, e.g. "Ban a member". */
  action: string;
  /** Receives the member found; a rejection shows its message under the field. */
  onFound: (member: Member) => Promise<void> | void;
}

/** A Passport handle or wiki username, resolved to a member before `onFound` acts on them. */
export function MemberLookup({ action, onFound }: MemberLookupProps) {
  const utils = api.useUtils();
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = handle.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    utils.thinkpagesForumMod.resolveMember
      .fetch({ handle: trimmed })
      .then(async (member) => {
        if (!member) {
          setError("No member has that handle.");
          return;
        }
        await onFound(member);
        setHandle("");
      })
      .catch((e: Error) => setError(e.message || "Could not find that member."))
      .finally(() => setBusy(false));
  };

  return (
    <form onSubmit={submit} className="w-full space-y-2">
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Member handle"
          placeholder="Passport handle or wiki username"
          value={handle}
          maxLength={100}
          onChange={(e) => setHandle(e.target.value)}
          disabled={busy}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="secondary" disabled={busy || !trimmed}>
          {action}
        </Button>
      </div>
      <FormError message={error} />
    </form>
  );
}

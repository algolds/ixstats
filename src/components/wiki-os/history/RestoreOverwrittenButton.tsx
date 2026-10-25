"use client";
// "Restore my text" on the diff an overwritten author's notice links to (`?conflict=<id>`): shown only when the server
// says the viewer wrote that text, it saves the text again as a new edit of the page.

import { Check, Undo, WarningTriangle } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";

export interface RestoreOverwrittenButtonProps {
  /** The conflict the notice named; empty on a diff opened any other way. */
  conflictId: string;
  /** The overwritten revision the diff shows. */
  revisionRef: string;
}

export function RestoreOverwrittenButton({
  conflictId,
  revisionRef,
}: RestoreOverwrittenButtonProps) {
  const input = { conflictId, ref: revisionRef };
  const { data } = api.wikios.overwrittenRestorable.useQuery(input, {
    enabled: conflictId.length > 0 && revisionRef.length > 0,
    staleTime: 60_000,
  });
  const restore = api.wikios.restoreOverwritten.useMutation();
  const result = restore.data;

  if (result?.success) {
    return (
      <span className="text-green text-caption flex items-center gap-1.5">
        <Check className="h-3.5 w-3.5" />
        Your text is back, as a new edit of the page.
      </span>
    );
  }
  if (result && !result.success) {
    return (
      <span role="alert" className="text-red text-caption flex items-center gap-1.5">
        <WarningTriangle className="h-3.5 w-3.5 shrink-0" />
        Someone edited the page since. Nothing was saved; edit the page to bring your text back.
      </span>
    );
  }
  if (!data?.restorable) return null;
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={restore.isPending}
        onClick={() => restore.mutate(input)}
      >
        <Undo className="h-3.5 w-3.5" />
        Restore my text
      </Button>
      {restore.error && <span className="text-red text-caption">{restore.error.message}</span>}
    </div>
  );
}

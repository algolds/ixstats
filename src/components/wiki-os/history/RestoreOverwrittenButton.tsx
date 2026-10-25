"use client";
// "Restore my text" on the diff an overwritten author's notice links to (`?conflict=<id>`). The server says what to
// offer: the one-click restore while the page is as the conflict left it, a link to edit the page by hand once someone
// edited it since, or nothing (not the author, or not allowed to edit the page).

import Link from "next/link";
import { Check, EditPencil, Undo, WarningTriangle } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";

export interface RestoreOverwrittenButtonProps {
  /** The conflict the notice named; empty on a diff opened any other way. */
  conflictId: string;
  /** The overwritten revision the diff shows. */
  revisionRef: string;
}

function EditLink({ href }: { href: string }) {
  return (
    <Button asChild variant="secondary" size="sm">
      <Link href={href}>
        <EditPencil className="h-3.5 w-3.5" />
        Edit the page
      </Link>
    </Button>
  );
}

export function RestoreOverwrittenButton({
  conflictId,
  revisionRef,
}: RestoreOverwrittenButtonProps) {
  const input = { conflictId, ref: revisionRef };
  const utils = api.useUtils();
  const { data: offer } = api.wikios.overwrittenRestorable.useQuery(input, {
    enabled: conflictId.length > 0 && revisionRef.length > 0,
    staleTime: 60_000,
  });
  const restore = api.wikios.restoreOverwritten.useMutation({
    onSuccess: (result) => {
      if (!result.success) return;
      // the page has a new head: the diff, the history and the revision the view shows are stale
      void utils.wikios.getDiff.invalidate();
      void utils.wikios.getHistory.invalidate();
      void utils.wikios.getRevisionContent.invalidate();
      void utils.wikios.overwrittenRestorable.invalidate();
    },
  });
  const result = restore.data;
  if (!offer || offer.state === "unavailable") return null;

  if (result?.success) {
    return (
      <span role="status" className="text-green text-caption flex items-center gap-1.5">
        <Check className="h-3.5 w-3.5" />
        Your text is back, as a new edit of the page.
      </span>
    );
  }
  if (result) {
    return (
      <div className="flex items-center gap-2">
        <span role="alert" className="text-red text-caption flex items-center gap-1.5">
          <WarningTriangle className="h-3.5 w-3.5 shrink-0" />
          Someone edited the page since. Nothing was saved.
        </span>
        <EditLink href={offer.editHref} />
      </div>
    );
  }
  if (offer.state === "stale") return <EditLink href={offer.editHref} />;
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
      {restore.error && (
        <span role="alert" className="text-red text-caption">
          {restore.error.message}
        </span>
      )}
    </div>
  );
}

"use client";

import { Button } from "~/components/ui/button";
import type { LoreRecordState } from "~/hooks/lore/useLoreWriter";
import { loreCategory } from "~/lib/lore/lore-types";

/**
 * After the save: the piece is recorded on the Lore tab. A failed record never reads as a failed save: the page is
 * saved, and the author can record it again, reopen the page (to put its lore category back), or leave.
 */
export function LoreRecordStep({
  record,
  countryName,
  onRetry,
  onEditAgain,
  onDone,
}: {
  record: LoreRecordState | null;
  countryName: string;
  onRetry: () => void;
  onEditAgain: () => void;
  onDone: () => void;
}) {
  if (record?.status !== "failed") {
    return (
      <p role="status" className="text-body text-label-secondary mx-auto max-w-2xl px-4 py-6">
        Your page is saved. Adding it to the Lore tab.
      </p>
    );
  }
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
      <div role="alert" className="rounded-row border-red/30 bg-red/10 space-y-2 border p-3">
        <p className="text-body text-label">Your page is saved. It is not on the Lore tab yet.</p>
        <p className="text-footnote text-label">{record.message}</p>
        {record.missingCategory && (
          <p className="text-footnote text-label">
            The page no longer carries <code>[[Category:{loreCategory(countryName)}]]</code>. Put it
            back in the editor, save, and it is added.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
        <Button size="sm" variant="outline" onClick={onEditAgain}>
          Edit the page
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

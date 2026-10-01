"use client";

import { ClockRotateRight } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { FacetCard } from "~/components/ui/facet-container";
import { timeAgo } from "~/lib/format/compact";

interface EditorDraftBannerProps {
  changeCount: number;
  savedAt: Date;
  onRestore: () => void;
  onDismiss: () => void;
}

/** Offers the unsaved edits of an earlier visit that never reached the server. */
export function EditorDraftBanner({
  changeCount,
  savedAt,
  onRestore,
  onDismiss,
}: EditorDraftBannerProps) {
  return (
    <FacetCard
      role="region"
      aria-label="Unsaved edits found"
      className="rounded-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <ClockRotateRight aria-hidden="true" className="text-caution mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-label text-headline">Unsaved edits found</p>
          <p className="text-label-secondary text-body">
            {changeCount === 1 ? "1 change" : `${changeCount} changes`} kept on this device{" "}
            {timeAgo(savedAt)} never reached the server. Restore them to pick up where you left off.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onDismiss}>
          Discard
        </Button>
        <Button type="button" size="sm" onClick={onRestore}>
          Restore
        </Button>
      </div>
    </FacetCard>
  );
}

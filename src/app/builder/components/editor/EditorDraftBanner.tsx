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
      depth={2}
      role="region"
      aria-label="Unsaved edits found"
      className="flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <ClockRotateRight aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="min-w-0">
          <p className="text-foreground text-sm font-semibold">Unsaved edits found</p>
          <p className="text-muted-foreground text-sm">
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

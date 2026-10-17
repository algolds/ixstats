"use client";

import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";

interface MineBulkBarProps {
  count: number;
  onAddToShowcase: () => void;
  onDone: () => void;
}

/** Select mode's actions, held above the tab bar while the grid scrolls. Phase 4 adds fuse, list and dust. */
export function MineBulkBar({ count, onAddToShowcase, onDone }: MineBulkBarProps) {
  return (
    <FacetMaterial
      role="group"
      aria-label="Selected cards"
      className="z-chrome sticky bottom-(--shell-tabbar-height) flex flex-wrap items-center gap-2 p-2"
    >
      <span aria-live="polite" className="text-callout px-2 tabular-nums">
        {count} selected
      </span>
      <Button size="sm" disabled={count === 0} onClick={onAddToShowcase}>
        Add to showcase
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone}>
        Done
      </Button>
    </FacetMaterial>
  );
}

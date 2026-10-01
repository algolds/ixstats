"use client";

import React from "react";
import { Plus, OpenBook as BookOpen } from "iconoir-react";
import { Button } from "~/components/ui/button";

export function CollectionsSidebarContent({
  onCreateCollection,
}: {
  onCreateCollection: () => void;
}) {
  return (
    <div className="space-y-3">
      <Button size="sm" onClick={onCreateCollection} className="w-full">
        <Plus className="mr-2 h-3.5 w-3.5" /> Create Collection
      </Button>

      <div className="rounded-control bg-yellow/5 p-3">
        <div className="flex items-center gap-2">
          <BookOpen className="text-tint h-3 w-3 shrink-0" />
          <span className="text-label-secondary text-eyebrow">Tip</span>
        </div>
        <p className="text-label-secondary text-footnote mt-1 leading-relaxed">
          Use <span className="text-label font-semibold">Multi-Select Mode</span> in the Inventory
          tab to select cards and add them to your collections.
        </p>
      </div>
    </div>
  );
}

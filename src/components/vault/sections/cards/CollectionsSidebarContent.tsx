"use client";

import React from "react";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "~/components/ui/button";

export function CollectionsSidebarContent({
  onCreateCollection,
}: {
  onCreateCollection: () => void;
}) {
  return (
    <div className="space-y-3">
      <Button size="sm" onClick={onCreateCollection} className="h-8 w-full text-xs">
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Collection
      </Button>

      <div className="rounded-lg bg-amber-500/5 p-2.5">
        <div className="flex items-center gap-1.5">
          <BookOpen className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Tip
          </span>
        </div>
        <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
          Use <span className="text-foreground font-semibold">Multi-Select Mode</span> in the
          Inventory tab to select cards and add them to your collections.
        </p>
      </div>
    </div>
  );
}

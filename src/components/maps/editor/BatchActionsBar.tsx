"use client";

import React from "react";
import { Trash2, X } from "lucide-react";

interface BatchActionsBarProps {
  selectedCount: number;
  onBatchDelete: () => void;
  onDeselectAll: () => void;
  isMutating: boolean;
}

export const BatchActionsBar = React.memo(function BatchActionsBar({
  selectedCount,
  onBatchDelete,
  onDeselectAll,
  isMutating,
}: BatchActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex h-8 items-center gap-2 border-b border-border bg-muted/50 px-3 text-xs">
      <span className="font-medium text-foreground">
        {selectedCount} selected
      </span>

      <div className="mx-1 h-4 w-px bg-border" />

      <button
        onClick={onDeselectAll}
        disabled={isMutating}
        className="flex items-center gap-1 rounded px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        <X className="h-3 w-3" />
        Deselect All
      </button>

      <button
        onClick={onBatchDelete}
        disabled={isMutating}
        className="flex items-center gap-1 rounded px-2 py-1 text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
      >
        <Trash2 className="h-3 w-3" />
        Delete Selected
      </button>
    </div>
  );
});

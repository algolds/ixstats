"use client";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Check, Xmark as X } from "iconoir-react";

interface DiplomaticScenarioBulkActionsProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onBulkActivate: () => void;
  onBulkDeactivate: () => void;
}

export function DiplomaticScenarioBulkActions({
  selectedCount,
  totalCount,
  onSelectAll,
  onBulkActivate,
  onBulkDeactivate,
}: DiplomaticScenarioBulkActionsProps) {
  if (totalCount === 0) return null;

  return (
    <div className="rounded-control border-separator bg-fill-4 mb-4 flex items-center justify-between border p-3">
      <div className="flex items-center gap-3">
        <Checkbox
          checked={selectedCount > 0 && selectedCount === totalCount}
          onCheckedChange={onSelectAll}
        />
        <span className="text-footnote text-label-secondary">
          {selectedCount === 0 ? "Select all scenarios" : `${selectedCount} selected`}
        </span>
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onBulkActivate}>
            <Check className="text-green mr-1 h-3 w-3" />
            Activate selected
          </Button>
          <Button size="sm" variant="outline" onClick={onBulkDeactivate}>
            <X className="text-red mr-1 h-3 w-3" />
            Archive selected
          </Button>
        </div>
      )}
    </div>
  );
}

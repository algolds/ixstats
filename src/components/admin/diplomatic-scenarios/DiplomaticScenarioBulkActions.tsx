"use client";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Check, X } from "lucide-react";

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
    <div className="mb-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-3">
        <Checkbox
          checked={selectedCount > 0 && selectedCount === totalCount}
          onCheckedChange={onSelectAll}
        />
        <span className="text-xs text-[--intel-silver]">
          {selectedCount === 0 ? "Select all scenarios" : `${selectedCount} selected`}
        </span>
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onBulkActivate} className="text-xs">
            <Check className="mr-1 h-3 w-3 text-green-400" />
            Activate Selected
          </Button>
          <Button size="sm" variant="outline" onClick={onBulkDeactivate} className="text-xs">
            <X className="mr-1 h-3 w-3 text-red-400" />
            Archive Selected
          </Button>
        </div>
      )}
    </div>
  );
}

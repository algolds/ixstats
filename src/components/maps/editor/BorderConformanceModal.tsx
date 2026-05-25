"use client";

import { memo } from "react";
import { AlertTriangle, Check, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";

interface BorderConformanceModalProps {
  open: boolean;
  onClose: () => void;
  clippedNames: string[];
  onAccept: () => void;
}

export const BorderConformanceModal = memo(function BorderConformanceModal({
  open,
  onClose,
  clippedNames,
  onAccept,
}: BorderConformanceModalProps) {
  if (clippedNames.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            Borders Adjusted to Country Shape
          </DialogTitle>
          <DialogDescription>
            {clippedNames.length === 1
              ? "1 subdivision extended beyond the country boundary and was automatically clipped."
              : `${clippedNames.length} subdivisions extended beyond the country boundary and were automatically clipped.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-muted-foreground text-xs">
            All borders must conform to the country shape. The following subdivisions were adjusted:
          </p>

          <div className="max-h-[200px] overflow-y-auto rounded-lg border border-amber-500/30 bg-amber-500/5">
            {clippedNames.map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 border-b border-amber-500/10 px-3 py-2 last:border-0"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="text-foreground text-sm">{name}</span>
              </div>
            ))}
          </div>

          <p className="text-muted-foreground text-[11px]">
            These borders may need manual adjustment for accuracy. You can edit individual
            subdivisions after import to refine their shapes.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={onClose}
            className="bg-card text-foreground ring-border hover:bg-accent rounded-lg px-4 py-2 text-sm font-medium ring-1"
          >
            Review Manually
          </button>
          <button
            onClick={onAccept}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Check className="h-3.5 w-3.5" />
            Accept All
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

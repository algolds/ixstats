"use client";

import { Button } from "~/components/ui/button";
import { FacetCard } from "~/components/ui/facet-container";
import { memo } from "react";
import { WarningTriangle as AlertTriangle, Check, MapPin } from "iconoir-react";
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
      <DialogContent className="facet-modal max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
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

          <FacetCard surface="solid" className="max-h-[200px] overflow-y-auto rounded-lg">
            {clippedNames.map((name) => (
              <div
                key={name}
                className="border-border flex items-center gap-2 border-b px-3 py-2 last:border-0"
              >
                <MapPin className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="text-foreground text-sm">{name}</span>
              </div>
            ))}
          </FacetCard>

          <p className="text-muted-foreground text-xs">
            These borders may need manual adjustment for accuracy. You can edit individual
            subdivisions after import to refine their shapes.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Review Manually
          </Button>
          <Button variant="ghost" size="sm" onClick={onAccept}>
            <Check className="h-3.5 w-3.5" />
            Accept All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

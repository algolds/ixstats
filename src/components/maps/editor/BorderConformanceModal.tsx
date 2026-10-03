"use client";

import { Button } from "~/components/ui/button";
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
import { Card } from "~/components/ui/card";

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
      <DialogContent className="rounded-card max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="text-yellow h-5 w-5" aria-hidden />
            Borders Adjusted to Country Shape
          </DialogTitle>
          <DialogDescription>
            {clippedNames.length === 1
              ? "1 subdivision extended beyond the country boundary and was automatically clipped."
              : `${clippedNames.length} subdivisions extended beyond the country boundary and were automatically clipped.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-label-secondary text-footnote">
            All borders must conform to the country shape. The following subdivisions were adjusted:
          </p>

          <Card variant="inset" padding="none" className="max-h-[200px] overflow-y-auto">
            {clippedNames.map((name) => (
              <div
                key={name}
                className="border-separator flex items-center gap-2 border-b px-3 py-2 last:border-0"
              >
                <MapPin className="text-label-secondary h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="text-label text-body">{name}</span>
              </div>
            ))}
          </Card>

          <p className="text-label-secondary text-footnote">
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

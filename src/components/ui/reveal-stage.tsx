"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { soundCues } from "~/lib/sound/cuelume";

interface RevealStageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Full-bleed art behind the content; it keeps its own palette. */
  art?: React.ReactNode;
  /** Accessible name; shown as the heading. */
  title: string;
  children: React.ReactNode;
}

/** A reveal: a pack opening, a claimed reward. */
export function RevealStage({ open, onOpenChange, art, title, children }: RevealStageProps) {
  React.useEffect(() => {
    if (open) soundCues?.reveal?.();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-content="reveal" className="overflow-hidden p-0 sm:max-w-md">
        {art != null && (
          <div aria-hidden className="absolute inset-0 -z-10">
            {art}
          </div>
        )}
        <div className="flex flex-col items-center gap-4 px-6 pt-8 pb-6 text-center">
          <DialogTitle className="text-title-3 text-label">{title}</DialogTitle>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

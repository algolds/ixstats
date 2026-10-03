"use client";

import type { ReactNode } from "react";
import { Xmark } from "iconoir-react";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

interface WikiZoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
  /** Line under the image (the file name). */
  caption?: ReactNode;
  /** Secondary line (dimensions, type). */
  meta?: ReactNode;
}

/**
 * Full-size image zoom for the Repository, Commons and Stash detail views: a `Dialog`
 * with instant presentation so the image itself is the transition. The content fills the
 * viewport, so a click beside the image dismisses it as the old backdrop did; Escape and the
 * close button also dismiss.
 */
export function WikiZoomDialog({
  open,
  onOpenChange,
  src,
  alt,
  caption,
  meta,
}: WikiZoomDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        presentation="instant"
        showCloseButton={false}
        aria-describedby={undefined}
        onClick={() => onOpenChange(false)}
        className="flex h-dvh w-screen max-w-none cursor-zoom-out flex-col items-center justify-center gap-4 rounded-none border-0 bg-transparent p-4 shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
          title="Close (Esc)"
          className="absolute top-4 right-4 rounded-full"
        >
          <Xmark aria-hidden="true" />
        </Button>
        <img
          src={src}
          alt={alt}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          className="rounded-row shadow-sheet max-h-[80vh] max-w-full cursor-default object-contain"
        />
        {(caption || meta) && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-card border-separator bg-surface-elevated shadow-floating max-w-[80vw] cursor-default border px-4 py-2 text-center select-none"
          >
            {caption && <p className="text-headline text-label truncate">{caption}</p>}
            {meta && <p className="text-footnote text-label-secondary tabular-nums">{meta}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

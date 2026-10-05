"use client";

import * as React from "react";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { cn } from "~/lib/utils/cn";

const INSPECTOR_QUERY = "(min-width: 1280px)";

interface InspectorProps {
  title: string;
  /** Only used below 1280px, where the inspector is a sheet. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

/** The one optional trailing column of a page, pinned into the shell's reserved gutter: entity details, contents or supporting data. */
export function Inspector({ title, open, onOpenChange, children, className }: InspectorProps) {
  const wide = useMediaQuery(INSPECTOR_QUERY);
  if (wide) {
    return (
      <aside
        aria-label={title}
        data-slot="inspector"
        className={cn(
          // Pinned into the column shell.css reserves on <main>; it scrolls on its own, so the
          // page behind never has to make room for it.
          "fixed top-(--shell-top-offset) right-0 bottom-0 w-(--shell-inspector-width)",
          "overflow-y-auto py-6 pr-4",
          className
        )}
      >
        {children}
      </aside>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle>{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}

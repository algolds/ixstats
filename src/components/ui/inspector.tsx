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

/** The one optional trailing column of a page: entity details, contents or supporting data. */
export function Inspector({ title, open, onOpenChange, children, className }: InspectorProps) {
  const wide = useMediaQuery(INSPECTOR_QUERY);
  if (wide) {
    return (
      <aside
        aria-label={title}
        data-slot="inspector"
        className={cn("sticky top-(--shell-top-offset) w-80 shrink-0 self-start", className)}
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

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

/**
 * The one optional trailing column of a page, pinned into the shell's reserved gutter: entity
 * details, contents or supporting data.
 *
 * The aside is plain markup shown by CSS from xl, so it is in the server HTML and never pops in
 * after hydration. Below xl it is `display: none` and the content lives in a sheet instead; while
 * that sheet is showing, the aside holds no children so the content is mounted exactly once.
 */
export function Inspector({ title, open, onOpenChange, children, className }: InspectorProps) {
  const wide = useMediaQuery(INSPECTOR_QUERY);
  const inSheet = !wide && open;

  // Growing to xl moves the content into the aside, so the sheet's open state is stale: let the
  // owner clear it. Only a real crossing counts, never the first render.
  const wasWide = React.useRef(wide);
  React.useEffect(() => {
    if (wide && !wasWide.current && open) onOpenChange(false);
    wasWide.current = wide;
  }, [wide, open, onOpenChange]);

  return (
    <>
      <aside
        aria-label={title}
        data-slot="inspector"
        className={cn(
          // Pinned into the column shell.css reserves on <main>; it scrolls on its own, so the
          // page behind never has to make room for it.
          "fixed top-(--shell-top-offset) right-0 bottom-0 hidden w-(--shell-inspector-width) xl:block",
          "overflow-y-auto py-6 pr-4",
          className
        )}
      >
        {inSheet ? null : children}
      </aside>
      {!wide && (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent>
            <SheetTitle>{title}</SheetTitle>
            {children}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

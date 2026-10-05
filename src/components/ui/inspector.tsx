"use client";

import * as React from "react";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { cn } from "~/lib/utils/cn";

const INSPECTOR_QUERY = "(min-width: 1280px)";

const noopSubscribe = () => () => undefined;
/** False on the server and while hydrating, true on every later render. */
const useHydrated = () =>
  React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

interface InspectorProps {
  title: string;
  /** Only used below 1280px, where the inspector is a sheet. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Call `onOpenChange(false)` when the viewport grows to xl, since the sheet's open state is
   * stale then. Turn it off when `onOpenChange(false)` also discards state the aside still shows
   * (a focused entity), so widening moves it into the aside instead of clearing it.
   */
  resetSheetOnWiden?: boolean;
  /**
   * Fired on a real narrow-to-wide crossing (never while hydrating), whatever `resetSheetOnWiden`
   * says. For owners that keep a UI flag for the sheet (a "controls open" boolean) and must clear it
   * without touching what the aside still shows.
   */
  onWiden?: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * The one optional trailing column of a page, pinned into the shell's reserved gutter: entity
 * details, contents or supporting data.
 *
 * The aside is plain markup shown by CSS from xl, so it is in the server HTML and never pops in
 * after hydration. Its children stay mounted through hydration (matching that HTML), then only
 * while the viewport is wide; below xl the content lives in the sheet, so it is mounted at most
 * once and a phone never fetches for a column it cannot see.
 */
export function Inspector({
  title,
  open,
  onOpenChange,
  resetSheetOnWiden = true,
  onWiden,
  children,
  className,
}: InspectorProps) {
  const wide = useMediaQuery(INSPECTOR_QUERY);
  const hydrated = useHydrated();

  // Only a real narrow->wide change counts. Hydration reads the server snapshot (narrow) first, so
  // the baseline is taken from the real viewport in the first effect, not from the first render.
  const wasWide = React.useRef<boolean | null>(null);
  React.useEffect(() => {
    if (wasWide.current === null) {
      wasWide.current = window.matchMedia(INSPECTOR_QUERY).matches;
      return;
    }
    const widened = wide && !wasWide.current;
    wasWide.current = wide;
    if (!widened) return;
    if (resetSheetOnWiden && open) onOpenChange(false);
    onWiden?.();
  }, [wide, open, onOpenChange, resetSheetOnWiden, onWiden]);

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
        {wide || !hydrated ? children : null}
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

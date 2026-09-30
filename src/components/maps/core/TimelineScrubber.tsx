"use client";

/**
 * TimelineScrubber — read-only historical timeline control.
 *
 * Lets the user drag a slider to a past IxTime; the host (MapContainer)
 * then swaps the political layer for the snapshot at that IxTime via
 * `api.geoCore.getWorldMapAsOf`. "Return to present" restores the live
 * political layer. The slider is hidden when no BorderHistory rows exist.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Xmark } from "iconoir-react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { Slider } from "~/components/ui/slider";

export interface TimelineScrubberProps {
  /** Current scrubber value (epoch ms). `null` = at "now", show live data. */
  value: number | null;
  /** Notify host of new scrub position. `null` means "now". */
  onChange: (value: number | null) => void;
  /** Optional: hide entirely (e.g. when no history exists). */
  hidden?: boolean;
  /** Extra positioning classes from the host (e.g. shift clear of an open side panel). */
  className?: string;
}

const SCRUB_DEBOUNCE_MS = 200;

export function TimelineScrubber({ value, onChange, hidden, className }: TimelineScrubberProps) {
  // Collapsed to a small pill by default so the card doesn't sit over the map; it stays open
  // while a past date is selected.
  const [expanded, setExpanded] = useState(false);
  const { data: range, isLoading: rangeLoading } = api.geoCore.getHistoryRange.useQuery(undefined, {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  // No history rows → don't render anything.
  const hasHistory = !!range && range.minTime !== null;
  const effectivelyHidden = hidden || rangeLoading || !hasHistory;

  const minTime = (range?.minTime as number | undefined) ?? 0;
  const maxTime = range?.maxTime ?? 0;

  // Local slider state. Commits to parent (debounced) when paused.
  const isAtNow = value === null;
  const currentValue = isAtNow ? maxTime : (value as number);

  const [draft, setDraft] = useState<number>(currentValue);
  // Keep draft in sync if the parent value changes externally (e.g. "Return to present").
  useEffect(() => {
    // oxlint-disable-next-line
    setDraft(currentValue);
  }, [currentValue]);

  // Debounce: commit `draft` to parent ~200ms after the user stops dragging.
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (effectivelyHidden) return;
    if (draft === currentValue) return;
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      // If the user lands on the very end of the range, treat as "now".
      if (Math.abs(draft - maxTime) < 1) {
        onChange(null);
      } else {
        onChange(draft);
      }
    }, SCRUB_DEBOUNCE_MS);
    return () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    };
  }, [draft, currentValue, maxTime, onChange, effectivelyHidden]);

  const label = useMemo(
    () => (isAtNow ? "Viewing: now" : `Viewing: ${IxTime.formatIxTime(value as number, true)}`),
    [isAtNow, value]
  );

  if (effectivelyHidden) return null;

  const stopMapEvents = {
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
  };

  if (!expanded && isAtNow) {
    return (
      <button
        type="button"
        {...stopMapEvents}
        onClick={() => setExpanded(true)}
        aria-expanded={false}
        className={`bg-card/95 text-muted-foreground ring-border/50 hover:text-foreground focus-visible:ring-ring absolute right-4 bottom-12 z-20 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg ring-1 backdrop-blur-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${className ?? ""}`}
      >
        <Clock className="h-3.5 w-3.5" aria-hidden />
        Timeline
      </button>
    );
  }

  return (
    <div
      {...stopMapEvents}
      role="group"
      aria-label="Historical timeline"
      className={`bg-card/95 ring-border/50 absolute right-4 bottom-12 z-20 w-80 max-w-[calc(100vw-2rem)] rounded-2xl p-4 shadow-2xl ring-1 backdrop-blur-xl ${className ?? ""}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Historical Timeline
        </span>
        <div className="flex items-center gap-1">
          {!isAtNow && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="border-border bg-muted/50 text-foreground hover:bg-muted focus-visible:ring-ring rounded-md border px-2 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              Return to present
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!isAtNow) onChange(null);
              setExpanded(false);
            }}
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring rounded-full p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            aria-label={isAtNow ? "Close timeline" : "Return to present and close timeline"}
          >
            <Xmark className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      <Slider
        min={minTime}
        max={maxTime}
        step={Math.max(1, Math.floor((maxTime - minTime) / 1000))}
        value={[draft]}
        onValueChange={(v) => setDraft(v[0] ?? maxTime)}
        aria-label="Historical timeline scrubber"
      />

      <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
        <span>{IxTime.formatIxTime(minTime)}</span>
        <span className="mx-2 truncate" title={label}>
          {label}
        </span>
        <span>{IxTime.formatIxTime(maxTime)}</span>
      </div>

      <p className="text-muted-foreground/80 mt-2 text-xs leading-snug">
        Shows the political layer as of the selected date. Snapshots reflect editor history;
        countries without edits show their current border at every date.
      </p>
    </div>
  );
}

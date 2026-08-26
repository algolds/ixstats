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
}

const SCRUB_DEBOUNCE_MS = 200;

export function TimelineScrubber({ value, onChange, hidden }: TimelineScrubberProps) {
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

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="absolute right-4 bottom-20 z-30 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-black/60 p-4 shadow-2xl backdrop-blur-xl"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-white/70 uppercase">
          Historical Timeline
        </span>
        {!isAtNow && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/80 transition-colors hover:bg-white/10"
          >
            Return to present
          </button>
        )}
      </div>

      <Slider
        min={minTime}
        max={maxTime}
        step={Math.max(1, Math.floor((maxTime - minTime) / 1000))}
        value={[draft]}
        onValueChange={(v) => setDraft(v[0] ?? maxTime)}
        aria-label="Historical timeline scrubber"
      />

      <div className="mt-2 flex items-center justify-between text-[10px] text-white/50">
        <span>{IxTime.formatIxTime(minTime)}</span>
        <span className="mx-2 truncate" title={label}>
          {label}
        </span>
        <span>{IxTime.formatIxTime(maxTime)}</span>
      </div>

      <p className="mt-2 text-[10px] leading-snug text-white/40">
        Shows the political layer as of the selected date. Snapshots reflect editor history;
        countries without edits show their current border at every date.
      </p>
    </div>
  );
}

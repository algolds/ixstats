"use client";

import type { ReactNode } from "react";
import { Undo } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils/cn";

interface StudioFieldFrameProps {
  /** Names the reset button */
  label: string;
  /** The span the control can take, as text */
  range: string;
  /** The chosen preset's value, as text */
  preset: string;
  /** The value now is not the preset's */
  changed: boolean;
  /** The realm's map decides this one (fit source): the control is off */
  fromMap?: boolean;
  onReset: () => void;
  children: ReactNode;
}

/** What every rail control shares: its range, the preset's value, and a reset to it. */
export function StudioFieldFrame({
  label,
  range,
  preset,
  changed,
  fromMap = false,
  onReset,
  children,
}: StudioFieldFrameProps) {
  return (
    <div className={cn("space-y-0.5", fromMap && "opacity-60")}>
      {children}
      <div className="text-label-secondary text-caption flex items-center justify-between gap-2">
        <span className="min-w-0 truncate">
          {fromMap ? "Set by the realm's map" : `Range ${range}. Preset ${preset}`}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={!changed || fromMap}
          onClick={onReset}
          aria-label={`Reset ${label}`}
          className="shrink-0"
        >
          <Undo aria-hidden className="size-3" />
          Reset
        </Button>
      </div>
    </div>
  );
}

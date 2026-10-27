"use client";

import React, { useState } from "react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

interface RateInputProps {
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
  "aria-label": string;
  className?: string;
}

/** Clamps a typed rate into the slider's range and snaps it to the step; null when not a number. */
export function parseRate(raw: string, min: number, max: number, step: number): number | null {
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  const snapped = Math.round(Math.min(max, Math.max(min, n)) / step) * step;
  // Trim float noise from the snap (0.1 * 3 → 0.30000000000000004).
  return Number(snapped.toFixed(4));
}

/** A typed companion to a percentage slider: commits on Enter or blur, clamped to the slider range. */
export function RateInput({
  value,
  min,
  max,
  step,
  disabled,
  onCommit,
  className,
  "aria-label": ariaLabel,
}: RateInputProps) {
  const [draft, setDraft] = useState(String(value));
  // Follow the slider: a new value from outside replaces the draft.
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(String(value));
  }

  const commit = () => {
    const next = parseRate(draft, min, max, step);
    if (next == null || next === value) setDraft(String(value));
    else onCommit(next);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={draft}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-11 w-20 px-2 text-right tabular-nums sm:h-8"
      />
      <span aria-hidden="true" className="text-label-secondary text-footnote">
        %
      </span>
    </div>
  );
}

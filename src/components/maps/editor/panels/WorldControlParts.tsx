"use client";

import { useId, useRef } from "react";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils/cn";
import type { ControlName, WorldControls } from "~/lib/worldgen/world-controls";

/** What the control sections share: the controls, which of them act, and the two ways to change one. */
export interface ControlSectionProps {
  controls: WorldControls;
  available: Record<ControlName, boolean>;
  /** A value is being dragged: show it, change nothing else */
  onLive: (patch: Partial<WorldControls>) => void;
  /** A value is settled: ask for a new world */
  onCommit: (patch: Partial<WorldControls>) => void;
}

interface ControlSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** The value as text, beside the label */
  display: string;
  /** Captions under the two ends of the track */
  ends?: readonly [string, string];
  disabled?: boolean;
  /** Called on every step of a drag: updates the readout */
  onChange: (value: number) => void;
  /** Called when the drag ends, or when the keys that stepped the value are released: generates the world */
  onCommit: (value: number) => void;
}

/**
 * A labelled slider that asks for a new world when it is released, not on every tick of the drag. A key held down
 * steps the value many times: those steps update the readout and commit once, when the key comes up (or focus
 * leaves), so a held arrow does not restart the generator at every repeat.
 */
export function ControlSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  ends,
  disabled,
  onChange,
  onCommit,
}: ControlSliderProps) {
  const labelId = useId();
  const byKeyboard = useRef(false);
  // The last value a key stepped to, not yet committed
  const stepped = useRef<number | null>(null);
  const release = () => {
    const value = stepped.current;
    stepped.current = null;
    if (value !== null) onCommit(value);
  };
  return (
    <div
      className={cn("space-y-0.5", disabled && "opacity-60")}
      onKeyDownCapture={() => {
        byKeyboard.current = true;
      }}
      onKeyUp={release}
      onBlur={release}
      onPointerDownCapture={() => {
        release();
        byKeyboard.current = false;
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span id={labelId} className="text-label text-footnote">
          {label}
        </span>
        <span className="text-label-secondary text-footnote tabular-nums">{display}</span>
      </div>
      <Slider
        aria-labelledby={labelId}
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled}
        onValueChange={([next]) => next !== undefined && onChange(next)}
        onValueCommit={([next]) => {
          if (next === undefined) return;
          if (byKeyboard.current) stepped.current = next;
          else onCommit(next);
        }}
        className="py-2"
      />
      {ends && (
        <div className="text-label-secondary text-caption flex justify-between">
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </div>
      )}
    </div>
  );
}

interface SwitchRowProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function SwitchRow({ label, checked, disabled, onCheckedChange }: SwitchRowProps) {
  const labelId = useId();
  return (
    <div className={cn("flex items-center justify-between gap-2", disabled && "opacity-60")}>
      <span id={labelId} className="text-label text-footnote">
        {label}
      </span>
      <Switch
        aria-labelledby={labelId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

export const percent = (share: number, digits = 0) => `${(share * 100).toFixed(digits)}%`;

export const signed = (value: number, unit: string) =>
  `${value > 0 ? "+" : value < 0 ? "-" : ""}${Math.abs(value)}${unit}`;

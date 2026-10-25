"use client";

import React from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { RouterOutputs } from "~/trpc/react";

export type ForceBranch = RouterOutputs["security"]["getMilitaryBranches"][number];
export type ForceUnit = ForceBranch["units"][number];

/** Labelled whole-number input clamped to `[0, max]`. */
export function CountField({
  id,
  label,
  value,
  max,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const parsed = Math.floor(Number(e.target.value));
          onChange(Number.isFinite(parsed) ? Math.min(max, Math.max(0, parsed)) : 0);
        }}
      />
      {hint && <p className="text-label-secondary text-footnote">{hint}</p>}
    </div>
  );
}

/** Labelled single-line text input. */
export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export const formatCount = (n: number) => Math.round(n).toLocaleString("en-US");

/** A 0–1 ratio as a whole percent. */
export const formatPercent = (ratio: number) => `${Math.round(ratio * 100)}%`;

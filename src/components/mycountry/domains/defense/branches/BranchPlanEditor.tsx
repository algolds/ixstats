"use client";

import React, { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { FORCE_LIMITS } from "~/lib/military/force-structure";
import { formatCount, formatPercent } from "../forces/force-fields";

interface BranchPlanEditorProps {
  branchId: string;
  /** The branch's own effort weight (0–1) and its share once every branch's weight is scaled to 100%. */
  effortShare: number;
  effortOfTotal: number;
  targetActive: number | null;
  fundedStrength: number;
  canEdit: boolean;
  pending: boolean;
  onSave: (input: { id: string; effortShare: number; targetActive: number | null }) => void;
}

/** How much of the national effort a branch gets and, optionally, a cap below what the budget funds. */
export function BranchPlanEditor({
  branchId,
  effortShare,
  effortOfTotal,
  targetActive,
  fundedStrength,
  canEdit,
  pending,
  onSave,
}: BranchPlanEditorProps) {
  const [effort, setEffort] = useState(String(Math.round(effortShare * 100)));
  const [target, setTarget] = useState(targetActive === null ? "" : String(targetActive));
  const effortValue = Math.min(100, Math.max(0, Number(effort) || 0));
  const targetValue =
    target.trim() === "" ? null : Math.min(FORCE_LIMITS.maxActiveDuty, Math.max(0, Math.floor(Number(target) || 0)));
  const changed = effortValue !== Math.round(effortShare * 100) || targetValue !== targetActive;

  const summary = `Gets ${formatPercent(effortOfTotal)} of the defense effort. The budget funds ${formatCount(fundedStrength)} active personnel${
    targetActive === null ? "" : `, capped at ${formatCount(targetActive)}`
  }.`;
  if (!canEdit) return <p className="text-label-secondary text-footnote">{summary}</p>;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`effort-${branchId}`}>Effort weight (%)</Label>
          <Input
            id={`effort-${branchId}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
            className="tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`target-${branchId}`}>Strength cap (optional)</Label>
          <Input
            id={`target-${branchId}`}
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Follows the budget"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="tabular-nums"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label-secondary text-footnote min-w-0 flex-1">
          {summary} Weights are scaled so all branches add up to 100%.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={!changed || pending}
          onClick={() => onSave({ id: branchId, effortShare: effortValue / 100, targetActive: targetValue })}
        >
          Save plan
        </Button>
      </div>
    </div>
  );
}

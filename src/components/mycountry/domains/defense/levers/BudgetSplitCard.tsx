"use client";

import React, { useMemo, useState } from "react";
import { PercentageCircle } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Slider } from "~/components/ui/slider";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import {
  MIN_HEALTHY_PROCUREMENT_SHARE,
  SHARE_KEYS,
  SHARE_PRESETS,
  type BudgetShares,
  type SharePreset,
} from "~/lib/military/model";
import {
  fundingPreview,
  matchingPreset,
  rebalancePercents,
  sameSplit,
  toPercents,
  toShares,
  type ShareKey,
  type SharePercents,
} from "~/lib/military/defense-console";
import type { OwnerDefense } from "~/hooks/useDefenseConsole";
import { PRESET_COPY, SHARE_COPY } from "../defense-copy";
import { FundingPreview } from "./FundingPreview";

interface BudgetSplitCardProps {
  overview: OwnerDefense;
  canEdit: boolean;
  pending: boolean;
  onSave: (shares: BudgetShares) => void;
  onApplyPreset: (preset: SharePreset) => void;
}

const PRESETS = Object.keys(SHARE_PRESETS) as SharePreset[];

/**
 * The five budget lines as linked sliders that always add up to 100%, the three presets, and what the draft split
 * would buy (the model's own funding on it). Read-only in the free preview.
 */
export function BudgetSplitCard({
  overview,
  canEdit,
  pending,
  onSave,
  onApplyPreset,
}: BudgetSplitCardProps) {
  const saved = useMemo(() => toPercents(overview.policy.shares), [overview.policy.shares]);
  const [draft, setDraft] = useState<SharePercents>(saved);
  const changed = !sameSplit(draft, saved);
  const preset = matchingPreset(draft);
  const preview = useMemo(
    () => (changed ? fundingPreview(overview, { shares: toShares(draft) }) : overview.funding),
    [changed, draft, overview]
  );
  const set = (key: ShareKey, value: number) => setDraft((prev) => rebalancePercents(prev, key, value));
  const save = () => (preset ? onApplyPreset(preset) : onSave(toShares(draft)));

  return (
    <Card content="input">
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle icon={<PercentageCircle />}>Budget split</CardTitle>
          {preset && <Badge variant="secondary">{PRESET_COPY[preset].label}</Badge>}
        </div>
        <CardDescription>
          How the {formatCompactCurrency(overview.budget.annual)} defense budget is spent each year.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 px-5">
        {canEdit && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Presets">
            {PRESETS.map((key) => (
              <Button
                key={key}
                size="sm"
                variant={preset === key ? "secondary" : "outline"}
                title={PRESET_COPY[key].detail}
                onClick={() => setDraft(toPercents(SHARE_PRESETS[key]))}
              >
                {PRESET_COPY[key].label}
              </Button>
            ))}
          </div>
        )}
        <ul className="space-y-4">
          {SHARE_KEYS.map((key) => (
            <ShareRow
              key={key}
              shareKey={key}
              percent={draft[key]}
              annual={overview.budget.annual}
              canEdit={canEdit}
              onChange={(value) => set(key, value)}
            />
          ))}
        </ul>
        <div className="border-separator text-callout flex justify-between border-t pt-3">
          <span className="text-label-secondary">Total</span>
          <span className="text-label font-medium tabular-nums" data-testid="split-total">
            {SHARE_KEYS.reduce((sum, key) => sum + draft[key], 0)}%
          </span>
        </div>
        {draft.procurement < MIN_HEALTHY_PROCUREMENT_SHARE * 100 && (
          <p className="text-warning-ink text-footnote">
            Under 20% on procurement, equipment wears out faster than it is replaced.
          </p>
        )}
        <FundingPreview
          title={changed ? "What this split buys" : "What the budget buys now"}
          funding={preview}
          current={changed ? overview.funding : null}
          active={overview.branches.reduce((sum, b) => sum + b.active, 0)}
        />
      </CardContent>
      {canEdit && (
        <CardFooter className="justify-end gap-2 p-5">
          <Button variant="outline" size="sm" disabled={!changed} onClick={() => setDraft(saved)}>
            Reset
          </Button>
          <Button size="sm" disabled={!changed || pending} onClick={save}>
            {pending ? "Saving..." : "Save split"}
          </Button>
        </CardFooter>
      )}
      {!canEdit && <div className="pb-5" />}
    </Card>
  );
}

function ShareRow({
  shareKey,
  percent,
  annual,
  canEdit,
  onChange,
}: {
  shareKey: ShareKey;
  percent: number;
  annual: number;
  canEdit: boolean;
  onChange: (value: number) => void;
}) {
  const copy = SHARE_COPY[shareKey];
  const id = `share-${shareKey}`;
  return (
    <li className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {canEdit ? (
            <label htmlFor={id} className="text-subhead text-label font-medium">
              {copy.label}
            </label>
          ) : (
            <span className="text-subhead text-label font-medium">{copy.label}</span>
          )}
          <p className="text-label-secondary text-footnote">{copy.buys}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-label-secondary text-footnote tabular-nums">
            {formatCompactCurrency((annual * percent) / 100)}
          </span>
          {canEdit ? (
            <Input
              id={id}
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              value={percent}
              aria-label={`${copy.label} percent`}
              onChange={(e) => onChange(Number(e.target.value) || 0)}
              className="w-20 text-right tabular-nums"
            />
          ) : (
            <span className="text-callout text-label w-12 text-right tabular-nums">
              {percent}%
            </span>
          )}
        </div>
      </div>
      {canEdit && (
        <Slider
          min={0}
          max={100}
          step={1}
          value={[percent]}
          aria-label={`${copy.label} share`}
          onValueChange={([value]) => onChange(value ?? 0)}
        />
      )}
    </li>
  );
}

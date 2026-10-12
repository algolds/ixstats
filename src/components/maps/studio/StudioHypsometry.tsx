"use client";

import { useId, useState } from "react";
import { Input } from "~/components/ui/input";
import { ELEVATION_ZONES } from "~/lib/worldgen/v2/config";
import { hypsometrySum, patchOf, sameValue } from "~/lib/worldgen/studio-fields";
import { StudioFieldFrame } from "./StudioFieldFrame";
import type { StudioFieldProps } from "./StudioFields";

const shareText = (shares: readonly number[]) => shares.map((share) => String(share)).join(", ");

const asShare = (text: string): number => {
  const share = Number(text);
  return Number.isFinite(share) && share >= 0 ? share : 0;
};

interface HypsometryRowsProps {
  shares: readonly number[];
  onCommit: (shares: number[]) => void;
}

/** The nine zone inputs and their sum. Typing changes the sum; leaving the input (or Enter) commits. */
function HypsometryRows({ shares, onCommit }: HypsometryRowsProps) {
  const sumId = useId();
  const [drafts, setDrafts] = useState(() => shares.map(String));
  const sum = hypsometrySum(drafts.map(asShare));
  const empty = sum <= 0;

  const commit = () => {
    const next = drafts.map(asShare);
    if (hypsometrySum(next) > 0 && shareText(next) !== shareText(shares)) onCommit(next);
  };

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-3 gap-2">
        {ELEVATION_ZONES.map((zone, index) => (
          <label key={zone.id} className="space-y-0.5">
            <span className="text-label-secondary text-caption block truncate" title={zone.name}>
              {zone.name}
            </span>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.1}
              aria-label={`${zone.name} share`}
              aria-describedby={sumId}
              aria-invalid={empty}
              value={drafts[index] ?? ""}
              onChange={(event) =>
                setDrafts((current) =>
                  current.map((text, at) => (at === index ? event.target.value : text))
                )
              }
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") commit();
              }}
              className="text-footnote h-7 px-2 tabular-nums"
            />
          </label>
        ))}
      </div>
      <p
        id={sumId}
        role={empty ? "alert" : "status"}
        className={empty ? "text-destructive text-caption" : "text-label-secondary text-caption"}
      >
        {empty
          ? "The shares must add up to more than 0."
          : `Sum ${Number(sum.toFixed(2))}. The shares are scaled to 100% of the land.`}
      </p>
    </div>
  );
}

/** The land's share in each of the nine elevation zones, edited as numbers, with their sum. */
export function HypsometryField({ spec, params, base, onCommit, onReset }: StudioFieldProps) {
  if (spec.kind !== "hypsometry") return null;
  return (
    <StudioFieldFrame
      label={spec.label}
      range="0 or more per zone"
      preset={shareText(base.hypsometry)}
      changed={!sameValue(params.hypsometry, base.hypsometry)}
      onReset={() => onReset(["hypsometry"])}
    >
      <div className="space-y-1">
        <span className="text-label text-footnote">{spec.label}, share of land per zone</span>
        {/* Keyed by the committed shares, so a reset or another preset replaces what was typed */}
        <HypsometryRows
          key={shareText(params.hypsometry)}
          shares={params.hypsometry}
          onCommit={(shares) => onCommit(patchOf("hypsometry", shares))}
        />
      </div>
    </StudioFieldFrame>
  );
}

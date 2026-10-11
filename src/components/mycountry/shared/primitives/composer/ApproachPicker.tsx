"use client";

import React from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import {
  ACCEPTANCE_META,
  TONE_CLASSES,
  tierMeta,
  tierMaySpawnResistance,
  type IntentPackageView,
  type OfferedTier,
} from "~/components/mycountry/directives/directive-model";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";

interface ApproachPickerProps {
  packages: IntentPackageView[];
  selected: OfferedTier;
  onSelect: (tier: OfferedTier) => void;
  isLoading?: boolean;
}

/** Step 2: how hard to push, as a radio card group (arrow keys move between approaches). */
export function ApproachPicker({ packages, selected, onSelect, isLoading }: ApproachPickerProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="rounded-row h-36" />
        ))}
      </div>
    );
  }

  return (
    <RadioCardGroup
      aria-label="Approach"
      value={selected}
      onValueChange={(v) => onSelect(v as OfferedTier)}
      columns={packages.length > 3 ? 2 : 3}
      className="gap-3"
    >
      {packages.map((pkg) => {
        const tier = pkg.tier as OfferedTier;
        const meta = tierMeta(tier);
        const acceptance = ACCEPTANCE_META[pkg.acceptance];
        return (
          <RadioCard
            key={tier}
            value={tier}
            title={meta.label}
            description={meta.summary}
            className="h-full p-4"
          >
            <dl className="text-footnote mt-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-label-secondary">Bandwidth</dt>
                <dd className="text-label font-medium tabular-nums">{pkg.execBandwidthCost}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-label-secondary">Acceptance</dt>
                <dd className={cn("font-medium", TONE_CLASSES[acceptance.tone].text)}>
                  {acceptance.label}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-label-secondary">Resistance</dt>
                <dd className="text-label font-medium">
                  {tierMaySpawnResistance(tier) ? "Possible" : "None"}
                </dd>
              </div>
            </dl>
          </RadioCard>
        );
      })}
    </RadioCardGroup>
  );
}

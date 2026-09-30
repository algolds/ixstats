"use client";

import React from "react";
import { FacetContainer } from "~/components/ui/facet-container";
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

export interface ApproachPickerProps {
  packages: IntentPackageView[];
  selected: OfferedTier;
  onSelect: (tier: OfferedTier) => void;
  isLoading?: boolean;
}

/**
 * Step 2: how hard to push. A native radio group, so arrow keys move between approaches; each
 * option is a depth-3 Facet row (solid, inside the step card) with the MyCountry amber on select.
 */
export function ApproachPicker({ packages, selected, onSelect, isLoading }: ApproachPickerProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <fieldset>
      <legend className="sr-only">Approach</legend>
      <div
        className={cn(
          "grid grid-cols-1 gap-3",
          packages.length > 3 ? "sm:grid-cols-2" : "sm:grid-cols-3"
        )}
      >
        {packages.map((pkg) => {
          const tier = pkg.tier as OfferedTier;
          const meta = tierMeta(tier);
          const tone = TONE_CLASSES[meta.tone];
          const acceptance = ACCEPTANCE_META[pkg.acceptance];
          const checked = selected === tier;
          return (
            <label key={tier} className="block cursor-pointer">
              <FacetContainer
                depth={3}
                surface="solid"
                className={cn(
                  "flex h-full flex-col gap-3 rounded-xl p-4 transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.99]",
                  "has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2",
                  checked
                    ? "border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/40"
                    : "hover:bg-muted/40"
                )}
              >
                <input
                  type="radio"
                  name="directive-approach"
                  value={tier}
                  checked={checked}
                  onChange={() => onSelect(tier)}
                  className="sr-only"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <span className={cn("h-2 w-2 rounded-full", tone.dot)} aria-hidden />
                    {meta.label}
                  </span>
                  <span className="text-muted-foreground text-xs font-medium tabular-nums">
                    {pkg.civCapCost} CivCap
                  </span>
                </div>
                <p className="text-muted-foreground text-sm leading-snug">{meta.summary}</p>
                <dl className="mt-auto space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Acceptance</dt>
                    <dd className={cn("font-medium", TONE_CLASSES[acceptance.tone].text)}>
                      {acceptance.label}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Resistance</dt>
                    <dd className="text-foreground font-medium">
                      {tierMaySpawnResistance(tier) ? "Possible" : "None"}
                    </dd>
                  </div>
                </dl>
              </FacetContainer>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

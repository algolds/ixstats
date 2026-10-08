"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { realmsAndNations, sinceLabel } from "~/lib/passport/passport-labels";

interface PassportStatRowProps {
  /** Null when hidden from this viewer or when there are no Lorewards stats. */
  lorewards: { totalScore: number; rank: number | null } | null;
  realmCount: number;
  nationCount: number;
  joinedAt: string | null;
  onOpenLorewards: () => void;
}

const CELL = "text-subhead flex min-h-11 items-center gap-2 tabular-nums";

/**
 * The front face's three facts: Lorewards standing, realm and nation counts, and the join month.
 * A fact that is unknown or hidden is left out, never shown as a placeholder.
 */
export const PassportStatRow = React.memo(function PassportStatRow({
  lorewards,
  realmCount,
  nationCount,
  joinedAt,
  onOpenLorewards,
}: PassportStatRowProps) {
  const holdings = realmsAndNations(realmCount, nationCount);
  const since = sinceLabel(joinedAt);
  if (!lorewards && !holdings && !since) return null;

  return (
    // Below lg the cells wrap with plain gaps; from lg the stat column always fits all three, and a
    // single-row grid (which cannot wrap) carries the dividers, so no line starts with a border.
    <div className="border-separator divide-separator flex flex-wrap items-center gap-x-5 border-y lg:grid lg:auto-cols-max lg:grid-flow-col lg:justify-start lg:gap-x-0 lg:divide-x">
      {lorewards && (
        // A plain cell carries the divider, so the rounded button never gets a curved border.
        <div data-testid="passport-lorewards-cell" className="flex items-center lg:pr-3">
          <button
            type="button"
            onClick={onOpenLorewards}
            aria-haspopup="dialog"
            className={cn(
              CELL,
              "rounded-control hover:bg-fill-3 focus-visible:outline-tint -ml-2 px-2 transition-colors focus-visible:outline-2"
            )}
          >
            {lorewards.rank !== null && (
              <span className="text-tint font-semibold">#{lorewards.rank.toLocaleString()}</span>
            )}{" "}
            <span className="text-label">Lorewards</span>{" "}
            <span className="text-label-secondary">
              · {lorewards.totalScore.toLocaleString()} pts
            </span>
          </button>
        </div>
      )}
      {holdings && <span className={cn(CELL, "text-label lg:px-5 lg:first:pl-0")}>{holdings}</span>}
      {since && (
        <span className={cn(CELL, "text-label-secondary lg:px-5 lg:first:pl-0")}>{since}</span>
      )}
    </div>
  );
});

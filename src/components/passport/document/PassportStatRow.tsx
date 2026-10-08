"use client";

import React from "react";
import { cn } from "~/lib/utils";

/** "1 realm · 1 nation", "2 realms · 3 nations"; null when no nation is held. */
export function realmsAndNations(realmCount: number, nationCount: number): string | null {
  if (nationCount < 1) return null;
  const realms = `${realmCount} ${realmCount === 1 ? "realm" : "realms"}`;
  const nations = `${nationCount} ${nationCount === 1 ? "nation" : "nations"}`;
  return `${realms} · ${nations}`;
}

/** "Since Oct 2025"; null when the join date is unknown. */
export function sinceLabel(joinedAt: string | null): string | null {
  if (!joinedAt) return null;
  const date = new Date(joinedAt);
  if (Number.isNaN(date.getTime())) return null;
  const month = date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `Since ${month}`;
}

interface PassportStatRowProps {
  /** Null when hidden from this viewer or when there are no Lorewards stats. */
  lorewards: { totalScore: number; rank: number | null } | null;
  realmCount: number;
  nationCount: number;
  joinedAt: string | null;
  onOpenLorewards: () => void;
}

const CELL = "text-subhead flex min-h-11 items-center gap-1.5 tabular-nums";

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
    <div className="border-separator divide-separator flex flex-wrap items-center gap-x-5 border-y sm:gap-x-0 sm:divide-x">
      {lorewards && (
        <button
          type="button"
          onClick={onOpenLorewards}
          aria-haspopup="dialog"
          className={cn(
            CELL,
            "rounded-control hover:bg-fill-3 focus-visible:outline-tint -ml-2 px-2 transition-colors focus-visible:outline-2 sm:mr-3"
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
      )}
      {holdings && <span className={cn(CELL, "text-label sm:px-5 sm:first:pl-0")}>{holdings}</span>}
      {since && (
        <span className={cn(CELL, "text-label-secondary sm:px-5 sm:first:pl-0")}>{since}</span>
      )}
    </div>
  );
});

"use client";

import React from "react";
import Link from "next/link";
import { ChatBubble as MessageSquare, Spark as Sparkles, Trophy } from "iconoir-react";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { Stat } from "~/components/ui/stat";
import { cn } from "~/lib/utils";
import type { PassportPayload, PassportVault, PassportVisibility } from "../types";

interface PassportStatGridProps {
  visibility: PassportVisibility;
  lorewards: PassportPayload["wiki"]["lorewards"];
  forumStats: PassportPayload["forum"]["stats"];
  vault: PassportVault | null;
  onOpenLorewards: () => void;
  onOpenVault: () => void;
}

/** An inset panel (`Card variant="inset"` styling on a button or link). */
const STAT_CELL = cn("bg-surface-secondary text-label rounded-row", "w-full p-3");
/** Pressable cells: hover fill and the press scale. */
const STAT_CELL_INTERACTIVE =
  "hover:bg-fill-3 facet-press focus-visible:outline-tint cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2";

/** Category breadth of the whole live collection (e.g. "3/12", "Military focus"). */
function categorySummary(focus: PassportVault["focus"]): { label: string; sub: string } {
  if (!focus || focus.categoryCount === 0) return { label: "—", sub: "No categories yet" };
  const top = focus.topCategory;
  return {
    label: `${focus.categoryCount}/${focus.categoryTotal}`,
    sub: top ? `${top.charAt(0) + top.slice(1).toLowerCase()} focus` : "Collecting",
  };
}

/**
 * Front-face stat row: Lorewards, Focus, Forum and IxCredits cells. A cell whose section the owner
 * hid is not rendered (the server did not send its data either).
 */
export const PassportStatGrid = React.memo(function PassportStatGrid({
  visibility,
  lorewards,
  forumStats,
  vault,
  onOpenLorewards,
  onOpenVault,
}: PassportStatGridProps) {
  const focus = categorySummary(vault?.focus ?? null);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {visibility.accolades && (
        <button
          type="button"
          onClick={onOpenLorewards}
          className={cn(STAT_CELL, STAT_CELL_INTERACTIVE, "text-left")}
          title="View Lorewards accolades"
        >
          <Stat
            size="sm"
            label="Lorewards"
            icon={<Trophy aria-hidden className="text-yellow" />}
            iconPlacement="trailing"
            value={lorewards?.rank ? `#${lorewards.rank}` : "Unranked"}
            hint={
              <span>
                <span className="tabular-nums">
                  {(lorewards?.totalScore ?? 0).toLocaleString()}
                </span>{" "}
                pts
              </span>
            }
          />
        </button>
      )}

      {visibility.vaultCards && visibility.impact && (
        <button
          type="button"
          onClick={onOpenVault}
          className={cn(STAT_CELL, STAT_CELL_INTERACTIVE, "text-left")}
        >
          <Stat
            size="sm"
            label="Focus"
            icon={<Sparkles aria-hidden className="text-yellow" />}
            iconPlacement="trailing"
            value={focus.label}
            hint={<span className="block truncate">{focus.sub}</span>}
          />
        </button>
      )}

      {visibility.forumStats && (
        <div className={STAT_CELL}>
          <Stat
            size="sm"
            label="Forum"
            icon={<MessageSquare aria-hidden className="text-blue" />}
            iconPlacement="trailing"
            value={forumStats ? `${forumStats.messageCount.toLocaleString()} posts` : "—"}
            hint={
              forumStats ? (
                <span>
                  <span className="tabular-nums">{forumStats.reactionScore.toLocaleString()}</span>{" "}
                  reactions
                </span>
              ) : (
                "Not linked"
              )
            }
          />
        </div>
      )}

      {vault && (
        <Link href="/vault" className={cn(STAT_CELL, STAT_CELL_INTERACTIVE, "block")}>
          <Stat
            size="sm"
            label="IxCredits"
            icon={<IxCreditsSymbol aria-hidden className="text-yellow" />}
            iconPlacement="trailing"
            value={
              <span className="inline-flex items-center gap-1">
                <IxCreditsSymbol aria-hidden className="text-yellow size-3.5 shrink-0" />
                {vault.credits.toLocaleString()}
              </span>
            }
            hint={
              <span>
                <span className="tabular-nums">{vault.totalCards.toLocaleString()}</span> cards · Lv{" "}
                {vault.collectorLevel}
              </span>
            }
          />
        </Link>
      )}
    </div>
  );
});

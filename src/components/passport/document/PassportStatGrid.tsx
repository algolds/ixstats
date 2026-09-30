"use client";

import React from "react";
import Link from "next/link";
import { ChatBubble as MessageSquare, Spark as Sparkles, Trophy } from "iconoir-react";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { Eyebrow } from "~/components/ui/eyebrow";
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

const STAT_CELL = "bg-surface-secondary rounded-row w-full space-y-0.5 p-3";
const STAT_CELL_INTERACTIVE =
  "hover:bg-fill-3 duration-fast ease-out-facet focus-visible:outline-tint cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

/** Eyebrow data label with a trailing decorative icon. */
function StatCellHeader({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <span className="flex items-center justify-between gap-2">
      <Eyebrow>{label}</Eyebrow>
      <span aria-hidden className="text-label-secondary [&_svg]:size-3.5">
        {icon}
      </span>
    </span>
  );
}

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
          title="Click to view Lorewards Civic Accolades"
        >
          <StatCellHeader label="Lorewards" icon={<Trophy />} />
          <p className="text-label text-headline">
            {lorewards?.rank ? `#${lorewards.rank}` : "Unranked"}
          </p>
          <p className="text-label-secondary text-footnote tabular-nums">
            {lorewards?.totalScore ? `${lorewards.totalScore.toLocaleString()} pts` : "0 pts"}
          </p>
        </button>
      )}

      {visibility.vaultCards && visibility.impact && (
        <button
          type="button"
          onClick={onOpenVault}
          className={cn(STAT_CELL, STAT_CELL_INTERACTIVE, "text-left")}
        >
          <StatCellHeader label="Focus" icon={<Sparkles />} />
          <p className="text-label text-headline tabular-nums">{focus.label}</p>
          <p className="text-label-secondary text-footnote truncate">{focus.sub}</p>
        </button>
      )}

      {visibility.forumStats && (
        <div className={STAT_CELL}>
          <StatCellHeader label="Forum" icon={<MessageSquare />} />
          <p className="text-label text-headline tabular-nums">
            {forumStats ? `${forumStats.messageCount.toLocaleString()} Posts` : "—"}
          </p>
          <p className="text-label-secondary text-footnote tabular-nums">
            {forumStats ? `${forumStats.reactionScore.toLocaleString()} reactions` : "Not linked"}
          </p>
        </div>
      )}

      {vault && (
        <Link href="/vault" className={cn(STAT_CELL, STAT_CELL_INTERACTIVE, "block")}>
          <StatCellHeader label="IxCredits" icon={<IxCreditsSymbol />} />
          <p className="text-label text-headline flex items-center gap-1 tabular-nums">
            <IxCreditsSymbol aria-hidden className="size-3.5 shrink-0" />
            {vault.credits.toLocaleString()}
          </p>
          <p className="text-label-secondary text-footnote tabular-nums">
            {vault.totalCards.toLocaleString()} cards · Lv {vault.collectorLevel}
          </p>
        </Link>
      )}
    </div>
  );
});

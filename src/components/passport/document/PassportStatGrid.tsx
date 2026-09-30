"use client";

import React from "react";
import Link from "next/link";
import { ChatBubble as MessageSquare, Spark as Sparkles, Trophy } from "iconoir-react";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import type { PassportPayload, PassportVault, PassportVisibility } from "../types";

interface PassportStatGridProps {
  visibility: PassportVisibility;
  lorewards: PassportPayload["wiki"]["lorewards"];
  forum: PassportPayload["forum"];
  vault: PassportVault;
  onOpenLorewards: () => void;
  onOpenVault: () => void;
}

/** Category breadth of the newest vault cards (e.g. "3/12", "Military focus"). */
function categorySummary(vault: PassportVault): { label: string; sub: string } {
  if (vault.topCards.length === 0) return { label: "—", sub: "No categories yet" };
  const cats = vault.topCards
    .map((c) => c.category)
    .filter((x): x is string => !!x && x !== "NS_IMPORT");
  const distinct = new Set(cats).size;
  const topCat = cats[0] ?? null;
  const label = distinct ? `${distinct}/12` : "—";
  const sub = topCat ? `${topCat.charAt(0) + topCat.slice(1).toLowerCase()} focus` : "Collecting";
  return { label, sub };
}

/** Front-face stat row: Lorewards, Focus, Forum and IxCredits cells. */
export const PassportStatGrid = React.memo(function PassportStatGrid({
  visibility,
  lorewards,
  forum,
  vault,
  onOpenLorewards,
  onOpenVault,
}: PassportStatGridProps) {
  const focus = categorySummary(vault);

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {visibility.accolades && (
        <button
          type="button"
          onClick={onOpenLorewards}
          data-cuelume-press="soft"
          className="group w-full cursor-pointer space-y-0.5 rounded-xl border border-black/6 bg-black/[0.02] p-2.5 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:border-amber-500/30 hover:bg-black/[0.04] active:scale-[0.97] dark:border-white/8 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
          title="Click to view Lorewards Civic Accolades"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-stone-400 uppercase transition-colors group-hover:text-amber-500">
              Lorewards
            </span>
            <Trophy className="h-3 w-3 text-amber-500" />
          </div>
          <p className="text-foreground text-sm font-bold">
            {lorewards?.rank ? `#${lorewards.rank}` : "Unranked"}
          </p>
          <p className="font-mono text-xs text-amber-500">
            {lorewards?.totalScore ? `${lorewards.totalScore.toLocaleString()} pts` : "0 pts"}
          </p>
        </button>
      )}

      {visibility.impact && (
        <button
          type="button"
          onClick={onOpenVault}
          data-cuelume-press="soft"
          className="w-full cursor-pointer space-y-0.5 rounded-xl border border-black/6 bg-black/[0.02] p-2.5 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:bg-black/[0.04] active:scale-[0.97] dark:border-white/8 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-stone-400 uppercase">Focus</span>
            <Sparkles className="h-3 w-3 text-amber-500" />
          </div>
          <p className="text-foreground text-sm font-bold">{focus.label}</p>
          <p className="text-muted-foreground truncate font-mono text-xs">{focus.sub}</p>
        </button>
      )}

      {visibility.forumStats && (
        <div className="space-y-0.5 rounded-xl border border-black/6 bg-black/[0.02] p-2.5 dark:border-white/8 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-stone-400 uppercase">Forum</span>
            <MessageSquare className="h-3 w-3 text-blue-500" />
          </div>
          <p className="text-foreground text-sm font-bold">{forum.messageCount} Posts</p>
          <p className="text-muted-foreground font-mono text-xs">
            {forum.reactionScore} reactions
          </p>
        </div>
      )}

      {visibility.vaultCards && (
        <Link
          href="/vault"
          data-cuelume-press="soft"
          className="block cursor-pointer space-y-0.5 rounded-xl border border-black/6 bg-black/[0.02] p-2.5 transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:bg-black/[0.04] active:scale-[0.97] dark:border-white/8 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-stone-400 uppercase">IxCredits</span>
            <IxCreditsSymbol className="h-3 w-3 text-amber-500" />
          </div>
          <p className="text-foreground flex items-center gap-1 text-sm font-bold">
            <IxCreditsSymbol className="h-3 w-3 shrink-0 text-amber-500" />
            {vault.credits.toLocaleString()}
          </p>
          <p className="text-muted-foreground font-mono text-xs">
            {vault.totalCards.toLocaleString()} cards · Lv {vault.collectorLevel}
          </p>
        </Link>
      )}
    </div>
  );
});

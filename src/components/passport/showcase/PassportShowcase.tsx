"use client";

import React from "react";
import { Crown, EyeClosed, Medal, Pin, Trophy } from "iconoir-react";
import { RibbonBar } from "~/components/achievements/FloatingRibbonRack";
import { getRarityColor } from "~/components/achievements/constants";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { TooltipProvider } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import type {
  PassportAchievements,
  PassportPayload,
  PassportRibbon,
  PassportVault,
} from "../types";

const SECTION_LABEL =
  "text-muted-foreground flex items-center gap-1.5 font-mono text-xs font-bold tracking-wider uppercase";

const PANEL =
  "space-y-3 rounded-3xl border border-black/8 bg-black/[0.015] p-5 dark:border-white/10 dark:bg-white/[0.02]";

/** How many ribbons the signature shelf holds. */
export const SIGNATURE_SHELF_SIZE = 3;

/** How many achievements and cards the showcase names. */
const HIGHLIGHT_SIZE = 6;
const COLLECTION_SIZE = 3;

/** The signature shelf: the owner's pinned ribbons, or their top ribbons when none are pinned. */
export function signatureRibbons(ribbons: ReadonlyArray<PassportRibbon>): {
  ribbons: PassportRibbon[];
  pinned: boolean;
} {
  const pinned = ribbons.filter((r) => r.pinned);
  return pinned.length > 0
    ? { ribbons: pinned.slice(0, SIGNATURE_SHELF_SIZE), pinned: true }
    : { ribbons: ribbons.slice(0, SIGNATURE_SHELF_SIZE), pinned: false };
}

/** "ULTRA_RARE" → "Ultra Rare" (card rarities are stored upper-case). */
function rarityLabel(rarity: string): string {
  return rarity
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function Hidden({ what, handle, isOwner }: { what: string; handle: string; isOwner: boolean }) {
  return (
    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <EyeClosed className="h-3.5 w-3.5 shrink-0" />
      {isOwner
        ? `You hide your ${what}. Change it on the back of your passport.`
        : `@${handle} keeps their ${what} private.`}
    </p>
  );
}

function AchievementsPanel({
  achievements,
  handle,
  isOwner,
}: {
  achievements: PassportAchievements | null;
  handle: string;
  isOwner: boolean;
}) {
  if (!achievements) return <Hidden what="achievements" handle={handle} isOwner={isOwner} />;
  if (achievements.unlockedCount === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        @{handle} has not unlocked any achievements yet.
      </p>
    );
  }
  const shelf = signatureRibbons(achievements.ribbons);
  const highlights = [...achievements.ribbons]
    .filter((r) => !shelf.ribbons.includes(r))
    .slice(0, HIGHLIGHT_SIZE - shelf.ribbons.length);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-4">
        <p className="text-muted-foreground font-mono text-xs">
          {achievements.unlockedCount.toLocaleString()}
          {achievements.totalCount ? ` / ${achievements.totalCount.toLocaleString()}` : ""} unlocked
          · {achievements.points.toLocaleString()} pts
        </p>

        <div className="space-y-2">
          <span className="text-muted-foreground flex items-center gap-1 font-mono text-xs uppercase">
            {shelf.pinned && <Pin className="h-3 w-3" />}
            {shelf.pinned ? "Signature ribbons" : "Top ribbons"}
          </span>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {shelf.ribbons.map((ribbon) => (
              <li
                key={ribbon.key}
                className="flex items-center gap-2.5 rounded-2xl border border-black/6 bg-black/[0.02] p-2.5 dark:border-white/8 dark:bg-white/[0.02]"
              >
                <RibbonBar ribbon={ribbon} size="md" />
                <div className="min-w-0">
                  <p className="text-foreground truncate text-xs font-semibold">{ribbon.title}</p>
                  <p className={cn("font-mono text-xs", getRarityColor(ribbon.rarity))}>
                    {ribbon.rarity}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <span className="text-muted-foreground block font-mono text-xs uppercase">
            Ribbon rack · {achievements.ribbons.length}
          </span>
          <div className="flex flex-wrap gap-1.5" data-testid="passport-ribbon-shelf">
            {achievements.ribbons.map((ribbon) => (
              <RibbonBar key={ribbon.key} ribbon={ribbon} />
            ))}
          </div>
        </div>

        {highlights.length > 0 && (
          <ul className="divide-y divide-black/6 dark:divide-white/8">
            {highlights.map((ribbon) => (
              <li key={ribbon.key} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-foreground truncate text-xs font-semibold">{ribbon.title}</p>
                  <p className="text-muted-foreground truncate text-xs">{ribbon.category}</p>
                </div>
                <span className={cn("shrink-0 font-mono text-xs", getRarityColor(ribbon.rarity))}>
                  {ribbon.rarity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </TooltipProvider>
  );
}

function CollectionPanel({
  vault,
  handle,
  isOwner,
  onOpenVault,
}: {
  vault: PassportVault | null;
  handle: string;
  isOwner: boolean;
  onOpenVault?: () => void;
}) {
  if (!vault) return <Hidden what="collection" handle={handle} isOwner={isOwner} />;
  const cards = vault.topCards.slice(0, COLLECTION_SIZE);
  if (cards.length === 0) {
    return <p className="text-muted-foreground text-xs">@{handle} has no IxCards yet.</p>;
  }
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-black/6 dark:divide-white/8">
        {cards.map((card) => (
          <li
            key={card.ownershipId ?? card.id}
            className="flex items-center justify-between gap-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-foreground truncate text-xs font-semibold">{card.title}</p>
              <p className={cn("font-mono text-xs", getRarityColor(rarityLabel(card.rarity)))}>
                {rarityLabel(card.rarity)}
              </p>
            </div>
            <span className="text-foreground flex shrink-0 items-center gap-1 font-mono text-xs font-bold">
              <IxCreditsSymbol className="h-3 w-3 text-amber-500" />
              {card.marketValue.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
      {onOpenVault && (
        <button
          type="button"
          onClick={onOpenVault}
          data-cuelume-press="soft"
          className="cursor-pointer font-mono text-xs text-amber-600 hover:underline dark:text-amber-400"
        >
          View all {vault.totalCards.toLocaleString()} cards
        </button>
      )}
    </div>
  );
}

function LorewardsPanel({
  data,
  handle,
  isOwner,
}: {
  data: PassportPayload;
  handle: string;
  isOwner: boolean;
}) {
  if (!data.privacy.accolades) return <Hidden what="Lorewards" handle={handle} isOwner={isOwner} />;
  const lore = data.wiki.lorewards;
  if (!lore || lore.totalScore <= 0) {
    return <p className="text-muted-foreground text-xs">No Lorewards score yet.</p>;
  }
  const laurels = lore.dailyWins + lore.weeklyWins + lore.monthlyWins;
  return (
    <dl className="grid grid-cols-2 gap-2 font-mono text-xs">
      <div>
        <dt className="text-muted-foreground uppercase">Rank</dt>
        <dd className="text-foreground text-sm font-bold">{lore.rank ? `#${lore.rank}` : "—"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground uppercase">Score</dt>
        <dd className="text-foreground text-sm font-bold">{lore.totalScore.toLocaleString()}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground uppercase">Laurels</dt>
        <dd className="text-foreground text-sm font-bold">{laurels.toLocaleString()}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground uppercase">Best streak</dt>
        <dd className="text-foreground text-sm font-bold">{lore.longestStreak}d</dd>
      </div>
    </dl>
  );
}

interface PassportShowcaseProps {
  data: PassportPayload;
  cleanUsername: string;
  onOpenVault?: () => void;
}

/**
 * Passport showcase: unlocked achievements with the signature shelf and ribbon rack, the collection
 * highlight (most valuable cards) and Lorewards standing. Real data only; each panel has an empty
 * state and a "kept private" state for sections the owner hides.
 */
export const PassportShowcase = React.memo(function PassportShowcase({
  data,
  cleanUsername,
  onOpenVault,
}: PassportShowcaseProps) {
  const isOwner = data.account.isOwner;
  return (
    <section className="space-y-3" aria-label="Showcase">
      <h2 className={SECTION_LABEL}>
        <Medal className="h-3.5 w-3.5 text-amber-500" />
        <span>Showcase</span>
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className={cn(PANEL, "lg:col-span-3")}>
          <h3 className={SECTION_LABEL}>
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <span>Achievements & Ribbons</span>
          </h3>
          <AchievementsPanel
            achievements={data.showcase.achievements}
            handle={cleanUsername}
            isOwner={isOwner}
          />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <div className={PANEL}>
            <h3 className={SECTION_LABEL}>
              <Crown className="h-3.5 w-3.5 text-amber-500" />
              <span>Collection Highlight</span>
            </h3>
            <CollectionPanel
              vault={data.vault}
              handle={cleanUsername}
              isOwner={isOwner}
              onOpenVault={onOpenVault}
            />
          </div>
          <div className={PANEL}>
            <h3 className={SECTION_LABEL}>
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              <span>Lorewards Standing</span>
            </h3>
            <LorewardsPanel data={data} handle={cleanUsername} isOwner={isOwner} />
          </div>
        </div>
      </div>
    </section>
  );
});

"use client";

import React from "react";
import { Crown, EyeClosed, Medal, Pin, Trophy } from "iconoir-react";
import { RibbonBar } from "~/components/achievements/FloatingRibbonRack";
import { getRarityColor } from "~/components/achievements/constants";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { TooltipProvider } from "~/components/ui/tooltip";
import { Button } from "~/components/ui/button";
import { Stat } from "~/components/ui/stat";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import type {
  PassportAchievements,
  PassportPayload,
  PassportRibbon,
  PassportVault,
} from "../types";

/** Section header (sentence-case `text-subhead`). */
const SECTION_LABEL = "text-subhead text-label-secondary flex items-center gap-2";

/** An inset panel inside the passport card. */

/** Section icon, decorative. */
const SECTION_ICON = "size-4 shrink-0";

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
    <p className="text-label-secondary text-footnote flex items-center gap-2">
      <EyeClosed aria-hidden className="size-3.5 shrink-0" />
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
      <p className="text-label-secondary text-footnote">
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
        <p className="text-label-secondary text-footnote tabular-nums">
          {achievements.unlockedCount.toLocaleString()}
          {achievements.totalCount ? ` / ${achievements.totalCount.toLocaleString()}` : ""} unlocked
          · {achievements.points.toLocaleString()} pts
        </p>

        <div className="space-y-2">
          <h4 className="text-footnote text-label-secondary flex items-center gap-1 font-medium">
            {shelf.pinned && <Pin aria-hidden className="size-3.5" />}
            {shelf.pinned ? "Signature ribbons" : "Top ribbons"}
          </h4>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {shelf.ribbons.map((ribbon) => (
              <li key={ribbon.key} className="bg-surface rounded-row flex items-center gap-2 p-2">
                <RibbonBar ribbon={ribbon} size="md" />
                <div className="min-w-0">
                  <p className="text-label text-headline truncate">{ribbon.title}</p>
                  <p className={cn("text-footnote", getRarityColor(ribbon.rarity))}>
                    {ribbon.rarity}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="text-footnote text-label-secondary font-medium">
            Ribbon rack · <span className="tabular-nums">{achievements.ribbons.length}</span>
          </h4>
          <div className="flex flex-wrap gap-2" data-testid="passport-ribbon-shelf">
            {achievements.ribbons.map((ribbon) => (
              <RibbonBar key={ribbon.key} ribbon={ribbon} />
            ))}
          </div>
        </div>

        {highlights.length > 0 && (
          <ul className="divide-separator divide-y">
            {highlights.map((ribbon) => (
              <li key={ribbon.key} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-label text-headline truncate">{ribbon.title}</p>
                  <p className="text-label-secondary text-footnote truncate">{ribbon.category}</p>
                </div>
                <span className={cn("text-footnote shrink-0", getRarityColor(ribbon.rarity))}>
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
    return <p className="text-label-secondary text-footnote">@{handle} has no IxCards yet.</p>;
  }
  return (
    <div className="space-y-2">
      <ul className="divide-separator divide-y">
        {cards.map((card) => (
          <li
            key={card.ownershipId ?? card.id}
            className="flex items-center justify-between gap-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-label text-headline truncate">{card.title}</p>
              <p className={cn("text-footnote", getRarityColor(rarityLabel(card.rarity)))}>
                {rarityLabel(card.rarity)}
              </p>
            </div>
            <span className="text-label text-headline flex shrink-0 items-center gap-1 tabular-nums">
              <IxCreditsSymbol aria-hidden className="text-label-secondary size-3.5" />
              {card.marketValue.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
      {onOpenVault && (
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onOpenVault}
          className="h-auto px-0"
        >
          View all {vault.totalCards.toLocaleString()} cards
        </Button>
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
    return <p className="text-label-secondary text-footnote">No Lorewards score yet.</p>;
  }
  const laurels = lore.dailyWins + lore.weeklyWins + lore.monthlyWins;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Stat size="sm" label="Rank" value={lore.rank ? `#${lore.rank}` : "—"} />
      <Stat size="sm" label="Score" value={lore.totalScore.toLocaleString()} />
      <Stat size="sm" label="Laurels" value={laurels.toLocaleString()} />
      <Stat size="sm" label="Best streak" value={`${lore.longestStreak}d`} />
    </div>
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
        <Medal aria-hidden className={SECTION_ICON} />
        <span>Showcase</span>
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <FacetCard variant="inset" className="space-y-3 lg:col-span-3">
          <h3 className={SECTION_LABEL}>
            <Trophy aria-hidden className={SECTION_ICON} />
            <span>Achievements and ribbons</span>
          </h3>
          <AchievementsPanel
            achievements={data.showcase.achievements}
            handle={cleanUsername}
            isOwner={isOwner}
          />
        </FacetCard>
        <div className="space-y-4 lg:col-span-2">
          <FacetCard variant="inset" className="space-y-3">
            <h3 className={SECTION_LABEL}>
              <Crown aria-hidden className={SECTION_ICON} />
              <span>Collection highlight</span>
            </h3>
            <CollectionPanel
              vault={data.vault}
              handle={cleanUsername}
              isOwner={isOwner}
              onOpenVault={onOpenVault}
            />
          </FacetCard>
          <FacetCard variant="inset" className="space-y-3">
            <h3 className={SECTION_LABEL}>
              <Trophy aria-hidden className={SECTION_ICON} />
              <span>Lorewards standing</span>
            </h3>
            <LorewardsPanel data={data} handle={cleanUsername} isOwner={isOwner} />
          </FacetCard>
        </div>
      </div>
    </section>
  );
});

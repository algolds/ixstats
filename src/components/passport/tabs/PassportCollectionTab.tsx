"use client";

import React, { useState } from "react";
import { useReducedMotion } from "motion/react";
import { EyeClosed, Pin, Trophy, ViewGrid } from "iconoir-react";
import { RibbonBar } from "~/components/achievements/FloatingRibbonRack";
import { getRarityColor } from "~/components/achievements/constants";
import { CardDisplay } from "~/components/cards/display/CardDisplay";
import { CardDetailsModal } from "~/components/cards/display/CardDetailsModal";
import { Progress } from "~/components/ui/progress";
import { Stat } from "~/components/ui/stat";
import { TooltipProvider } from "~/components/ui/tooltip";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { cn } from "~/lib/utils";
import type { CardInstance } from "~/types/cards-display";
import type { PassportAchievements, PassportRibbon, PassportVault } from "../types";

/** How many ribbons the signature shelf holds. */
const SIGNATURE_SHELF_SIZE = 3;

/** How many of the most valuable cards the tab shows. */
const TOP_CARDS_SIZE = 6;

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

/** "MILITARY" → "Military focus" (card categories are stored upper-case). */
function focusLabel(category: string): string {
  const words = category.toLowerCase().replace(/_/g, " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} focus`;
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="text-headline border-separator flex items-center gap-2 border-b pb-2">
      <span aria-hidden className="text-tint inline-flex shrink-0 [&_svg]:size-4">
        {icon}
      </span>
      {children}
    </h3>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-label-secondary text-footnote">{children}</p>;
}

function PrivateNote({
  what,
  handle,
  isOwner,
}: {
  what: string;
  handle: string;
  isOwner: boolean;
}) {
  return (
    <p className="text-label-secondary text-footnote flex items-center gap-2">
      <EyeClosed aria-hidden className="size-3.5 shrink-0" />
      {isOwner
        ? `You hide your ${what}. Change it on the back of your passport.`
        : `@${handle} keeps their ${what} private.`}
    </p>
  );
}

/** Collector level, deck value, IxCredits balance and Focus. */
function CollectorStats({ vault }: { vault: PassportVault }) {
  const { totalCards, deckValue, collectorLevel: level, collectorXp: xp, xpPerLevel } = vault;
  const nextLevelXp = level * xpPerLevel;
  const xpPct = Math.min(100, Math.round((xp / nextLevelXp) * 100));
  const focus = vault.focus;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5 tabular-nums sm:grid-cols-4">
      <div className="space-y-2">
        <Stat
          size="sm"
          label="Collector level"
          value={`Lv ${level}`}
          hint={`${xp.toLocaleString()} / ${nextLevelXp.toLocaleString()} XP`}
        />
        <Progress value={xpPct} aria-label="Progress to next collector level" className="h-1" />
      </div>
      <Stat
        size="sm"
        label="Deck value"
        value={deckValue.toLocaleString()}
        hint={`${totalCards.toLocaleString()} ${totalCards === 1 ? "card" : "cards"} at market value`}
      />
      <Stat
        size="sm"
        label="IxCredits"
        value={
          <span className="inline-flex items-center gap-1">
            <IxCreditsSymbol decorative className="text-label-secondary size-[0.8em]" />
            {vault.credits.toLocaleString()}
          </span>
        }
      />
      {focus && (
        <Stat
          size="sm"
          label="Focus"
          value={`${focus.categoryCount}/${focus.categoryTotal}`}
          hint={focus.topCategory ? focusLabel(focus.topCategory) : "No lore categories yet"}
        />
      )}
    </div>
  );
}

function TopCards({ vault, handle }: { vault: PassportVault; handle: string }) {
  const [selectedCard, setSelectedCard] = useState<CardInstance | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const topCards = vault.topCards.slice(0, TOP_CARDS_SIZE);

  if (vault.totalCards === 0) return <Note>@{handle} has not collected any IxCards yet.</Note>;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {topCards.map((card) => (
          <CardDisplay
            key={`${card.id}-${card.ownershipId ?? ""}`}
            card={card}
            size="small"
            enable3D={!shouldReduceMotion}
            performanceMode={!!shouldReduceMotion}
            hideStats
            hideExcerpt={false}
            onClick={setSelectedCard}
            className="w-full will-change-transform"
          />
        ))}
      </div>
      <CardDetailsModal
        card={selectedCard}
        open={selectedCard !== null}
        onClose={() => setSelectedCard(null)}
      />
    </>
  );
}

function Achievements({
  achievements,
  handle,
}: {
  achievements: PassportAchievements;
  handle: string;
}) {
  if (achievements.unlockedCount === 0) {
    return <Note>@{handle} has not unlocked any achievements yet.</Note>;
  }
  const shelf = signatureRibbons(achievements.ribbons);
  const total = achievements.totalCount ? ` / ${achievements.totalCount.toLocaleString()}` : "";

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-5">
        <p className="text-label-secondary text-footnote tabular-nums">
          {`${achievements.unlockedCount.toLocaleString()}${total} unlocked · ${achievements.points.toLocaleString()} pts`}
        </p>

        <div className="space-y-3">
          <h4 className="text-footnote text-label-secondary flex items-center gap-1 font-medium">
            {shelf.pinned && <Pin aria-hidden className="size-3.5" />}
            {shelf.pinned ? "Signature ribbons" : "Top ribbons"}
          </h4>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {shelf.ribbons.map((ribbon) => (
              <li key={ribbon.key} className="flex min-w-0 items-center gap-3">
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

        <div className="space-y-3">
          <h4 className="text-footnote text-label-secondary font-medium">
            Ribbon rack · <span className="tabular-nums">{achievements.ribbons.length}</span>
          </h4>
          <div className="flex flex-wrap gap-2" data-testid="passport-ribbon-shelf">
            {achievements.ribbons.map((ribbon) => (
              <RibbonBar key={ribbon.key} ribbon={ribbon} />
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

interface PassportCollectionTabProps {
  /** Null when the owner hides their collection. */
  vault: PassportVault | null;
  /** Null when the owner hides their achievements. */
  achievements: PassportAchievements | null;
  handle: string;
  isOwner: boolean;
}

/**
 * The holder's IxVault collection and achievements: collector stats, the most valuable cards, and
 * the ribbon shelf. No links out: there is no public vault page for another holder.
 */
export const PassportCollectionTab = React.memo(function PassportCollectionTab({
  vault,
  achievements,
  handle,
  isOwner,
}: PassportCollectionTabProps) {
  return (
    <div className="space-y-8">
      {vault ? (
        <>
          <CollectorStats vault={vault} />
          <section className="space-y-4">
            <SectionTitle icon={<ViewGrid />}>Top cards</SectionTitle>
            <TopCards vault={vault} handle={handle} />
          </section>
        </>
      ) : (
        <PrivateNote what="collection" handle={handle} isOwner={isOwner} />
      )}

      <section className="space-y-4">
        <SectionTitle icon={<Trophy />}>Achievements</SectionTitle>
        {achievements ? (
          <Achievements achievements={achievements} handle={handle} />
        ) : (
          <PrivateNote what="achievements" handle={handle} isOwner={isOwner} />
        )}
      </section>
    </div>
  );
});

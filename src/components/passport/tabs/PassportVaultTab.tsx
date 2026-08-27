"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Crown, ArrowRight, Trophy, Dollar as Coins } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { CardDisplay } from "~/components/cards/display/CardDisplay";
import { CardDetailsModal } from "~/components/cards/display/CardDetailsModal";
import type { CardInstance } from "~/types/cards-display";
import type { PassportVault, UnifiedProfilePayload } from "../types";

interface PassportVaultTabProps {
  vault: PassportVault | null | undefined;
  cleanUsername: string;
  data?: UnifiedProfilePayload | null;
}

function formatDeckValue(n: number): string {
  if (!n) return "—";
  return n.toLocaleString();
}

export const PassportVaultTab = React.memo(function PassportVaultTab({
  vault,
  cleanUsername,
}: PassportVaultTabProps) {
  const totalCards = vault?.totalCards ?? 0;
  const deckValue = vault?.deckValue ?? 0;
  const level = vault?.collectorLevel ?? 1;
  const xp = vault?.collectorXp ?? 0;
  const nextLevelXp = level * 1000;
  const xpPct = Math.min(100, Math.round((xp / nextLevelXp) * 100));
  const [selectedCard, setSelectedCard] = useState<CardInstance | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const handleCardClick = (card: CardInstance) => {
    setSelectedCard(card);
    setIsModalOpen(true);
  };

  if (!vault || totalCards === 0) {
    return (
      <div className="space-y-3 rounded-3xl border border-black/8 bg-black/[0.015] p-10 text-center dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-500">
          <Crown className="h-6 w-6" />
        </div>
        <h3 className="text-foreground text-base font-bold">No Vault Collection</h3>
        <p className="text-muted-foreground mx-auto max-w-md text-xs">
          @{cleanUsername} hasn&apos;t started collecting IxCards yet.
        </p>
        <Link
          href="/vault"
          data-cuelume-press="soft"
          className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-purple-700 active:scale-[0.97]"
        >
          <span>Explore Vault</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  const rawTopCards = (vault as any)?.topCards as Array<any> | undefined;
  // Live-wire: normalize to CardInstance for 3D rendering
  const topCards: CardInstance[] = (rawTopCards ?? [])
    .map((c) => (c.card ?? c) as CardInstance)
    .filter(Boolean)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs font-bold tracking-wider uppercase">
          <Crown className="h-3.5 w-3.5 text-purple-500" />
          <span>VAULT COLLECTION</span>
        </h2>
        <Link
          href="/vault"
          data-cuelume-press="soft"
          className="flex items-center gap-0.5 font-mono text-[11px] text-purple-600 hover:underline dark:text-purple-400"
        >
          <span>Open Vault</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        <FacetCard
          depth={1}
          className="space-y-2 rounded-2xl border border-black/8 bg-black/[0.02] p-3.5 dark:border-white/10 dark:bg-white/[0.02]"
        >
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-mono text-[9px] font-bold tracking-wider uppercase">
              Collector Level
            </span>
            <Trophy className="text-muted-foreground h-3.5 w-3.5" />
          </div>
          <p className="text-foreground text-lg leading-none font-bold tracking-tight">
            Lv. {level}
          </p>
          <div className="space-y-1">
            <div className="h-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <motion.div
                className="bg-foreground h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${xpPct}%` }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0.2 }
                    : { type: "spring", bounce: 0, duration: 0.4 }
                }
                style={{ willChange: "width" }}
              />
            </div>
            <p className="text-muted-foreground font-mono text-[9px]">
              {xp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
            </p>
          </div>
        </FacetCard>

        <FacetCard
          depth={1}
          className="space-y-2 rounded-2xl border border-black/8 bg-black/[0.02] p-3.5 dark:border-white/10 dark:bg-white/[0.02]"
        >
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-mono text-[9px] font-bold tracking-wider uppercase">
              Deck Value
            </span>
            <Coins className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="text-lg leading-none font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatDeckValue(deckValue)}
          </p>
        </FacetCard>
      </div>

      {topCards.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-muted-foreground font-mono text-[10px] font-bold tracking-wider uppercase">
            Featured Deck · Top {topCards.length}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {topCards.map((card) => (
              <CardDisplay
                key={`${card.id}-${(card as any).ownershipId ?? ""}`}
                card={card}
                size="small"
                enable3D={!shouldReduceMotion}
                performanceMode={!!shouldReduceMotion}
                hideStats
                hideExcerpt={false}
                onClick={handleCardClick}
                className="w-full will-change-transform"
              />
            ))}
          </div>
        </div>
      )}

      <CardDetailsModal
        card={selectedCard}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
});

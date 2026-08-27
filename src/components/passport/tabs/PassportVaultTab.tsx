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

export const PassportVaultTab = React.memo(function PassportVaultTab({ vault, cleanUsername }: PassportVaultTabProps) {
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
      <div className="rounded-3xl border border-black/8 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] p-10 text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
          <Crown className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">No Vault Collection</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          @{cleanUsername} hasn&apos;t started collecting IxCards yet.
        </p>
        <Link
          href="/vault"
          data-cuelume-press="soft"
          className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 text-white px-4 py-2 text-xs font-semibold shadow-sm hover:bg-purple-700 active:scale-[0.97] transition-all"
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
        <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Crown className="h-3.5 w-3.5 text-purple-500" />
          <span>VAULT COLLECTION</span>
        </h2>
        <Link
          href="/vault"
          data-cuelume-press="soft"
          className="font-mono text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5"
        >
          <span>Open Vault</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <FacetCard depth={1} className="rounded-2xl border border-black/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Collector Level</span>
            <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-lg font-bold tracking-tight text-foreground leading-none">Lv. {level}</p>
          <div className="space-y-1">
            <div className="h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <motion.div
                className="h-full bg-foreground rounded-full"
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
            <p className="font-mono text-[9px] text-muted-foreground">{xp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP</p>
          </div>
        </FacetCard>

        <FacetCard depth={1} className="rounded-2xl border border-black/8 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Deck Value</span>
            <Coins className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400 leading-none">{formatDeckValue(deckValue)}</p>
        </FacetCard>
      </div>

      {topCards.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Featured Deck · Top {topCards.length}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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



      <CardDetailsModal card={selectedCard} open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
});

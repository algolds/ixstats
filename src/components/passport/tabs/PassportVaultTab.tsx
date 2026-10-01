"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { Crown, ArrowRight, Trophy, Dollar as Coins } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetCard } from "~/components/ui/facet-container";
import { Progress } from "~/components/ui/progress";
import { Stat } from "~/components/ui/stat";
import { CardDisplay } from "~/components/cards/display/CardDisplay";
import { CardDetailsModal } from "~/components/cards/display/CardDetailsModal";
import type { CardInstance } from "~/types/cards-display";
import type { PassportVault } from "../types";

interface PassportVaultTabProps {
  vault: PassportVault;
  cleanUsername: string;
}

function formatDeckValue(n: number): string {
  if (!n) return "—";
  return n.toLocaleString();
}

export const PassportVaultTab = React.memo(function PassportVaultTab({
  vault,
  cleanUsername,
}: PassportVaultTabProps) {
  const { totalCards, deckValue, collectorLevel: level, collectorXp: xp } = vault;
  const nextLevelXp = level * 1000;
  const xpPct = Math.min(100, Math.round((xp / nextLevelXp) * 100));
  const [selectedCard, setSelectedCard] = useState<CardInstance | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const handleCardClick = (card: CardInstance) => {
    setSelectedCard(card);
    setIsModalOpen(true);
  };

  if (totalCards === 0) {
    return (
      <FacetCard variant="inset" padding="none" className="border-separator border">
        <EmptyState
          icon={<Crown />}
          title="No Vault Collection"
          message={`@${cleanUsername} hasn't started collecting IxCards yet.`}
          action={
            <Button asChild variant="tinted" size="sm">
              <Link href="/vault">
                <span>Explore Vault</span>
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          }
        />
      </FacetCard>
    );
  }

  const topCards = vault.topCards.slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-subhead text-label-secondary flex items-center gap-2">
          <Crown aria-hidden className="size-4" />
          <span>Vault collection</span>
        </h2>
        <Link
          href="/vault"
          className="text-tint text-footnote flex items-center gap-0.5 hover:underline"
        >
          <span>Open Vault</span>
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <FacetCard variant="inset" className="space-y-2">
          <Stat
            label="Collector level"
            value={`Lv. ${level}`}
            icon={<Trophy />}
            iconPlacement="trailing"
          />
          <div className="space-y-1">
            <Progress value={xpPct} aria-label="Progress to next collector level" className="h-1" />
            <p className="text-label-secondary text-footnote tabular-nums">
              {xp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
            </p>
          </div>
        </FacetCard>

        <FacetCard variant="inset">
          <Stat
            label="Deck value"
            value={formatDeckValue(deckValue)}
            icon={<Coins />}
            iconPlacement="trailing"
          />
        </FacetCard>
      </div>

      {topCards.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-subhead text-label-secondary">
            Featured deck · Top <span className="tabular-nums">{topCards.length}</span>
          </h3>
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

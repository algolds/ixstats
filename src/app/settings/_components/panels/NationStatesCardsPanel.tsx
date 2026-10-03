"use client";

import { Button } from "~/components/ui/button";
import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  RefreshDouble as RefreshCw,
  Search,
  ShieldAlert,
  OpenNewWindow as ExternalLink,
  Eye,
  Crown as Gem,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { SettingsHeader } from "../SettingsHeader";
import { SettingsGroup, SettingsRow } from "../primitives";
import { soundEffects } from "~/lib/sound/cuelume";
import { cn } from "~/lib/utils";
import { NationStatesLogo } from "~/components/cards/display/NationStatesLogo";
import { CardDetailsModal } from "~/components/cards/display/CardDetailsModal";
import type { CardInstance } from "~/types/cards-display";
import { NSTakedownModal } from "../modals/NSTakedownModal";
import { Input } from "~/components/ui/input";

export function NationStatesCardsPanel() {
  const notify = useNotify();
  const utils = api.useUtils();

  const [searchQuery, setSearchQuery] = useState("");
  const [showTakedownModal, setShowTakedownModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardInstance | null>(null);

  // Queries
  const {
    data: nsCardsData,
    isLoading: cardsLoading,
    isRefetching,
  } = api.nsImport.getMyNSCards.useQuery(undefined, { refetchOnWindowFocus: false });

  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const handleRefresh = async () => {
    soundEffects.press();
    await utils.nsImport.getMyNSCards.invalidate();
    notify.success("Deck synced with NationStates");
  };

  const cards = nsCardsData?.cards ?? [];

  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return cards;
    const query = searchQuery.toLowerCase().trim();
    return cards.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        String(c.nsCardId).includes(query) ||
        `s${c.nsSeason}`.toLowerCase().includes(query)
    );
    // oxlint-disable-next-line
  }, [cards, searchQuery]);

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="NationStates cards"
        category="Vault"
        description={
          cardsLoading
            ? "Syncing your NationStates cards..."
            : `${cards.length} ${cards.length === 1 ? "trading card" : "trading cards"} imported from your NationStates deck.`
        }
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/vault" data-cuelume-press="soft">
                <span>Open Vault</span>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/vault/ns-deck" data-cuelume-press="soft">
                <NationStatesLogo size="xs" className="h-3 w-auto" />
                <span>Import deck</span>
              </Link>
            </Button>
            <Button
              type="button"
              onClick={handleRefresh}
              disabled={isRefetching}
              data-cuelume-press="soft"
              title="Sync deck with server"
              variant="secondary"
              size="icon-sm"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
            </Button>
          </div>
        }
      />

      {/* NationStates API disclaimer */}
      <div className="border-separator bg-surface text-muted-foreground rounded-card flex items-start gap-2.5 border p-3 text-xs leading-relaxed">
        <NationStatesLogo size="xs" className="mt-0.5 shrink-0 opacity-80" />
        <p className="min-w-0 flex-1">
          Card data comes from the official{" "}
          <a
            href="https://www.nationstates.net/pages/api.html#cards"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-primary font-medium underline underline-offset-2 transition-colors"
          >
            NationStates API
          </a>
          . IxStats is not affiliated with or endorsed by NationStates. Card artwork, flags and
          emblems remain the copyright of their authors.
        </p>
      </div>

      {/* Imported cards */}
      <SettingsGroup>
        {cardsLoading ? (
          <div className="text-muted-foreground p-8 text-center text-xs">Loading your cards...</div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Gem className="text-muted-foreground/40 mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-xs font-semibold">No cards imported yet</p>
            <p className="text-muted-foreground/70 mt-0.5 max-w-sm text-xs">
              Connect your NationStates nation to import your season cards and show them on your
              profile.
            </p>
            <Button asChild variant="default" size="sm">
              <Link href="/vault/ns-deck" data-cuelume-press="soft">
                <NationStatesLogo size="xs" />
                <span>Import your NationStates deck</span>
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by nation name, ID or season"
                className="bg-muted/20 border-border/60 h-8 pl-8 text-xs font-medium"
              />
            </div>

            {filteredCards.length === 0 ? (
              <div className="text-muted-foreground p-6 text-center text-xs">
                No cards match &quot;{searchQuery}&quot;
              </div>
            ) : (
              <div className="grid max-h-[460px] grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
                {filteredCards.map((card) => (
                  <div
                    key={card.cardId}
                    className="border-separator bg-surface-secondary rounded-row flex items-center justify-between gap-3 border p-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="border-border/60 bg-muted/60 relative flex h-9 w-12 shrink-0 overflow-hidden rounded-lg border shadow-2xs">
                        {card.imageUrl ? (
                          <img
                            src={card.imageUrl}
                            alt={card.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <NationStatesLogo size="xs" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-foreground truncate text-xs font-bold">{card.title}</p>
                        <p className="text-muted-foreground text-xs">
                          Card #{card.nsCardId} · S{card.nsSeason}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {card.isHidden ? (
                        <span className="border-border/60 bg-muted/40 text-muted-foreground rounded-md border px-1.5 py-0.5 text-xs font-bold">
                          Hidden
                        </span>
                      ) : (
                        <span className="border-border/60 bg-muted/60 text-foreground rounded-md border px-1.5 py-0.5 text-xs font-bold">
                          Active
                        </span>
                      )}
                      <Button
                        type="button"
                        onClick={() => {
                          soundEffects.press();
                          setSelectedCard(card as unknown as CardInstance);
                        }}
                        data-cuelume-press="soft"
                        variant="secondary"
                        size="sm"
                      >
                        <Eye className="text-muted-foreground h-3 w-3" />
                        <span>View</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SettingsGroup>

      {/* Takedown */}
      <SettingsGroup
        title="Card removal and opt-out"
        description="Disconnect deck sync or request removal of your cards from search."
      >
        <SettingsRow
          label="Takedown and disconnect"
          description="Request removal of your NationStates card data or unlink your deck"
          icon={ShieldAlert}
          glyphClass="bg-muted/60 text-foreground"
        >
          <Button
            type="button"
            onClick={() => {
              soundEffects.press();
              setShowTakedownModal(true);
            }}
            data-cuelume-press="soft"
            variant="secondary"
            size="sm"
            className="hover:text-destructive"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Takedown and opt-out</span>
          </Button>
        </SettingsRow>
      </SettingsGroup>

      <CardDetailsModal
        card={selectedCard}
        open={Boolean(selectedCard)}
        onClose={() => setSelectedCard(null)}
      />

      <NSTakedownModal
        isOpen={showTakedownModal}
        onClose={() => setShowTakedownModal(false)}
        defaultNationName={userProfile?.country?.name ?? ""}
      />
    </div>
  );
}

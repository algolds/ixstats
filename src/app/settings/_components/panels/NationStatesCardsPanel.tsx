"use client";

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
    notify.success("Trading card deck synchronized with NationStates");
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
        title="NationStates Cards"
        category="Vault"
        description={
          cardsLoading
            ? "Syncing trading cards imported from NationStates..."
            : `${cards.length} ${cards.length === 1 ? "trading card" : "trading cards"} imported from your NationStates deck. Search, filter, preview, or take down cards.`
        }
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/vault"
              data-cuelume-press="soft"
              className="facet-interactive border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]"
            >
              <span>Full Vault</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Link>
            <Link
              href="/vault/ns-deck"
              data-cuelume-press="soft"
              className="facet-interactive border-border/60 bg-secondary/80 text-foreground hover:bg-secondary flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]"
            >
              <NationStatesLogo size="xs" className="h-3 w-auto" />
              <span>Import Deck</span>
            </Link>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefetching}
              data-cuelume-press="soft"
              title="Sync deck with server"
              className="facet-interactive border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground flex h-8 w-8 items-center justify-center rounded-xl border transition-all active:scale-[0.97] disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
            </button>
          </div>
        }
      />

      {/* NationStates API & Trademark Disclaimer */}
      <div className="border-border/40 bg-card/30 text-muted-foreground flex items-start gap-2.5 rounded-2xl border p-3 text-[11px] leading-relaxed backdrop-blur-md">
        <NationStatesLogo size="xs" className="mt-0.5 shrink-0 opacity-80" />
        <p className="min-w-0 flex-1">
          Trading card data is retrieved via the official{" "}
          <a
            href="https://www.nationstates.net/pages/api.html#cards"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-primary font-medium underline underline-offset-2 transition-colors"
          >
            NationStates API
          </a>
          . Not affiliated with or endorsed by NationStates. All card artwork, nation flags, and
          emblems remain the copyright of their respective authors.
        </p>
      </div>

      {/* Imported Cards Grid & Browser */}
      <SettingsGroup>
        {cardsLoading ? (
          <div className="text-muted-foreground p-8 text-center text-xs">
            Loading trading card deck...
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Gem className="text-muted-foreground/40 mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-xs font-semibold">No cards imported yet</p>
            <p className="text-muted-foreground/70 mt-0.5 max-w-sm text-[11px]">
              Connect your NationStates nation to import your season trading cards and showcase them
              on your profile.
            </p>
            <Link
              href="/vault/ns-deck"
              data-cuelume-press="soft"
              className="facet-interactive bg-foreground text-background hover:bg-foreground/90 mt-3.5 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold active:scale-[0.98]"
            >
              <NationStatesLogo size="xs" />
              <span>Import Your NS Deck</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {/* Search Input Bar */}
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cards by nation name, ID, or season..."
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
                    className="border-border/50 bg-card/60 hover:bg-card/90 hover:border-border flex items-center justify-between gap-3 rounded-xl border p-2.5 shadow-2xs transition-all"
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
                        <p className="text-muted-foreground text-[10px]">
                          Card #{card.nsCardId} · S{card.nsSeason}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {card.isHidden ? (
                        <span className="border-border/60 bg-muted/40 text-muted-foreground rounded-md border px-1.5 py-0.5 text-[9px] font-bold">
                          Hidden
                        </span>
                      ) : (
                        <span className="border-border/60 bg-muted/60 text-foreground rounded-md border px-1.5 py-0.5 text-[9px] font-bold">
                          Active
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          soundEffects.press();
                          setSelectedCard(card as unknown as CardInstance);
                        }}
                        data-cuelume-press="soft"
                        className="facet-interactive border-border/60 bg-secondary/80 text-foreground hover:bg-secondary flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-semibold active:scale-[0.98]"
                      >
                        <Eye className="text-muted-foreground h-3 w-3" />
                        <span>View</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SettingsGroup>

      {/* Sovereignty & Takedown */}
      <SettingsGroup
        title="Card Removal & Opt-Out"
        description="Disconnect deck sync or submit takedown requests to permanently remove cards from search indexing."
      >
        <SettingsRow
          label="Takedown / Disconnect Deck"
          description="Request removal of your NationStates card metadata or unlink your deck"
          icon={ShieldAlert}
          glyphClass="bg-muted/60 text-foreground"
        >
          <button
            type="button"
            onClick={() => {
              soundEffects.press();
              setShowTakedownModal(true);
            }}
            data-cuelume-press="soft"
            className="facet-interactive border-border/60 bg-muted/30 text-muted-foreground flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-500 active:scale-[0.98]"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Takedown / Opt-Out</span>
          </button>
        </SettingsRow>
      </SettingsGroup>

      {/* Card Details Modal */}
      <CardDetailsModal
        card={selectedCard}
        open={Boolean(selectedCard)}
        onClose={() => setSelectedCard(null)}
      />

      {/* NationStates Card Takedown & Opt-Out Modal */}
      <NSTakedownModal
        isOpen={showTakedownModal}
        onClose={() => setShowTakedownModal(false)}
        defaultNationName={userProfile?.country?.name ?? ""}
      />
    </div>
  );
}

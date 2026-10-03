"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import Image from "next/image";
import {
  Xmark as X,
  ArrowSeparate as ArrowRightLeft,
  Coins,
  Send,
  WarningCircle as AlertCircle,
  Search,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import type { CardInstance } from "~/types/cards-display";
import { api } from "~/trpc/react";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import { Badge } from "~/components/ui/badge";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { StepIndicator } from "~/components/ui/step-indicator";

interface TradeOfferModalProps {
  open: boolean;
  onClose: () => void;
  recipientId?: string;
  recipientName?: string;
  initialYourCards?: CardInstance[];
}

/** A tradable card ownership row as the CardInstance the card picker renders. */
function toCardInstance(ownership: any): CardInstance {
  return {
    id: ownership.id,
    title: ownership.cards.title,
    description: ownership.cards.description || "",
    artwork: ownership.cards.artwork || "/images/cards/placeholder-nation.png",
    artworkVariants: ownership.cards.artworkVariants || null,
    cardType: ownership.cards.cardType,
    rarity: ownership.cards.rarity,
    season: ownership.cards.season,
    nsCardId: ownership.cards.nsCardId || null,
    nsSeason: ownership.cards.nsSeason || null,
    nsData: ownership.cards.nsData || null,
    wikiSource: ownership.cards.wikiSource || null,
    wikiArticleTitle: ownership.cards.wikiArticleTitle || null,
    wikiUrl: ownership.cards.wikiUrl || null,
    countryId: ownership.cards.countryId,
    stats: ownership.cards.stats || {},
    marketValue: ownership.cards.marketValue || 0,
    totalSupply: ownership.cards.totalSupply || 0,
    level: ownership.level || 1,
    evolutionStage: ownership.cards.evolutionStage || 0,
    enhancements: ownership.cards.enhancements || null,
    createdAt: ownership.cards.createdAt,
    updatedAt: ownership.cards.updatedAt,
    lastTrade: ownership.cards.lastTrade || null,
    country: ownership.cards.country,
    owners: [],
  };
}

export const TradeOfferModal = React.memo<TradeOfferModalProps>(
  ({ open, onClose, recipientId, recipientName, initialYourCards = [] }) => {
    const { userId: currentUserId } = useAuth();
    const [step, setStep] = useState<"partner" | "cards" | "review">(
      recipientId ? "cards" : "partner"
    );
    const [selectedYourCards, setSelectedYourCards] = useState<string[]>(
      initialYourCards.map((c) => c.id)
    );
    const [selectedTheirCards, setSelectedTheirCards] = useState<string[]>([]);
    const [yourCredits, setYourCredits] = useState(0);
    const [theirCredits, setTheirCredits] = useState(0);
    const [message, setMessage] = useState("");
    const [searchRecipient, setSearchRecipient] = useState(recipientId || "");
    const [selectedPartnerName, setSelectedPartnerName] = useState(recipientName || "");
    const [partnerSearchText, setPartnerSearchText] = useState("");

    const { data: activeUsersData } = api.users.getActiveUsers.useQuery(
      { limit: 50, excludeUserId: currentUserId ?? undefined },
      { enabled: open && !!currentUserId }
    );
    const { data: searchResultsData } = api.trading.searchTradingPartners.useQuery(
      { query: partnerSearchText },
      { enabled: open && !!currentUserId && partnerSearchText.trim().length >= 2 }
    );

    const isSearching = partnerSearchText.trim().length >= 2;

    const displayUsers = useMemo(() => {
      if (isSearching) return searchResultsData || [];
      if (!activeUsersData) return [];
      const query = partnerSearchText.trim().toLowerCase();
      const filtered = query
        ? activeUsersData.filter(
            (u) =>
              u.countryName.toLowerCase().includes(query) || u.leader.toLowerCase().includes(query)
          )
        : activeUsersData;
      return filtered.map((u) => ({
        id: u.id,
        countryName: u.countryName,
        leader: u.leader,
        economicTier: u.economicTier,
        flag: u.flag || null,
      }));
    }, [isSearching, searchResultsData, activeUsersData, partnerSearchText]);

    const { data: yourCardsData } = api.cards.getMyCards.useQuery({});
    const yourCards: CardInstance[] = useMemo(
      () => yourCardsData?.map(toCardInstance) || [],
      [yourCardsData]
    );

    const { data: theirCardsData } = api.cards.getUserCards.useQuery(
      { userId: searchRecipient },
      { enabled: !!searchRecipient }
    );
    const theirCards: CardInstance[] = useMemo(
      () => theirCardsData?.map(toCardInstance) || [],
      [theirCardsData]
    );

    const createTrade = api.trading.createtradeOffer.useMutation({
      onSuccess: () => {
        vaultNotify.tradeCompleted("Trade offer sent");
        onClose();
      },
      onError: (error: any) => {
        vaultNotify.error(error.message || "Failed to create trade offer");
      },
    });

    const yourValue = useMemo(() => {
      const cardsValue = selectedYourCards.reduce((sum, id) => {
        const card = yourCards.find((c) => c.id === id);
        return sum + (card?.marketValue || 0);
      }, 0);
      return cardsValue + yourCredits;
    }, [selectedYourCards, yourCards, yourCredits]);

    const theirValue = useMemo(() => {
      const cardsValue = selectedTheirCards.reduce((sum, id) => {
        const card = theirCards.find((c) => c.id === id);
        return sum + (card?.marketValue || 0);
      }, 0);
      return cardsValue + theirCredits;
    }, [selectedTheirCards, theirCards, theirCredits]);

    const valueDifference = yourValue - theirValue;
    const fairTrade = Math.abs(valueDifference) < yourValue * 0.2;

    const handleSubmit = useCallback(() => {
      if (!searchRecipient || selectedYourCards.length === 0 || selectedTheirCards.length === 0)
        return;
      createTrade.mutate({
        recipientId: searchRecipient,
        initiatorCardIds: selectedYourCards,
        recipientCardIds: selectedTheirCards,
        initiatorCredits: yourCredits,
        recipientCredits: theirCredits,
        message,
      });
    }, [
      createTrade,
      searchRecipient,
      selectedYourCards,
      selectedTheirCards,
      yourCredits,
      theirCredits,
      message,
    ]);

    const toggleYourCard = (cardId: string) => {
      setSelectedYourCards((prev) =>
        prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
      );
    };
    const toggleTheirCard = (cardId: string) => {
      setSelectedTheirCards((prev) =>
        prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
      );
    };

    const STEPS = ["partner", "cards", "review"] as const;
    const STEP_LABELS: Record<string, string> = {
      partner: "Partner",
      cards: "Cards",
      review: "Review",
    };

    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent
          className={cn(
            "max-h-[90vh] w-[98vw] max-w-[95vw] overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl"
          )}
        >
          <DialogClose className="bg-surface-secondary hover:bg-fill-2 absolute top-4 right-4 z-50 rounded-full p-2 transition-colors">
            <X className="text-label h-5 w-5" />
          </DialogClose>

          <div className="flex h-full flex-col overflow-hidden p-4 sm:p-6">
            <DialogHeader className="mb-4 shrink-0">
              <DialogTitle className="text-title-2 text-label sm:text-title-1 flex items-center gap-3">
                <ArrowRightLeft className="text-tint h-6 w-6" />
                Create trade offer
              </DialogTitle>
            </DialogHeader>

            {/* Step indicator */}
            <StepIndicator
              aria-label="Trade steps"
              className="mb-4 shrink-0 justify-center"
              steps={STEPS.map((s) => ({ id: s, label: STEP_LABELS[s] }))}
              current={STEPS.indexOf(step)}
              navigable="all"
              onStepClick={(idx) => {
                const s = STEPS[idx];
                if (!s) return;
                if (s === "partner") {
                  setStep("partner");
                  return;
                }
                if (s === "cards" && !searchRecipient) return;
                if (
                  s === "review" &&
                  (!searchRecipient ||
                    selectedYourCards.length === 0 ||
                    selectedTheirCards.length === 0)
                )
                  return;
                setStep(s);
              }}
            />

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {/* Partner Step */}
              {step === "partner" && (
                <div className="mx-auto max-w-lg space-y-4">
                  <div className="relative">
                    <Search className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <Input
                      placeholder="Search by country name..."
                      value={partnerSearchText}
                      onChange={(e) => setPartnerSearchText(e.target.value)}
                      className="w-full pl-10"
                    />
                  </div>

                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {displayUsers.length > 0 && (
                      <FacetListSection variant="plain" aria-label="Trade partners">
                        {displayUsers.map((user) => (
                          <FacetRow
                            key={user.id}
                            onClick={() => {
                              setSearchRecipient(user.id);
                              setSelectedPartnerName(user.countryName || user.leader);
                              setPartnerSearchText("");
                            }}
                            selected={searchRecipient === user.id}
                            selectionStyle="tint"
                            itemClassName="rounded-control overflow-hidden"
                            leading={
                              <UnifiedCountryFlag
                                countryName={user.countryName || user.leader}
                                flagUrl={user.flag}
                                size="md"
                                className="h-8 w-8 rounded object-cover"
                              />
                            }
                            title={
                              <span className="block truncate">
                                {user.countryName || "Unknown"}
                              </span>
                            }
                            subtitle={<span className="block truncate">{user.leader}</span>}
                            trailing={<Badge variant="warning">{user.economicTier}</Badge>}
                          />
                        ))}
                      </FacetListSection>
                    )}
                    {displayUsers.length === 0 && partnerSearchText.length >= 2 && (
                      <p className="text-footnote text-label-secondary py-8 text-center">
                        No results
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button size="sm" onClick={() => setStep("cards")} disabled={!searchRecipient}>
                      Next: Select Cards
                    </Button>
                  </div>
                </div>
              )}

              {/* Cards Step */}
              {step === "cards" && (
                <div className="space-y-4">
                  {selectedPartnerName && (
                    <div className="rounded-control bg-surface-secondary flex items-center justify-between p-2">
                      <div className="flex items-center gap-2">
                        <UnifiedCountryFlag
                          countryName={selectedPartnerName}
                          size="sm"
                          className="h-5 w-5 rounded object-cover"
                        />
                        <span className="text-footnote text-label font-semibold">
                          Trading with {selectedPartnerName}
                        </span>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setStep("partner")}
                        className="h-auto px-0"
                      >
                        Change
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Your Cards */}
                    <div className="flex flex-col">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-eyebrow text-label-secondary">
                          Your Cards ({selectedYourCards.length})
                        </span>
                        <span className="text-footnote text-blue font-semibold tabular-nums">
                          {yourValue.toLocaleString()} IxC
                        </span>
                      </div>
                      <div className="rounded-control border-separator max-h-64 space-y-1 overflow-y-auto border p-1">
                        <FacetListSection variant="plain" aria-label="Your cards">
                          {yourCards.map((card) => (
                            <FacetRow
                              key={card.id}
                              onClick={() => toggleYourCard(card.id)}
                              selected={selectedYourCards.includes(card.id)}
                              selectionStyle="tint"
                              accessory="check"
                              itemClassName="rounded-control-sm overflow-hidden"
                              leading={
                                <span className="block h-7 w-5 shrink-0 overflow-hidden rounded">
                                  <Image
                                    src={proxyCardArtwork(card.artwork)}
                                    alt=""
                                    width={20}
                                    height={28}
                                    className="h-full w-full object-cover"
                                    unoptimized
                                  />
                                </span>
                              }
                              title={
                                <span className="block truncate font-medium">{card.title}</span>
                              }
                              trailing={card.marketValue.toLocaleString()}
                            />
                          ))}
                        </FacetListSection>
                      </div>
                    </div>

                    {/* Their Cards */}
                    <div className="flex flex-col">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-eyebrow text-label-secondary">
                          Their Cards ({selectedTheirCards.length})
                        </span>
                        <span className="text-footnote text-green font-semibold tabular-nums">
                          {theirValue.toLocaleString()} IxC
                        </span>
                      </div>
                      {!searchRecipient ? (
                        <div className="rounded-control border-separator flex h-32 items-center justify-center border border-dashed">
                          <p className="text-footnote text-label-secondary">
                            Select a partner first
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-control border-separator max-h-64 space-y-1 overflow-y-auto border p-1">
                          <FacetListSection variant="plain" aria-label="Their cards">
                            {theirCards.map((card) => (
                              <FacetRow
                                key={card.id}
                                onClick={() => toggleTheirCard(card.id)}
                                selected={selectedTheirCards.includes(card.id)}
                                selectionStyle="tint"
                                accessory="check"
                                itemClassName="rounded-control-sm overflow-hidden"
                                leading={
                                  <span className="block h-7 w-5 shrink-0 overflow-hidden rounded">
                                    <Image
                                      src={proxyCardArtwork(card.artwork)}
                                      alt=""
                                      width={20}
                                      height={28}
                                      className="h-full w-full object-cover"
                                      unoptimized
                                    />
                                  </span>
                                }
                                title={
                                  <span className="block truncate font-medium">{card.title}</span>
                                }
                                trailing={card.marketValue.toLocaleString()}
                              />
                            ))}
                          </FacetListSection>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Credits row inside cards step */}
                  <div className="flex items-center gap-3">
                    <Coins className="text-yellow h-4 w-4 shrink-0" />
                    <Input
                      type="number"
                      min="0"
                      placeholder="You give (credits)"
                      value={yourCredits || ""}
                      onChange={(e) => setYourCredits(parseInt(e.target.value) || 0)}
                      className="text-footnote h-8"
                    />
                    <ArrowRightLeft className="text-label-secondary h-3 w-3 shrink-0" />
                    <Input
                      type="number"
                      min="0"
                      placeholder="You request (credits)"
                      value={theirCredits || ""}
                      onChange={(e) => setTheirCredits(parseInt(e.target.value) || 0)}
                      className="text-footnote h-8"
                    />
                  </div>

                  <div className="flex justify-between pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep("partner")}
                      className="text-footnote"
                    >
                      Back: Partner
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setStep("review")}
                      disabled={selectedYourCards.length === 0 || selectedTheirCards.length === 0}
                    >
                      Next: Review
                    </Button>
                  </div>
                </div>
              )}

              {/* Review Step */}
              {step === "review" && (
                <div className="mx-auto max-w-lg space-y-4">
                  <div className="rounded-control border-separator bg-surface-secondary border p-3">
                    <p className="text-footnote text-label-secondary mb-1">
                      Trading with{" "}
                      <span className="text-label font-semibold">{selectedPartnerName}</span>
                    </p>
                    <div className="text-footnote flex items-center justify-between">
                      <span className="text-blue">
                        You give: {yourValue.toLocaleString()} IxC ({selectedYourCards.length}{" "}
                        cards)
                      </span>
                      <ArrowRightLeft className="text-label-secondary h-3 w-3" />
                      <span className="text-green">
                        You get: {theirValue.toLocaleString()} IxC ({selectedTheirCards.length}{" "}
                        cards)
                      </span>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "rounded-control text-footnote flex items-center gap-2 border p-2",
                      fairTrade ? "border-green/30" : "border-yellow/30"
                    )}
                  >
                    {fairTrade ? (
                      <span className="text-green font-semibold">Fair trade</span>
                    ) : (
                      <>
                        <AlertCircle className="text-yellow h-4 w-4 shrink-0" />
                        <span className="text-yellow font-semibold">Unbalanced</span>
                        <span className="text-label-secondary">
                          Diff: {Math.abs(valueDifference).toLocaleString()} IxC
                        </span>
                      </>
                    )}
                  </div>

                  {message && (
                    <div className="rounded-control border-separator border p-2">
                      <p className="text-footnote text-label-secondary">Message</p>
                      <p className="text-footnote text-label">{message}</p>
                    </div>
                  )}

                  <Textarea
                    placeholder="Trade message (optional)"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={500}
                    rows={2}
                    className="text-footnote h-14 resize-none"
                  />

                  <div className="flex justify-between pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep("cards")}
                      className="text-footnote"
                    >
                      Back: Cards
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmit}
                      disabled={createTrade.isPending}
                      className="bg-blue text-on-blue disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {createTrade.isPending ? "Sending..." : "Send Trade Offer"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

TradeOfferModal.displayName = "TradeOfferModal";

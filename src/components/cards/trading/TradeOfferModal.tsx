"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
// eslint-disable-next-line unused-imports/no-unused-imports
import { motion } from "motion/react";
import Image from "next/image";
// eslint-disable-next-line unused-imports/no-unused-imports
import { X, ArrowRightLeft, Coins, Send, AlertCircle, Search, User } from "lucide-react";
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
import { vaultNotify } from "~/lib/vault";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { proxyCardArtwork } from "~/lib/cards";

export interface TradeOfferModalProps {
  open: boolean;
  onClose: () => void;
  recipientId?: string;
  recipientName?: string;
  initialYourCards?: CardInstance[];
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
      () =>
        yourCardsData?.map((ownership: any) => ({
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
        })) || [],
      [yourCardsData]
    );

    const { data: theirCardsData } = (api.cards as any).getUserCards.useQuery(
      { userId: searchRecipient },
      { enabled: !!searchRecipient }
    );
    const theirCards: CardInstance[] = useMemo(
      () =>
        theirCardsData?.map((ownership: any) => ({
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
        })) || [],
      [theirCardsData]
    );

    const createTrade = api.trading.createtradeOffer.useMutation({
      onSuccess: () => {
        vaultNotify.tradeCompleted("Trade offer sent successfully!");
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
    const resetForm = () => {
      setStep(recipientId ? "cards" : "partner");
      setSelectedYourCards([]);
      setSelectedTheirCards([]);
      setYourCredits(0);
      setTheirCredits(0);
      setMessage("");
      if (!recipientId) {
        setSearchRecipient("");
        setSelectedPartnerName("");
      }
      setPartnerSearchText("");
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
          <DialogClose className="absolute top-4 right-4 z-50 rounded-full bg-slate-100 p-2 backdrop-blur-sm transition-colors hover:bg-slate-200 dark:bg-black/40 dark:hover:bg-black/60">
            <X className="h-5 w-5 text-slate-800 dark:text-white" />
          </DialogClose>

          <div className="flex h-full flex-col overflow-hidden p-4 sm:p-6">
            <DialogHeader className="mb-4 shrink-0">
              <DialogTitle className="flex items-center gap-3 text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">
                <ArrowRightLeft className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                Create Trade Offer
              </DialogTitle>
            </DialogHeader>

            {/* Step indicator */}
            <div className="mb-4 flex shrink-0 items-center justify-center gap-2">
              {STEPS.map((s, idx) => (
                <React.Fragment key={s}>
                  <button
                    type="button"
                    onClick={() => {
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
                    className={cn(
                      "rounded-full px-4 py-1.5 text-xs font-medium transition-all",
                      step === s
                        ? "border border-blue-500/30 bg-blue-500/10 font-bold text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
                        : "text-slate-500 hover:bg-slate-100 dark:text-white/50 dark:hover:bg-white/5"
                    )}
                  >
                    {idx + 1}. {STEP_LABELS[s]}
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div className="h-px w-6 bg-slate-200 dark:bg-white/20" />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {/* Partner Step */}
              {step === "partner" && (
                <div className="mx-auto max-w-lg space-y-4">
                  <div className="relative">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search by country name..."
                      value={partnerSearchText}
                      onChange={(e) => setPartnerSearchText(e.target.value)}
                      className="w-full pl-10"
                    />
                  </div>

                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {displayUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setSearchRecipient(user.id);
                          setSelectedPartnerName(user.countryName || user.leader);
                          setPartnerSearchText("");
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-white/5",
                          searchRecipient === user.id && "bg-blue-50 dark:bg-blue-500/10"
                        )}
                      >
                        <UnifiedCountryFlag
                          countryName={user.countryName || user.leader}
                          flagUrl={user.flag}
                          size="md"
                          className="h-8 w-8 rounded object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                            {user.countryName || "Unknown"}
                          </p>
                          <p className="truncate text-[10px] text-slate-400">{user.leader}</p>
                        </div>
                        <span className="shrink-0 rounded border border-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:border-amber-500/30 dark:text-amber-400">
                          {user.economicTier}
                        </span>
                      </button>
                    ))}
                    {displayUsers.length === 0 && partnerSearchText.length >= 2 && (
                      <p className="py-8 text-center text-xs text-slate-400">No results</p>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      size="sm"
                      onClick={() => setStep("cards")}
                      disabled={!searchRecipient}
                      className="bg-blue-600 text-xs font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next: Select Cards
                    </Button>
                  </div>
                </div>
              )}

              {/* Cards Step */}
              {step === "cards" && (
                <div className="space-y-4">
                  {selectedPartnerName && (
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2 dark:bg-white/5">
                      <div className="flex items-center gap-2">
                        <UnifiedCountryFlag
                          countryName={selectedPartnerName}
                          size="sm"
                          className="h-5 w-5 rounded object-cover"
                        />
                        <span className="text-xs font-bold text-slate-700 dark:text-white/70">
                          Trading with {selectedPartnerName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep("partner")}
                        className="text-[10px] text-blue-500 hover:text-blue-600"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Your Cards */}
                    <div className="flex flex-col">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase dark:text-white/50">
                          Your Cards ({selectedYourCards.length})
                        </span>
                        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                          {yourValue.toLocaleString()} IxC
                        </span>
                      </div>
                      <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1 dark:border-white/10">
                        {yourCards.map((card) => {
                          const selected = selectedYourCards.includes(card.id);
                          return (
                            <button
                              key={card.id}
                              type="button"
                              onClick={() => toggleYourCard(card.id)}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-md p-1.5 text-left text-xs transition-all",
                                selected
                                  ? "bg-blue-50 dark:bg-blue-500/10"
                                  : "hover:bg-slate-50 dark:hover:bg-white/5"
                              )}
                            >
                              <div
                                className={cn(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                                  selected
                                    ? "border-blue-500 bg-blue-500"
                                    : "border-slate-300 dark:border-white/30"
                                )}
                              >
                                {selected && (
                                  <svg
                                    className="h-3 w-3 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={3}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                )}
                              </div>
                              <div className="h-7 w-5 shrink-0 overflow-hidden rounded">
                                <Image
                                  src={proxyCardArtwork(card.artwork)}
                                  alt=""
                                  width={20}
                                  height={28}
                                  className="h-full w-full object-cover"
                                  unoptimized
                                />
                              </div>
                              <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-white">
                                {card.title}
                              </span>
                              <span className="shrink-0 font-mono text-[9px] text-slate-400">
                                {card.marketValue.toLocaleString()}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Their Cards */}
                    <div className="flex flex-col">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase dark:text-white/50">
                          Their Cards ({selectedTheirCards.length})
                        </span>
                        <span className="font-mono text-xs font-bold text-green-600 dark:text-green-400">
                          {theirValue.toLocaleString()} IxC
                        </span>
                      </div>
                      {!searchRecipient ? (
                        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-white/10">
                          <p className="text-xs text-slate-400">Select a partner first</p>
                        </div>
                      ) : (
                        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1 dark:border-white/10">
                          {theirCards.map((card) => {
                            const selected = selectedTheirCards.includes(card.id);
                            return (
                              <button
                                key={card.id}
                                type="button"
                                onClick={() => toggleTheirCard(card.id)}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-md p-1.5 text-left text-xs transition-all",
                                  selected
                                    ? "bg-green-50 dark:bg-green-500/10"
                                    : "hover:bg-slate-50 dark:hover:bg-white/5"
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                                    selected
                                      ? "border-green-500 bg-green-500"
                                      : "border-slate-300 dark:border-white/30"
                                  )}
                                >
                                  {selected && (
                                    <svg
                                      className="h-3 w-3 text-white"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={3}
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  )}
                                </div>
                                <div className="h-7 w-5 shrink-0 overflow-hidden rounded">
                                  <Image
                                    src={proxyCardArtwork(card.artwork)}
                                    alt=""
                                    width={20}
                                    height={28}
                                    className="h-full w-full object-cover"
                                    unoptimized
                                  />
                                </div>
                                <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-white">
                                  {card.title}
                                </span>
                                <span className="shrink-0 font-mono text-[9px] text-slate-400">
                                  {card.marketValue.toLocaleString()}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Credits row inside cards step */}
                  <div className="flex items-center gap-3">
                    <Coins className="h-4 w-4 shrink-0 text-amber-500" />
                    <Input
                      type="number"
                      min="0"
                      placeholder="You give (credits)"
                      value={yourCredits || ""}
                      onChange={(e) => setYourCredits(parseInt(e.target.value) || 0)}
                      className="h-8 text-xs"
                    />
                    <ArrowRightLeft className="h-3 w-3 shrink-0 text-slate-400" />
                    <Input
                      type="number"
                      min="0"
                      placeholder="You request (credits)"
                      value={theirCredits || ""}
                      onChange={(e) => setTheirCredits(parseInt(e.target.value) || 0)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="flex justify-between pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep("partner")}
                      className="text-xs"
                    >
                      Back: Partner
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setStep("review")}
                      disabled={selectedYourCards.length === 0 || selectedTheirCards.length === 0}
                      className="bg-blue-600 text-xs font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next: Review
                    </Button>
                  </div>
                </div>
              )}

              {/* Review Step */}
              {step === "review" && (
                <div className="mx-auto max-w-lg space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                    <p className="mb-1 text-xs text-slate-500">
                      Trading with{" "}
                      <span className="font-bold text-slate-800 dark:text-white">
                        {selectedPartnerName}
                      </span>
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-blue-600 dark:text-blue-400">
                        You give: {yourValue.toLocaleString()} IxC ({selectedYourCards.length}{" "}
                        cards)
                      </span>
                      <ArrowRightLeft className="h-3 w-3 text-slate-400" />
                      <span className="text-green-600 dark:text-green-400">
                        You get: {theirValue.toLocaleString()} IxC ({selectedTheirCards.length}{" "}
                        cards)
                      </span>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-2 text-xs",
                      fairTrade ? "border-green-500/30" : "border-amber-500/30"
                    )}
                  >
                    {fairTrade ? (
                      <span className="font-bold text-green-600 dark:text-green-400">
                        Fair Trade
                      </span>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          Unbalanced
                        </span>
                        <span className="text-slate-400">
                          Diff: {Math.abs(valueDifference).toLocaleString()} IxC
                        </span>
                      </>
                    )}
                  </div>

                  {message && (
                    <div className="rounded-lg border border-slate-200 p-2 dark:border-white/10">
                      <p className="text-[10px] text-slate-400">Message</p>
                      <p className="text-xs text-slate-800 dark:text-white/80">{message}</p>
                    </div>
                  )}

                  <Textarea
                    placeholder="Trade message (optional)"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={500}
                    rows={2}
                    className="h-14 resize-none text-xs"
                  />

                  <div className="flex justify-between pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep("cards")}
                      className="text-xs"
                    >
                      Back: Cards
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmit}
                      disabled={createTrade.isPending}
                      className="gap-1.5 bg-blue-600 text-xs font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
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

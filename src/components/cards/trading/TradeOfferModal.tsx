/**
 * TradeOfferModal Component
 * Create new trade offers between players
 * Phase 3: P2P Trading System
 */

"use client";

import React, { useState, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { motion } from "motion/react";
import Image from "next/image";
import { X, ArrowRightLeft, Coins, Send, AlertCircle, Search, User, Globe } from "lucide-react";
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
import { useNotify } from "~/hooks/useNotify";
import { vaultNotify } from "~/lib/vault-notifications";
import { CardHolographicCover } from "../display/CardHolographicCover";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";

/**
 * TradeOfferModal component props
 */
export interface TradeOfferModalProps {
  /** Modal open state */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Recipient user ID (if preselected) */
  recipientId?: string;
  /** Recipient name for display */
  recipientName?: string;
  /** Initial selected cards from your collection */
  initialYourCards?: CardInstance[];
}

/**
 * TradeOfferModal - Create trade offer with card selection
 *
 * Features:
 * - Multi-select card grid for your cards
 * - Browse recipient's collection
 * - Optional IxCredits sweetener (both sides)
 * - Trade message/note
 * - Value comparison preview
 * - Glass modal styling
 *
 * @example
 * ```tsx
 * <TradeOfferModal
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   recipientId="user_123"
 *   recipientName="Ixania"
 * />
 * ```
 */
export const TradeOfferModal = React.memo<TradeOfferModalProps>(
  ({ open, onClose, recipientId, recipientName, initialYourCards = [] }) => {
    const notify = useNotify();
    const { userId: currentUserId } = useAuth();
    const [step, setStep] = useState<"partner" | "your-cards" | "their-cards" | "review">(
      recipientId ? "your-cards" : "partner"
    );
    const [selectedYourCards, setSelectedYourCards] = useState<string[]>(
      initialYourCards.map((c) => c.id)
    );
    const [selectedTheirCards, setSelectedTheirCards] = useState<string[]>([]);
    const [yourCredits, setYourCredits] = useState(0);
    const [theirCredits, setTheirCredits] = useState(0);
    const [message, setMessage] = useState("");
    const [searchRecipient, setSearchRecipient] = useState(recipientId || "");
    const [partnerSearchText, setPartnerSearchText] = useState("");
    const [manualUserIdMode, setManualUserIdMode] = useState(false);
    const [selectedPartnerName, setSelectedPartnerName] = useState(recipientName || "");

    // Fetch active users to select a trading partner
    const { data: activeUsersData, isLoading: loadingActiveUsers } =
      api.users.getActiveUsers.useQuery(
        { limit: 50, excludeUserId: currentUserId ?? undefined },
        { enabled: open && !!currentUserId }
      );

    // Fetch search results for trading partners using search query
    const { data: searchResultsData, isLoading: loadingSearchResults } =
      api.trading.searchTradingPartners.useQuery(
        { query: partnerSearchText },
        { enabled: open && !!currentUserId && partnerSearchText.trim().length >= 2 }
      );

    const isSearching = partnerSearchText.trim().length >= 2;
    const isLoadingPartners = isSearching ? loadingSearchResults : loadingActiveUsers;

    const displayUsers = useMemo(() => {
      if (isSearching) {
        return searchResultsData || [];
      }

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
        dbId: u.countryId,
        countryName: u.countryName,
        leader: u.leader,
        economicTier: u.economicTier,
        username: "",
        flag: u.flag || null,
      }));
    }, [isSearching, searchResultsData, activeUsersData, partnerSearchText]);

    const handleSelectPartner = (userId: string, name: string) => {
      setSearchRecipient(userId);
      setSelectedPartnerName(name);
    };

    const handleClearPartner = () => {
      setSearchRecipient("");
      setSelectedPartnerName("");
      setSelectedTheirCards([]);
    };

    // Fetch your cards
    const { data: yourCardsData } = api.cards.getMyCards.useQuery({});
    const yourCards: CardInstance[] = useMemo(
      () =>
        yourCardsData?.map((ownership: any) => ({
          id: ownership.id, // Use ownership ID, not card ID
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

    // Fetch recipient's cards (if recipient is selected)
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

    // Create trade mutation
    const createTrade = api.trading.createtradeOffer.useMutation({
      onSuccess: () => {
        vaultNotify.tradeCompleted("Trade offer sent successfully!");
        onClose();
        resetForm();
      },
      onError: (error: any) => {
        vaultNotify.error(error.message || "Failed to create trade offer");
      },
    });

    // Calculate trade values
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
    const fairTrade = Math.abs(valueDifference) < yourValue * 0.2; // Within 20%

    const resetForm = () => {
      setStep(recipientId ? "your-cards" : "partner");
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
      setManualUserIdMode(false);
    };

    const handleSubmit = () => {
      if (!searchRecipient) {
        notify.error("Please select a recipient");
        return;
      }
      if (selectedYourCards.length === 0) {
        notify.error("Please select at least one card to offer");
        return;
      }
      if (selectedTheirCards.length === 0) {
        notify.error("Please select at least one card to request");
        return;
      }

      createTrade.mutate({
        recipientId: searchRecipient,
        initiatorCardIds: selectedYourCards,
        recipientCardIds: selectedTheirCards,
        initiatorCredits: yourCredits,
        recipientCredits: theirCredits,
        message,
      });
    };

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

    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent
          className={cn(
            "glass-modal max-w-[95vw] p-0 sm:max-w-4xl lg:max-w-6xl",
            "max-h-[90vh] w-[98vw] overflow-hidden"
          )}
        >
          {/* Close button */}
          <DialogClose className="absolute top-4 right-4 z-50 rounded-full bg-slate-100 p-2 backdrop-blur-sm transition-colors hover:bg-slate-200 dark:bg-black/40 dark:hover:bg-black/60">
            <X className="h-5 w-5 text-slate-800 dark:text-white" />
          </DialogClose>

          <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
            {/* Header */}
            <DialogHeader className="mb-4">
              <DialogTitle className="flex items-center gap-3 text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">
                <ArrowRightLeft className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                Create Trade Offer
              </DialogTitle>
              {(selectedPartnerName || recipientName) && (
                <p className="text-muted-foreground mt-1 text-sm">
                  Trading with {selectedPartnerName || recipientName}
                </p>
              )}
            </DialogHeader>

            {/* Step indicator */}
            <div className="mb-6 flex items-center justify-center gap-2">
              {["partner", "your-cards", "their-cards", "review"].map((s, idx) => (
                <React.Fragment key={s}>
                  <button
                    onClick={() => {
                      if (s === "your-cards" && !searchRecipient) {
                        notify.error("Please select a trading partner first");
                        return;
                      }
                      if (
                        s === "their-cards" &&
                        (!searchRecipient || selectedYourCards.length === 0)
                      ) {
                        if (!searchRecipient) notify.error("Please select a trading partner first");
                        else notify.error("Please select at least one card to offer");
                        return;
                      }
                      if (
                        s === "review" &&
                        (!searchRecipient ||
                          selectedYourCards.length === 0 ||
                          selectedTheirCards.length === 0)
                      ) {
                        if (!searchRecipient) notify.error("Please select a trading partner first");
                        else if (selectedYourCards.length === 0)
                          notify.error("Please select at least one card to offer");
                        else notify.error("Please select at least one card to request");
                        return;
                      }
                      setStep(s as any);
                    }}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium transition-all",
                      step === s
                        ? "scale-105 border border-blue-500/30 bg-blue-500/10 font-bold text-blue-600 shadow-sm dark:bg-blue-500/20 dark:text-blue-400"
                        : "glass-hierarchy-child text-slate-500 hover:bg-slate-200/50 hover:text-slate-900 dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
                    )}
                  >
                    {idx + 1}.{" "}
                    {s === "partner"
                      ? "Partner"
                      : s === "your-cards"
                        ? "Your Cards"
                        : s === "their-cards"
                          ? "Their Cards"
                          : "Review"}
                  </button>
                  {idx < 3 && <div className="h-0.5 w-8 bg-slate-200 dark:bg-white/20" />}
                </React.Fragment>
              ))}
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-auto">
              {/* Step 2: Select your cards */}
              {step === "your-cards" && (
                <div className="space-y-4">
                  <div className="glass-hierarchy-child rounded-lg p-4">
                    <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                      Select cards to offer ({selectedYourCards.length} selected)
                    </h3>
                    <p className="text-muted-foreground text-sm">Click cards to select/deselect</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {yourCards.map((card) => {
                      const isSelected = selectedYourCards.includes(card.id);
                      return (
                        <motion.div
                          key={card.id}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => toggleYourCard(card.id)}
                          className={cn(
                            "relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all",
                            isSelected
                              ? "border-blue-400 ring-2 ring-blue-400/50"
                              : "border-slate-200 hover:border-slate-400 dark:border-white/20 dark:hover:border-white/40"
                          )}
                        >
                          <div className="relative aspect-[2.5/3.5]">
                            <CardHolographicCover
                              cardType={card.cardType}
                              rarity={card.rarity}
                              wikiSource={card.wikiSource}
                              title={card.title}
                            />
                            <Image
                              src={card.artwork}
                              alt={card.title}
                              fill
                              className="object-cover"
                              unoptimized
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          </div>
                          {isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20">
                              <div className="rounded-full bg-blue-500 p-2">
                                <svg
                                  className="h-6 w-6 text-white"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </div>
                            </div>
                          )}
                          <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                            <p className="truncate text-xs font-medium text-white">{card.title}</p>
                            <p className="text-xs text-white/60">
                              {card.marketValue.toLocaleString()} credits
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <Button
                      onClick={() => setStep("partner")}
                      variant="outline"
                      className="glass-hierarchy-child text-slate-800 dark:text-white/90"
                    >
                      Back: Partner
                    </Button>
                    <div className="glass-hierarchy-child rounded-lg px-4 py-2">
                      <p className="text-muted-foreground text-sm">Total Value</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {yourValue.toLocaleString()} credits
                      </p>
                    </div>
                    <Button
                      onClick={() => setStep("their-cards")}
                      disabled={selectedYourCards.length === 0}
                      className="glass-hierarchy-interactive font-bold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white"
                    >
                      Next: Select Their Cards
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 1: Select Partner */}
              {step === "partner" && (
                <div className="space-y-4">
                  {searchRecipient ? (
                    <div className="glass-global mx-auto max-w-md space-y-4 rounded-lg p-6 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-blue-500/5 shadow-sm dark:border-white/10">
                        <UnifiedCountryFlag
                          countryName={selectedPartnerName}
                          size="xl"
                          fitContainer
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                          {selectedPartnerName || "Trading Partner Selected"}
                        </h3>
                        <p className="text-muted-foreground mt-1 text-xs">
                          User ID: {searchRecipient}
                        </p>
                      </div>
                      <div className="flex justify-center gap-3 pt-2">
                        <Button
                          variant="outline"
                          onClick={handleClearPartner}
                          className="glass-hierarchy-child text-red-650 border-red-500/20 hover:bg-red-500/10 dark:text-red-400"
                        >
                          Change Partner
                        </Button>
                        <Button
                          onClick={() => setStep("your-cards")}
                          className="glass-hierarchy-interactive font-bold text-slate-900 dark:text-white"
                        >
                          Next: Select Your Cards
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="glass-hierarchy-child space-y-4 rounded-lg p-6">
                      <div className="text-center">
                        <ArrowRightLeft className="text-blue-650 mx-auto mb-3 h-10 w-10 animate-pulse dark:text-blue-400" />
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">
                          Select a Trading Partner
                        </h3>
                        <p className="text-muted-foreground text-xs">
                          Search by country or username
                        </p>
                      </div>

                      <div className="flex flex-col gap-4">
                        {manualUserIdMode ? (
                          <div className="mx-auto w-full max-w-md space-y-3 pt-2">
                            <Input
                              placeholder="User ID (e.g., user_abc123)"
                              value={searchRecipient}
                              onChange={(e) => {
                                setSearchRecipient(e.target.value);
                                setSelectedPartnerName("Player " + e.target.value.substring(0, 8));
                              }}
                              className="w-full text-center"
                            />
                            <p className="text-center text-[10px] text-slate-400 dark:text-white/40">
                              Paste the player's Clerk ID directly.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="relative">
                              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-white/40" />
                              <Input
                                placeholder="Search by country or username..."
                                value={partnerSearchText}
                                onChange={(e) => setPartnerSearchText(e.target.value)}
                                className="w-full pl-10"
                              />
                            </div>

                            {isLoadingPartners ? (
                              <div className="flex flex-col items-center gap-2 py-12">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500 dark:border-white/20 dark:border-t-blue-400" />
                                <span className="text-muted-foreground text-xs">
                                  {isSearching
                                    ? "Searching partners..."
                                    : "Loading active countries..."}
                                </span>
                              </div>
                            ) : displayUsers.length > 0 ? (
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-white/40">
                                  {isSearching
                                    ? `Search Results (${displayUsers.length})`
                                    : "Active/Recommended Players"}
                                </p>
                                <div className="grid max-h-[35vh] grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
                                  {displayUsers.map((user) => (
                                    <div
                                      key={user.id}
                                      onClick={() =>
                                        handleSelectPartner(
                                          user.id,
                                          user.countryName || user.username
                                        )
                                      }
                                      className="glass-global glass-interactive flex cursor-pointer items-center justify-between rounded-lg p-3"
                                    >
                                      <div className="flex min-w-0 flex-1 items-center gap-3">
                                        <div className="flex shrink-0 items-center justify-center">
                                          <UnifiedCountryFlag
                                            countryName={user.countryName || user.username}
                                            flagUrl={user.flag}
                                            size="lg"
                                            className="h-8 w-auto min-w-[32px] rounded border border-slate-200 object-cover shadow-sm dark:border-white/10"
                                          />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                                            {user.countryName || "Unknown Country"}
                                          </p>
                                          {user.username && (
                                            <div className="mt-1 flex flex-wrap items-center text-xs">
                                              <span className="flex items-center gap-1 rounded border border-cyan-500/20 bg-cyan-500/5 px-1.5 py-0.5 text-[10px] font-medium text-cyan-600 dark:border-cyan-500/10 dark:bg-cyan-500/10 dark:text-cyan-400">
                                                <User className="h-2.5 w-2.5" />
                                                {user.username}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex shrink-0 flex-col items-end pl-2 text-right">
                                        <span className="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-amber-600 uppercase dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                                          {user.economicTier}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-muted-foreground glass-hierarchy-child rounded-lg py-12 text-center text-sm">
                                No active trading partners found matching "{partnerSearchText}"
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex justify-center border-t border-slate-200 pt-2 dark:border-white/5">
                          <button
                            type="button"
                            onClick={() => setManualUserIdMode(!manualUserIdMode)}
                            className="flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-slate-800 dark:text-white/40 dark:hover:text-white/60"
                          >
                            {manualUserIdMode
                              ? "Switch back to search"
                              : "Or enter user ID manually"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Select their cards */}
              {step === "their-cards" && (
                <div className="space-y-4">
                  {!searchRecipient ? (
                    <div className="glass-hierarchy-child rounded-lg py-12 text-center">
                      <p className="text-muted-foreground mb-4 text-sm">
                        No trading partner selected.
                      </p>
                      <Button
                        onClick={() => setStep("partner")}
                        className="glass-hierarchy-interactive font-bold text-slate-900 dark:text-white"
                      >
                        Select Partner
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="glass-hierarchy-child flex items-center justify-between rounded-lg p-4">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                            Select cards to request ({selectedTheirCards.length} selected)
                          </h3>
                          <p className="text-muted-foreground text-xs">
                            Trading with:{" "}
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              {selectedPartnerName || searchRecipient}
                            </span>
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleClearPartner}
                          className="text-xs text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Change Partner
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {theirCards.map((card) => {
                          const isSelected = selectedTheirCards.includes(card.id);
                          return (
                            <motion.div
                              key={card.id}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => toggleTheirCard(card.id)}
                              className={cn(
                                "relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all",
                                isSelected
                                  ? "border-green-400 ring-2 ring-green-400/50"
                                  : "border-slate-200 hover:border-slate-400 dark:border-white/20 dark:hover:border-white/40"
                              )}
                            >
                              <div className="relative aspect-[2.5/3.5]">
                                <CardHolographicCover
                                  cardType={card.cardType}
                                  rarity={card.rarity}
                                  wikiSource={card.wikiSource}
                                  title={card.title}
                                />
                                <Image
                                  src={card.artwork}
                                  alt={card.title}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              </div>
                              {isSelected && (
                                <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
                                  <div className="rounded-full bg-green-500 p-2">
                                    <svg
                                      className="h-6 w-6 text-white"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  </div>
                                </div>
                              )}
                              <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                <p className="truncate text-xs font-medium text-white">
                                  {card.title}
                                </p>
                                <p className="text-xs text-white/60">
                                  {card.marketValue.toLocaleString()} credits
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between pt-4">
                        <Button
                          onClick={() => setStep("your-cards")}
                          variant="outline"
                          className="glass-hierarchy-child text-slate-800 dark:text-white/90"
                        >
                          Back
                        </Button>
                        <div className="glass-hierarchy-child rounded-lg px-4 py-2">
                          <p className="text-muted-foreground text-sm">Total Value</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {theirValue.toLocaleString()} credits
                          </p>
                        </div>
                        <Button
                          onClick={() => setStep("review")}
                          disabled={selectedTheirCards.length === 0}
                          className="glass-hierarchy-interactive font-bold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white"
                        >
                          Next: Review Trade
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Step 4: Review and send */}
              {step === "review" && (
                <div className="space-y-4">
                  {/* Trade summary */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Your side */}
                    <div className="glass-hierarchy-child rounded-lg p-4">
                      <h3 className="mb-3 text-lg font-semibold text-blue-600 dark:text-blue-400">
                        You Offer
                      </h3>
                      <div className="space-y-2">
                        <p className="text-sm text-slate-800 dark:text-white/80">
                          {selectedYourCards.length} card{selectedYourCards.length !== 1 ? "s" : ""}
                        </p>
                        <div className="flex items-center gap-2">
                          <Coins className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                          <Input
                            type="number"
                            min="0"
                            placeholder="+ IxCredits (optional)"
                            value={yourCredits || ""}
                            onChange={(e) => setYourCredits(parseInt(e.target.value) || 0)}
                            className="w-full text-slate-900 dark:text-white"
                          />
                        </div>
                        <div className="border-t border-slate-200 pt-2 dark:border-white/10">
                          <p className="text-muted-foreground text-sm">Total Value</p>
                          <p className="text-xl font-bold text-slate-900 dark:text-white">
                            {yourValue.toLocaleString()} credits
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Their side */}
                    <div className="glass-hierarchy-child rounded-lg p-4">
                      <h3 className="mb-3 text-lg font-semibold text-green-600 dark:text-green-400">
                        You Receive
                      </h3>
                      <div className="space-y-2">
                        <p className="text-sm text-slate-800 dark:text-white/80">
                          {selectedTheirCards.length} card
                          {selectedTheirCards.length !== 1 ? "s" : ""}
                        </p>
                        <div className="flex items-center gap-2">
                          <Coins className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                          <Input
                            type="number"
                            min="0"
                            placeholder="+ IxCredits (optional)"
                            value={theirCredits || ""}
                            onChange={(e) => setTheirCredits(parseInt(e.target.value) || 0)}
                            className="w-full text-slate-900 dark:text-white"
                          />
                        </div>
                        <div className="border-t border-slate-200 pt-2 dark:border-white/10">
                          <p className="text-muted-foreground text-sm">Total Value</p>
                          <p className="text-xl font-bold text-slate-900 dark:text-white">
                            {theirValue.toLocaleString()} credits
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fairness indicator */}
                  <div
                    className={cn(
                      "glass-hierarchy-child rounded-lg border p-4",
                      fairTrade ? "border-green-500/30" : "border-amber-500/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {fairTrade ? (
                        <>
                          <div className="rounded-full bg-green-500/20 p-2">
                            <svg
                              className="h-5 w-5 text-green-600 dark:text-green-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-green-600 dark:text-green-400">
                              Fair Trade
                            </p>
                            <p className="text-muted-foreground text-xs">
                              Values are within 20% of each other
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          <div>
                            <p className="font-medium text-amber-600 dark:text-amber-400">
                              Unbalanced Trade
                            </p>
                            <p className="text-muted-foreground text-xs">
                              Difference: {Math.abs(valueDifference).toLocaleString()} credits
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Message */}
                  <div className="glass-hierarchy-child rounded-lg p-4">
                    <label className="mb-2 block text-sm font-medium text-slate-800 dark:text-white/80">
                      Trade Message (Optional)
                    </label>
                    <Textarea
                      placeholder="Add a message to your trade offer..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={500}
                      rows={3}
                      className="w-full text-slate-900 dark:text-white"
                    />
                    <p className="mt-1 text-right text-xs text-slate-400 dark:text-white/40">
                      {message.length}/500 characters
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4">
                    <Button
                      onClick={() => setStep("their-cards")}
                      variant="outline"
                      className="glass-hierarchy-child text-slate-800 dark:text-white/90"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={createTrade.isPending}
                      className="glass-hierarchy-interactive font-bold text-slate-900 dark:text-white"
                    >
                      <Send className="mr-2 h-4 w-4" />
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

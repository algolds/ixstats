/**
 * TradeOfferModal Component
 * Create new trade offers between players
 * Phase 3: P2P Trading System
 */

"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { X, ArrowRightLeft, Coins, Send, AlertCircle } from "lucide-react";
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
import { CardGrid } from "~/components/cards/display";
import type { CardInstance } from "~/types/cards-display";
import { api } from "~/trpc/react";
import { toast } from "sonner";

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
    const [step, setStep] = useState<"your-cards" | "their-cards" | "review">("your-cards");
    const [selectedYourCards, setSelectedYourCards] = useState<string[]>(
      initialYourCards.map((c) => c.id)
    );
    const [selectedTheirCards, setSelectedTheirCards] = useState<string[]>([]);
    const [yourCredits, setYourCredits] = useState(0);
    const [theirCredits, setTheirCredits] = useState(0);
    const [message, setMessage] = useState("");
    const [searchRecipient, setSearchRecipient] = useState(recipientId || "");

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
    const createTrade = api.trading.createTradeOffer.useMutation({
      onSuccess: () => {
        toast.success("Trade offer sent successfully!");
        onClose();
        resetForm();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create trade offer");
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
      setStep("your-cards");
      setSelectedYourCards([]);
      setSelectedTheirCards([]);
      setYourCredits(0);
      setTheirCredits(0);
      setMessage("");
    };

    const handleSubmit = () => {
      if (!searchRecipient) {
        toast.error("Please select a recipient");
        return;
      }
      if (selectedYourCards.length === 0) {
        toast.error("Please select at least one card to offer");
        return;
      }
      if (selectedTheirCards.length === 0) {
        toast.error("Please select at least one card to request");
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
            "glass-modal z-[100] max-w-[95vw] sm:max-w-4xl lg:max-w-6xl p-0",
            "w-[98vw] max-h-[90vh] overflow-hidden"
          )}
        >
          {/* Close button */}
          <DialogClose className="absolute top-4 right-4 z-50 rounded-full bg-black/40 p-2 backdrop-blur-sm transition-colors hover:bg-black/60">
            <X className="h-5 w-5 text-white" />
          </DialogClose>

          <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
            {/* Header */}
            <DialogHeader className="mb-4">
              <DialogTitle className="flex items-center gap-3 text-xl sm:text-2xl font-bold text-white">
                <ArrowRightLeft className="h-6 w-6 text-blue-400" />
                Create Trade Offer
              </DialogTitle>
              {recipientName && (
                <p className="text-sm text-white/60 mt-1">Trading with {recipientName}</p>
              )}
            </DialogHeader>

            {/* Step indicator */}
            <div className="mb-6 flex items-center justify-center gap-2">
              {["your-cards", "their-cards", "review"].map((s, idx) => (
                <React.Fragment key={s}>
                  <button
                    onClick={() => setStep(s as any)}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium transition-all",
                      step === s
                        ? "glass-hierarchy-interactive scale-105 text-white"
                        : "glass-hierarchy-child text-white/60 hover:text-white/80"
                    )}
                  >
                    {idx + 1}. {s === "your-cards" ? "Your Cards" : s === "their-cards" ? "Their Cards" : "Review"}
                  </button>
                  {idx < 2 && <div className="h-0.5 w-8 bg-white/20" />}
                </React.Fragment>
              ))}
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-auto">
              {/* Step 1: Select your cards */}
              {step === "your-cards" && (
                <div className="space-y-4">
                  <div className="glass-hierarchy-child rounded-lg p-4">
                    <h3 className="mb-2 text-lg font-semibold text-white">
                      Select cards to offer ({selectedYourCards.length} selected)
                    </h3>
                    <p className="text-sm text-white/60">Click cards to select/deselect</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {yourCards.map((card) => {
                      const isSelected = selectedYourCards.includes(card.id);
                      return (
                        <motion.div
                          key={card.id}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => toggleYourCard(card.id)}
                          className={cn(
                            "relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                            isSelected
                              ? "border-blue-400 ring-2 ring-blue-400/50"
                              : "border-white/20 hover:border-white/40"
                          )}
                        >
                          <div className="aspect-[2.5/3.5] relative">
                            <Image
                              src={card.artwork}
                              alt={card.title}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          {isSelected && (
                            <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
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
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                            <p className="text-xs font-medium text-white truncate">{card.title}</p>
                            <p className="text-xs text-white/60">{card.marketValue.toLocaleString()} credits</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center pt-4">
                    <div className="glass-hierarchy-child rounded-lg px-4 py-2">
                      <p className="text-sm text-white/60">Total Value</p>
                      <p className="text-lg font-bold text-white">
                        {yourValue.toLocaleString()} credits
                      </p>
                    </div>
                    <Button
                      onClick={() => setStep("their-cards")}
                      disabled={selectedYourCards.length === 0}
                      className="glass-hierarchy-interactive"
                    >
                      Next: Select Their Cards
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Select their cards */}
              {step === "their-cards" && (
                <div className="space-y-4">
                  {!searchRecipient ? (
                    <div className="glass-hierarchy-child rounded-lg p-6 text-center">
                      <AlertCircle className="mx-auto h-12 w-12 text-amber-400 mb-3" />
                      <h3 className="text-lg font-semibold text-white mb-2">
                        Select a Trading Partner
                      </h3>
                      <p className="text-sm text-white/60 mb-4">
                        Enter the user ID of the person you want to trade with
                      </p>
                      <Input
                        placeholder="User ID (e.g., user_abc123)"
                        value={searchRecipient}
                        onChange={(e) => setSearchRecipient(e.target.value)}
                        className="max-w-md mx-auto"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="glass-hierarchy-child rounded-lg p-4">
                        <h3 className="mb-2 text-lg font-semibold text-white">
                          Select cards to request ({selectedTheirCards.length} selected)
                        </h3>
                        <p className="text-sm text-white/60">Click cards to select/deselect</p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {theirCards.map((card) => {
                          const isSelected = selectedTheirCards.includes(card.id);
                          return (
                            <motion.div
                              key={card.id}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => toggleTheirCard(card.id)}
                              className={cn(
                                "relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                                isSelected
                                  ? "border-green-400 ring-2 ring-green-400/50"
                                  : "border-white/20 hover:border-white/40"
                              )}
                            >
                              <div className="aspect-[2.5/3.5] relative">
                                <Image
                                  src={card.artwork}
                                  alt={card.title}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              </div>
                              {isSelected && (
                                <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
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
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                <p className="text-xs font-medium text-white truncate">{card.title}</p>
                                <p className="text-xs text-white/60">{card.marketValue.toLocaleString()} credits</p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>

                      <div className="flex justify-between items-center pt-4">
                        <Button
                          onClick={() => setStep("your-cards")}
                          variant="outline"
                          className="glass-hierarchy-child"
                        >
                          Back
                        </Button>
                        <div className="glass-hierarchy-child rounded-lg px-4 py-2">
                          <p className="text-sm text-white/60">Total Value</p>
                          <p className="text-lg font-bold text-white">
                            {theirValue.toLocaleString()} credits
                          </p>
                        </div>
                        <Button
                          onClick={() => setStep("review")}
                          disabled={selectedTheirCards.length === 0}
                          className="glass-hierarchy-interactive"
                        >
                          Next: Review Trade
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Step 3: Review and send */}
              {step === "review" && (
                <div className="space-y-4">
                  {/* Trade summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Your side */}
                    <div className="glass-hierarchy-child rounded-lg p-4">
                      <h3 className="mb-3 text-lg font-semibold text-blue-400">You Offer</h3>
                      <div className="space-y-2">
                        <p className="text-sm text-white/80">
                          {selectedYourCards.length} card{selectedYourCards.length !== 1 ? "s" : ""}
                        </p>
                        <div className="flex items-center gap-2">
                          <Coins className="h-4 w-4 text-amber-400" />
                          <Input
                            type="number"
                            min="0"
                            placeholder="+ IxCredits (optional)"
                            value={yourCredits || ""}
                            onChange={(e) => setYourCredits(parseInt(e.target.value) || 0)}
                            className="w-full"
                          />
                        </div>
                        <div className="pt-2 border-t border-white/10">
                          <p className="text-sm text-white/60">Total Value</p>
                          <p className="text-xl font-bold text-white">
                            {yourValue.toLocaleString()} credits
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Their side */}
                    <div className="glass-hierarchy-child rounded-lg p-4">
                      <h3 className="mb-3 text-lg font-semibold text-green-400">You Receive</h3>
                      <div className="space-y-2">
                        <p className="text-sm text-white/80">
                          {selectedTheirCards.length} card{selectedTheirCards.length !== 1 ? "s" : ""}
                        </p>
                        <div className="flex items-center gap-2">
                          <Coins className="h-4 w-4 text-amber-400" />
                          <Input
                            type="number"
                            min="0"
                            placeholder="+ IxCredits (optional)"
                            value={theirCredits || ""}
                            onChange={(e) => setTheirCredits(parseInt(e.target.value) || 0)}
                            className="w-full"
                          />
                        </div>
                        <div className="pt-2 border-t border-white/10">
                          <p className="text-sm text-white/60">Total Value</p>
                          <p className="text-xl font-bold text-white">
                            {theirValue.toLocaleString()} credits
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fairness indicator */}
                  <div
                    className={cn(
                      "glass-hierarchy-child rounded-lg p-4",
                      fairTrade ? "border-green-400/30" : "border-amber-400/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {fairTrade ? (
                        <>
                          <div className="rounded-full bg-green-500/20 p-2">
                            <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-green-400">Fair Trade</p>
                            <p className="text-xs text-white/60">Values are within 20% of each other</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-5 w-5 text-amber-400" />
                          <div>
                            <p className="font-medium text-amber-400">Unbalanced Trade</p>
                            <p className="text-xs text-white/60">
                              Difference: {Math.abs(valueDifference).toLocaleString()} credits
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Message */}
                  <div className="glass-hierarchy-child rounded-lg p-4">
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Trade Message (Optional)
                    </label>
                    <Textarea
                      placeholder="Add a message to your trade offer..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={500}
                      rows={3}
                      className="w-full"
                    />
                    <p className="mt-1 text-xs text-white/40 text-right">
                      {message.length}/500 characters
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between items-center pt-4">
                    <Button
                      onClick={() => setStep("their-cards")}
                      variant="outline"
                      className="glass-hierarchy-child"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={createTrade.isPending}
                      className="glass-hierarchy-interactive"
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

"use client";
/**
 * CraftingWorkbench Component
 * Main crafting interface for IxCards fusion and evolution
 * Phase 3: Crafting System
 */

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { EmptyState } from "~/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { useNotify } from "~/hooks/useNotify";
import { CardDisplay } from "../display/CardDisplay";
import { CraftingAnimation } from "./CraftingAnimation";
import type { CardInstance } from "~/types/cards-display";
import { Card } from "~/components/ui/card";

/**
 * Card slot for drag-drop or click to add
 */
interface CardSlot {
  id: string;
  card: CardInstance | null;
  required: boolean;
}

/**
 * CraftingWorkbench props
 */
interface CraftingWorkbenchProps {
  /** Selected recipe ID */
  recipeId: string | null;
  /** User's card inventory */
  availableCards: CardInstance[];
  /** Callback when crafting completes */
  onCraftComplete?: (result: any) => void;
}

/**
 * CraftingWorkbench - Main crafting interface
 *
 * Features:
 * - Recipe selector
 * - Card slots (drag & drop or click to add)
 * - Material cards display
 * - Success rate display
 * - Crafting cost (IxCredits)
 * - "Craft" button with animation
 * - Result preview
 * - Glass physics workbench styling
 *
 * @example
 * ```tsx
 * <CraftingWorkbench
 *   recipeId="recipe-123"
 *   availableCards={userCards}
 *   onCraftComplete={(result) => console.log('Crafted:', result)}
 * />
 * ```
 */
export const CraftingWorkbench: React.FC<CraftingWorkbenchProps> = ({
  recipeId,
  availableCards,
  onCraftComplete,
}) => {
  const [cardSlots, setCardSlots] = useState<CardSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [crafting, setCrafting] = useState(false);
  const [craftingResult, setCraftingResult] = useState<any>(null);

  // Fetch recipe details
  const { data: recipeData, isLoading: recipeLoading } = api.crafting.getRecipeById.useQuery(
    { recipeId: recipeId! },
    { enabled: !!recipeId }
  );

  // Fetch user vault balance
  const { data: vaultBalance } = api.vault.getBalance.useQuery(undefined, {
    enabled: !!recipeId,
  });

  const notify = useNotify();
  const craftMutation = api.crafting.craftCard.useMutation({
    onSuccess: (result) => {
      setCraftingResult(result);
      setCrafting(false);
      onCraftComplete?.(result);
    },
    onError: (error) => {
      notify.error("Crafting failed", error.message);
      setCrafting(false);
    },
  });

  // Initialize card slots based on recipe
  React.useEffect(() => {
    if (recipeData) {
      const materials = recipeData.requiredCardIds as any[];
      const slots: CardSlot[] = materials.map((material, index) => ({
        id: `slot-${index}`,
        card: null,
        required: true,
      }));
      // oxlint-disable-next-line
      setCardSlots(slots);
    }
  }, [recipeData]);

  /**
   * Handle card selection for a slot
   */
  const handleCardSelect = useCallback((slotId: string, card: CardInstance) => {
    setCardSlots((prev) => prev.map((slot) => (slot.id === slotId ? { ...slot, card } : slot)));
    setShowCardPicker(false);
    setSelectedSlot(null);
  }, []);

  /**
   * Handle removing a card from a slot
   */
  const handleRemoveCard = useCallback((slotId: string) => {
    setCardSlots((prev) =>
      prev.map((slot) => (slot.id === slotId ? { ...slot, card: null } : slot))
    );
  }, []);

  /**
   * Handle craft button click
   */
  const handleCraft = useCallback(async () => {
    if (!recipeId) return;

    // The server consumes ownership rows (CardOwnership.id), not card definitions
    const materialCardIds = cardSlots
      .filter((slot) => slot.card)
      .map((slot) => slot.card!.ownershipId ?? slot.card!.id);

    if (materialCardIds.length !== cardSlots.length) {
      notify.error("Please fill all card slots before crafting");
      return;
    }

    setCrafting(true);
    craftMutation.mutate({ recipeId, materialCardIds });
  }, [recipeId, cardSlots, craftMutation]);

  // Check if all slots are filled
  // Locked cards can't be consumed, and one card can't fill two slots
  const usedOwnershipIds = new Set(
    cardSlots.flatMap((slot) => (slot.card ? [slot.card.ownershipId ?? slot.card.id] : []))
  );
  const pickableCards = availableCards.filter(
    (card) => !card.isLocked && !usedOwnershipIds.has(card.ownershipId ?? card.id)
  );

  const allSlotsFilled = cardSlots.every((slot) => slot.card !== null);

  // Check if user has enough credits
  const hasEnoughCredits =
    vaultBalance && recipeData && vaultBalance.credits >= recipeData.ixCreditsCost;

  // Success rate as a percentage (the API returns 0.0-1.0)
  const successRate = (recipeData?.successRate ?? 0) * 100;

  if (!recipeId) {
    return (
      <Card>
        <EmptyState title="Select a recipe to begin crafting" />
      </Card>
    );
  }

  if (recipeLoading) {
    return (
      <Card padding="lg" className="space-y-4" aria-busy="true" aria-label="Loading recipe">
        <Skeleton className="mx-auto h-7 w-48" />
        <Skeleton className="mx-auto h-4 w-64" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Skeleton className="rounded-row h-[300px]" />
          <Skeleton className="rounded-row h-[300px]" />
          <Skeleton className="rounded-row h-[300px]" />
        </div>
      </Card>
    );
  }

  if (!recipeData) {
    return (
      <Card>
        <EmptyState title="Recipe not found" />
      </Card>
    );
  }

  return (
    <>
      <Card padding="lg" className="space-y-6">
        {/* Recipe header */}
        <div className="space-y-2 text-center">
          <h2 className="text-title-1 text-label">{recipeData.name}</h2>
          {recipeData.description && (
            <p className="text-body text-label-secondary">{recipeData.description}</p>
          )}
          <div className="text-body flex items-center justify-center gap-4">
            <Badge variant="default">{recipeData.recipeType}</Badge>
            <Badge variant="secondary">{recipeData.resultRarity}</Badge>
          </div>
        </div>

        {/* Card slots */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {cardSlots.map((slot) => (
            <motion.div
              key={slot.id}
              className={cn(
                "rounded-row relative min-h-[300px] border-2 border-dashed p-4",
                "flex items-center justify-center transition-colors",
                slot.card
                  ? "border-green/50 bg-green/5"
                  : "border-separator bg-surface-secondary hover:bg-fill-4 cursor-pointer"
              )}
              role={slot.card ? undefined : "button"}
              tabIndex={slot.card || crafting ? undefined : 0}
              aria-label={slot.card ? undefined : "Add a card to this slot"}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !slot.card && !crafting) {
                  e.preventDefault();
                  setSelectedSlot(slot.id);
                  setShowCardPicker(true);
                }
              }}
              onClick={() => {
                if (!slot.card && !crafting) {
                  setSelectedSlot(slot.id);
                  setShowCardPicker(true);
                }
              }}
            >
              {slot.card ? (
                <div className="relative">
                  <CardDisplay card={slot.card} size="small" />
                  <Button
                    size="icon-sm"
                    variant="destructive"
                    aria-label="Remove card"
                    className="absolute -top-2 -right-2 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveCard(slot.id);
                    }}
                    disabled={crafting}
                  >
                    ×
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-large-title mb-2">🎴</div>
                  <div className="text-body text-label-secondary">
                    {slot.required ? "Required" : "Optional"}
                  </div>
                  <div className="text-footnote text-label-tertiary mt-1">Click to add card</div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Crafting info */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Success rate */}
          <div className="bg-surface-secondary rounded-row p-4">
            <Stat
              label="Success rate"
              value={
                <span
                  className={cn(
                    successRate >= 80
                      ? "text-green"
                      : successRate >= 50
                        ? "text-yellow"
                        : "text-orange"
                  )}
                >
                  {successRate.toFixed(0)}%
                </span>
              }
            />
          </div>

          {/* Cost */}
          <div className="bg-surface-secondary rounded-row p-4">
            <Stat
              label="Cost"
              value={
                <span className={hasEnoughCredits ? "text-green" : "text-red"}>
                  {recipeData.ixCreditsCost.toLocaleString()}
                </span>
              }
              hint="IxCredits"
            />
          </div>

          {/* XP Reward */}
          <div className="bg-surface-secondary rounded-row p-4">
            <Stat label="XP reward" value={`+${recipeData.collectorXPGain}`} hint="Collector XP" />
          </div>
        </div>

        {/* Craft button */}
        <motion.button
          className={cn(
            "focus-visible:outline-tint rounded-control-lg text-headline duration-fast h-(--control-height-lg) w-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
            allSlotsFilled && hasEnoughCredits && !crafting
              ? "bg-tint text-on-tint hover:bg-tint-hover cursor-pointer"
              : "bg-fill-3 text-label-tertiary cursor-not-allowed"
          )}
          disabled={!allSlotsFilled || !hasEnoughCredits || crafting}
          onClick={handleCraft}
          whileTap={allSlotsFilled && hasEnoughCredits && !crafting ? { scale: 0.98 } : {}}
        >
          {crafting ? "Crafting..." : "Craft Card"}
        </motion.button>

        {/* Validation messages */}
        {!allSlotsFilled && (
          <div className="text-body text-orange text-center">Fill all card slots to craft</div>
        )}
        {allSlotsFilled && !hasEnoughCredits && (
          <div className="text-body text-red text-center">Insufficient IxCredits</div>
        )}
      </Card>

      {/* Card picker */}
      <Dialog
        open={showCardPicker && !!selectedSlot}
        onOpenChange={(open) => {
          if (!open) setShowCardPicker(false);
        }}
      >
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select a card</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {pickableCards.map((card) => (
              <button
                type="button"
                key={card.ownershipId ?? card.id}
                onClick={() => selectedSlot && handleCardSelect(selectedSlot, card)}
                className="focus-visible:outline-tint rounded-row cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <CardDisplay card={card} size="small" />
              </button>
            ))}
          </div>
          {pickableCards.length === 0 && <EmptyState compact title="No cards available" />}
        </DialogContent>
      </Dialog>

      {/* Crafting animation */}
      <AnimatePresence>
        {craftingResult && (
          <CraftingAnimation
            success={craftingResult.success}
            resultCard={craftingResult.resultCard}
            xpGained={craftingResult.xpGained}
            onComplete={() => setCraftingResult(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

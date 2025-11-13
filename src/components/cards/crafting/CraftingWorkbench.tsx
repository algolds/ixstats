/**
 * CraftingWorkbench Component
 * Main crafting interface for IxCards fusion and evolution
 * Phase 3: Crafting System
 */

"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { useSoundService } from "~/lib/sound-service";
import { CometCard } from "~/components/ui/comet-card";
import { CardDisplay } from "../display/CardDisplay";
import { CraftingAnimation } from "./CraftingAnimation";
import type { CardInstance } from "~/types/cards-display";

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
export interface CraftingWorkbenchProps {
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

  // Sound service
  const soundService = useSoundService();

  // Fetch recipe details
  const { data: recipeData, isLoading: recipeLoading } = api.crafting.getRecipeById.useQuery(
    { recipeId: recipeId! },
    { enabled: !!recipeId }
  );

  // Fetch user vault balance
  const { data: vaultBalance } = api.vault.getBalance.useQuery(
    { userId: "" }, // Will be filled by protectedProcedure
    { enabled: !!recipeId }
  );

  // Crafting mutation
  const craftMutation = api.crafting.craftCard.useMutation({
    onSuccess: (result) => {
      soundService?.play("craft-success"); // Play success sound
      setCraftingResult(result);
      setCrafting(false);
      onCraftComplete?.(result);
    },
    onError: (error) => {
      soundService?.play("craft-fail"); // Play fail sound
      alert(`Crafting failed: ${error.message}`);
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
      setCardSlots(slots);
    }
  }, [recipeData]);

  /**
   * Handle card selection for a slot
   */
  const handleCardSelect = useCallback(
    (slotId: string, card: CardInstance) => {
      setCardSlots((prev) =>
        prev.map((slot) =>
          slot.id === slotId ? { ...slot, card } : slot
        )
      );
      setShowCardPicker(false);
      setSelectedSlot(null);
    },
    []
  );

  /**
   * Handle removing a card from a slot
   */
  const handleRemoveCard = useCallback((slotId: string) => {
    setCardSlots((prev) =>
      prev.map((slot) =>
        slot.id === slotId ? { ...slot, card: null } : slot
      )
    );
  }, []);

  /**
   * Handle craft button click
   */
  const handleCraft = useCallback(async () => {
    if (!recipeId) return;

    const materialCardIds = cardSlots
      .filter((slot) => slot.card)
      .map((slot) => slot.card!.id);

    if (materialCardIds.length !== cardSlots.length) {
      alert("Please fill all card slots before crafting");
      return;
    }

    setCrafting(true);
    craftMutation.mutate({ recipeId, materialCardIds });
  }, [recipeId, cardSlots, craftMutation]);

  // Check if all slots are filled
  const allSlotsFilled = cardSlots.every((slot) => slot.card !== null);

  // Check if user has enough credits
  const hasEnoughCredits =
    vaultBalance && recipeData && vaultBalance.credits >= recipeData.ixCreditsCost;

  // Calculate success rate
  const successRate = recipeData?.successRate ?? 0;

  if (!recipeId) {
    return (
      <CometCard className="p-8 text-center" glassDepth="child">
        <div className="text-white/60 text-lg">
          Select a recipe to begin crafting
        </div>
      </CometCard>
    );
  }

  if (recipeLoading) {
    return (
      <CometCard className="p-8 text-center" glassDepth="child">
        <div className="animate-pulse text-white/60">Loading recipe...</div>
      </CometCard>
    );
  }

  if (!recipeData) {
    return (
      <CometCard className="p-8 text-center" glassDepth="child">
        <div className="text-red-400">Recipe not found</div>
      </CometCard>
    );
  }

  return (
    <>
      <CometCard className="p-6 space-y-6" glassDepth="child">
        {/* Recipe header */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-white">{recipeData.name}</h2>
          {recipeData.description && (
            <p className="text-white/70 text-sm">{recipeData.description}</p>
          )}
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="px-3 py-1 rounded-full bg-white/10 text-white/90 font-semibold">
              {recipeData.recipeType}
            </div>
            <div className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 font-semibold">
              {recipeData.resultRarity}
            </div>
          </div>
        </div>

        {/* Card slots */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {cardSlots.map((slot) => (
            <motion.div
              key={slot.id}
              className={cn(
                "relative rounded-xl border-2 border-dashed p-4 min-h-[300px]",
                "flex items-center justify-center transition-colors",
                slot.card
                  ? "border-green-500/50 bg-green-500/5"
                  : "border-white/30 bg-white/5 hover:border-white/50 cursor-pointer"
              )}
              onClick={() => {
                if (!slot.card && !crafting) {
                  setSelectedSlot(slot.id);
                  setShowCardPicker(true);
                }
              }}
              whileHover={!slot.card && !crafting ? { scale: 1.02 } : {}}
            >
              {slot.card ? (
                <div className="relative">
                  <CardDisplay card={slot.card} size="small" />
                  <button
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveCard(slot.id);
                    }}
                    disabled={crafting}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-4xl mb-2">🎴</div>
                  <div className="text-white/60 text-sm">
                    {slot.required ? "Required" : "Optional"}
                  </div>
                  <div className="text-white/40 text-xs mt-1">
                    Click to add card
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Crafting info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Success rate */}
          <CometCard className="p-4 text-center" glassDepth="interactive">
            <div className="text-white/60 text-xs uppercase mb-1">Success Rate</div>
            <div
              className={cn(
                "text-2xl font-black",
                successRate >= 80
                  ? "text-green-400"
                  : successRate >= 50
                  ? "text-yellow-400"
                  : "text-orange-400"
              )}
            >
              {successRate.toFixed(0)}%
            </div>
          </CometCard>

          {/* Cost */}
          <CometCard className="p-4 text-center" glassDepth="interactive">
            <div className="text-white/60 text-xs uppercase mb-1">Cost</div>
            <div
              className={cn(
                "text-2xl font-black",
                hasEnoughCredits ? "text-green-400" : "text-red-400"
              )}
            >
              {recipeData.ixCreditsCost.toLocaleString()}
            </div>
            <div className="text-white/40 text-xs">IxCredits</div>
          </CometCard>

          {/* XP Reward */}
          <CometCard className="p-4 text-center" glassDepth="interactive">
            <div className="text-white/60 text-xs uppercase mb-1">XP Reward</div>
            <div className="text-2xl font-black text-blue-400">
              +{recipeData.collectorXPGain}
            </div>
            <div className="text-white/40 text-xs">Collector XP</div>
          </CometCard>
        </div>

        {/* Craft button */}
        <motion.button
          className={cn(
            "w-full py-4 rounded-xl font-black text-lg",
            "transition-all duration-300",
            allSlotsFilled && hasEnoughCredits && !crafting
              ? "bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/50"
              : "bg-white/10 text-white/40 cursor-not-allowed"
          )}
          disabled={!allSlotsFilled || !hasEnoughCredits || crafting}
          onClick={handleCraft}
          whileHover={
            allSlotsFilled && hasEnoughCredits && !crafting
              ? { scale: 1.02 }
              : {}
          }
          whileTap={
            allSlotsFilled && hasEnoughCredits && !crafting
              ? { scale: 0.98 }
              : {}
          }
        >
          {crafting ? "Crafting..." : "Craft Card"}
        </motion.button>

        {/* Validation messages */}
        {!allSlotsFilled && (
          <div className="text-center text-orange-400 text-sm">
            Fill all card slots to craft
          </div>
        )}
        {allSlotsFilled && !hasEnoughCredits && (
          <div className="text-center text-red-400 text-sm">
            Insufficient IxCredits
          </div>
        )}
      </CometCard>

      {/* Card picker modal */}
      <AnimatePresence>
        {showCardPicker && selectedSlot && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCardPicker(false)}
          >
            <motion.div
              className="w-full max-w-4xl max-h-[80vh] overflow-y-auto"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <CometCard className="p-6" glassDepth="modal">
                <h3 className="text-xl font-black text-white mb-4">
                  Select a Card
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {availableCards.map((card) => (
                    <motion.div
                      key={card.id}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => handleCardSelect(selectedSlot, card)}
                      className="cursor-pointer"
                    >
                      <CardDisplay card={card} size="small" />
                    </motion.div>
                  ))}
                </div>
                {availableCards.length === 0 && (
                  <div className="text-center text-white/60 py-8">
                    No cards available
                  </div>
                )}
              </CometCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

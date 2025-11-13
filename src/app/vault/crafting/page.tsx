/**
 * Crafting Page - IxCards Fusion & Evolution Hub
 * /vault/crafting
 *
 * Main crafting interface for card fusion and evolution
 * Phase 3: Crafting System
 */

"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { api } from "~/trpc/react";
import { CometCard } from "~/components/ui/comet-card";
import {
  CraftingWorkbench,
  RecipeBrowser,
} from "~/components/cards/crafting";
import { cn } from "~/lib/utils";
import type { CardInstance } from "~/types/cards-display";

/**
 * Crafting page component
 */
export default function CraftingPage() {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  // Fetch user's card inventory
  const { data: inventoryData, refetch: refetchInventory } =
    api.cards.getMyCards.useQuery({
      sortBy: "acquired",
    });

  // Fetch crafting stats
  const { data: craftingStats } = api.crafting.getCraftingStats.useQuery();

  // Fetch crafting history
  const { data: historyData } = api.crafting.getCraftingHistory.useQuery({
    limit: 10,
  });

  // Transform inventory data to CardInstance format
  const availableCards: CardInstance[] = useMemo(
    () =>
      inventoryData?.map((ownership: any) => ({
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
    [inventoryData]
  );

  const history = historyData?.history ?? [];

  /**
   * Handle craft completion
   */
  const handleCraftComplete = async (result: any) => {
    // Refetch inventory to reflect changes
    await refetchInventory();

    // Show success notification
    if (result.success) {
      alert(`Successfully crafted! Gained ${result.xpGained} XP`);
    } else {
      alert("Crafting failed. Materials were consumed.");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h1 className="text-4xl font-black text-white">Card Crafting</h1>
        <p className="text-white/70 text-lg">
          Fuse cards together or evolve them into more powerful variants
        </p>
      </motion.div>

      {/* Stats overview */}
      {craftingStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <CometCard className="p-6" glassDepth="parent">
            <h2 className="text-xl font-black text-white mb-4">
              Crafting Statistics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-black text-purple-400">
                  {craftingStats.totalCrafts}
                </div>
                <div className="text-white/60 text-sm">Total Crafts</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-green-400">
                  {craftingStats.successfulCrafts}
                </div>
                <div className="text-white/60 text-sm">Successful</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-yellow-400">
                  {craftingStats.successRate.toFixed(1)}%
                </div>
                <div className="text-white/60 text-sm">Success Rate</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-blue-400">
                  {craftingStats.uniqueRecipesCrafted}
                </div>
                <div className="text-white/60 text-sm">Unique Recipes</div>
              </div>
            </div>
          </CometCard>
        </motion.div>
      )}

      {/* Main crafting interface */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Recipe browser sidebar */}
        <div className="lg:col-span-1">
          <RecipeBrowser
            selectedRecipeId={selectedRecipeId}
            onRecipeSelect={setSelectedRecipeId}
          />
        </div>

        {/* Crafting workbench */}
        <div className="lg:col-span-2">
          <CraftingWorkbench
            recipeId={selectedRecipeId}
            availableCards={availableCards}
            onCraftComplete={handleCraftComplete}
          />
        </div>
      </motion.div>

      {/* Crafting history */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <CometCard className="p-6" glassDepth="parent">
          <h2 className="text-xl font-black text-white mb-4">
            Recent Crafting History
          </h2>

          {history.length === 0 ? (
            <div className="text-center py-8 text-white/60">
              No crafting history yet. Start crafting to see your results here!
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry: any) => (
                <CometCard
                  key={entry.id}
                  className="p-4"
                  glassDepth="child"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white">
                          {entry.recipe.name}
                        </span>
                        {entry.success ? (
                          <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 text-xs font-semibold">
                            ✓ Success
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-xs font-semibold">
                            ✗ Failed
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/60">
                        {new Date(entry.craftedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-white/70">
                        <span className="text-yellow-400 font-semibold">
                          -{entry.ixCreditsSpent.toLocaleString()}
                        </span>{" "}
                        IxCredits
                      </div>
                      {entry.collectorXPGain > 0 && (
                        <div className="text-sm text-white/70">
                          <span className="text-blue-400 font-semibold">
                            +{entry.collectorXPGain}
                          </span>{" "}
                          XP
                        </div>
                      )}
                    </div>
                  </div>
                </CometCard>
              ))}
            </div>
          )}
        </CometCard>
      </motion.div>

      {/* Help section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <CometCard className="p-6" glassDepth="child">
          <h2 className="text-xl font-black text-white mb-4">
            How Crafting Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-white/80 text-sm">
            <div>
              <h3 className="font-bold text-purple-400 mb-2">🔮 Fusion</h3>
              <p>
                Combine multiple cards to create a new card. The rarity of the
                result depends on the materials used. Higher rarity results have
                lower success rates.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-blue-400 mb-2">⚡ Evolution</h3>
              <p>
                Upgrade a single card using materials. Evolution preserves the
                base card but enhances its stats and rarity. More reliable than
                fusion.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-yellow-400 mb-2">💰 Costs</h3>
              <p>
                Crafting requires IxCredits. Higher rarity results cost more.
                Failed crafts still consume materials and credits, so plan
                carefully!
              </p>
            </div>
            <div>
              <h3 className="font-bold text-green-400 mb-2">📈 Rewards</h3>
              <p>
                Successful crafts award Collector XP. Level up to unlock more
                powerful recipes and exclusive crafting options.
              </p>
            </div>
          </div>
        </CometCard>
      </motion.div>
    </div>
  );
}

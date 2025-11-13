/**
 * RecipeBrowser Component
 * Browse and filter available crafting recipes
 * Phase 3: Crafting System
 */

"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { CometCard } from "~/components/ui/comet-card";
import { getRarityConfig } from "~/lib/card-display-utils";

/**
 * Recipe filter type
 */
type RecipeFilter = "ALL" | "UNLOCKED" | "LOCKED" | "COMPLETED";

/**
 * RecipeBrowser props
 */
export interface RecipeBrowserProps {
  /** Selected recipe ID */
  selectedRecipeId: string | null;
  /** Callback when recipe is selected */
  onRecipeSelect: (recipeId: string) => void;
}

/**
 * RecipeBrowser - Browse available recipes
 *
 * Features:
 * - Recipe cards grid
 * - Filter by: Unlocked, Locked, Completed
 * - Recipe details: Materials needed, result card, unlock requirements
 * - Search functionality
 * - Completion tracking
 *
 * @example
 * ```tsx
 * <RecipeBrowser
 *   selectedRecipeId={recipeId}
 *   onRecipeSelect={(id) => setRecipeId(id)}
 * />
 * ```
 */
export const RecipeBrowser: React.FC<RecipeBrowserProps> = ({
  selectedRecipeId,
  onRecipeSelect,
}) => {
  const [filter, setFilter] = useState<RecipeFilter>("ALL");
  const [search, setSearch] = useState("");

  // Fetch recipes
  const { data, isLoading } = api.crafting.getRecipes.useQuery({
    filter,
    search: search || undefined,
  });

  const recipes = data?.recipes ?? [];
  const total = data?.total ?? 0;

  return (
    <CometCard className="p-6 space-y-4" glassDepth="child">
      {/* Header */}
      <div className="space-y-4">
        <h3 className="text-xl font-black text-white">Recipes</h3>

        {/* Search */}
        <input
          type="text"
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(
            "w-full px-4 py-2 rounded-lg",
            "bg-white/10 border border-white/20",
            "text-white placeholder:text-white/40",
            "focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          )}
        />

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {(["ALL", "UNLOCKED", "LOCKED", "COMPLETED"] as RecipeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1 rounded-full text-sm font-semibold transition-colors",
                filter === f
                  ? "bg-purple-500 text-white"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Count */}
        <div className="text-white/60 text-sm">
          {total} recipe{total !== 1 ? "s" : ""} found
        </div>
      </div>

      {/* Recipe list */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
        {isLoading ? (
          <div className="text-center py-8 text-white/60">Loading recipes...</div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-8 text-white/60">No recipes found</div>
        ) : (
          recipes.map((recipe: any) => {
            const rarityConfig = getRarityConfig(recipe.resultRarity as any);
            const isSelected = recipe.id === selectedRecipeId;

            return (
              <motion.div
                key={recipe.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => onRecipeSelect(recipe.id)}
              >
                <CometCard
                  className={cn(
                    "p-4 cursor-pointer transition-all",
                    isSelected
                      ? "ring-2 ring-purple-500 bg-purple-500/10"
                      : "hover:bg-white/5"
                  )}
                  glassDepth="interactive"
                >
                  <div className="space-y-2">
                    {/* Recipe header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-bold truncate">
                          {recipe.name}
                        </h4>
                        {recipe.description && (
                          <p className="text-white/60 text-xs line-clamp-2 mt-1">
                            {recipe.description}
                          </p>
                        )}
                      </div>

                      {/* Status badges */}
                      <div className="flex flex-col gap-1 items-end">
                        {!recipe.isUnlocked && (
                          <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-xs font-semibold">
                            Locked
                          </span>
                        )}
                        {recipe.isCompleted && (
                          <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 text-xs font-semibold">
                            ✓ {recipe.completedCount}x
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Recipe details */}
                    <div className="flex items-center gap-3 text-xs">
                      <div className="px-2 py-0.5 rounded bg-white/10 text-white/80">
                        {recipe.recipeType}
                      </div>
                      <div
                        className={cn(
                          "px-2 py-0.5 rounded font-semibold",
                          rarityConfig.borderColor.replace("border-", "bg-"),
                          "bg-opacity-20",
                          rarityConfig.color
                        )}
                      >
                        {recipe.resultRarity}
                      </div>
                    </div>

                    {/* Materials required */}
                    <div className="text-xs text-white/60">
                      Materials: {(recipe.materialsRequired as any[]).length} card
                      {(recipe.materialsRequired as any[]).length !== 1 ? "s" : ""}
                    </div>

                    {/* Costs and rewards */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="text-white/70">
                        <span className="text-yellow-400 font-semibold">
                          {recipe.ixCreditsCost.toLocaleString()}
                        </span>{" "}
                        IxCredits
                      </div>
                      <div className="text-white/70">
                        <span className="text-blue-400 font-semibold">
                          +{recipe.collectorXP}
                        </span>{" "}
                        XP
                      </div>
                    </div>

                    {/* Success rate */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className={cn(
                            "h-full rounded-full",
                            recipe.successRate >= 80
                              ? "bg-green-500"
                              : recipe.successRate >= 50
                              ? "bg-yellow-500"
                              : "bg-orange-500"
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: `${recipe.successRate}%` }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          recipe.successRate >= 80
                            ? "text-green-400"
                            : recipe.successRate >= 50
                            ? "text-yellow-400"
                            : "text-orange-400"
                        )}
                      >
                        {recipe.successRate.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </CometCard>
              </motion.div>
            );
          })
        )}
      </div>
    </CometCard>
  );
};

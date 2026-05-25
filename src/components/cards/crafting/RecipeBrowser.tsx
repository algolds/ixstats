/**
 * RecipeBrowser Component
 * Browse and filter available crafting recipes
 * Phase 3: Crafting System
 */

"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
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
    <CometCard className="space-y-4 p-6" glassDepth="child">
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
            "w-full rounded-lg px-4 py-2",
            "border border-white/20 bg-white/10",
            "text-white placeholder:text-white/40",
            "focus:ring-2 focus:ring-purple-500/50 focus:outline-none"
          )}
        />

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {(["ALL", "UNLOCKED", "LOCKED", "COMPLETED"] as RecipeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-semibold transition-colors",
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
        <div className="text-sm text-white/60">
          {total} recipe{total !== 1 ? "s" : ""} found
        </div>
      </div>

      {/* Recipe list */}
      <div className="max-h-[600px] space-y-3 overflow-y-auto pr-2">
        {isLoading ? (
          <div className="py-8 text-center text-white/60">Loading recipes...</div>
        ) : recipes.length === 0 ? (
          <div className="py-8 text-center text-white/60">No recipes found</div>
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
                    "cursor-pointer p-4 transition-all",
                    isSelected ? "bg-purple-500/10 ring-2 ring-purple-500" : "hover:bg-white/5"
                  )}
                  glassDepth="interactive"
                >
                  <div className="space-y-2">
                    {/* Recipe header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate font-bold text-white">{recipe.name}</h4>
                        {recipe.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-white/60">
                            {recipe.description}
                          </p>
                        )}
                      </div>

                      {/* Status badges */}
                      <div className="flex flex-col items-end gap-1">
                        {!recipe.isUnlocked && (
                          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300">
                            Locked
                          </span>
                        )}
                        {recipe.isCompleted && (
                          <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-300">
                            ✓ {recipe.completedCount}x
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Recipe details */}
                    <div className="flex items-center gap-3 text-xs">
                      <div className="rounded bg-white/10 px-2 py-0.5 text-white/80">
                        {recipe.recipeType}
                      </div>
                      <div
                        className={cn(
                          "rounded px-2 py-0.5 font-semibold",
                          `${rarityConfig.borderColor.replace("border-", "bg-")}/20`,
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
                        <span className="font-semibold text-yellow-400">
                          {recipe.ixCreditsCost.toLocaleString()}
                        </span>{" "}
                        IxCredits
                      </div>
                      <div className="text-white/70">
                        <span className="font-semibold text-blue-400">+{recipe.collectorXP}</span>{" "}
                        XP
                      </div>
                    </div>

                    {/* Success rate */}
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
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

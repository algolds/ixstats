"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { CraftingWorkbench } from "~/components/cards/crafting/CraftingWorkbench";
import type { CardInstance } from "~/types/cards-display";

export default function VaultCraftingPage() {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  const { data: recipesData } = api.crafting.getRecipes.useQuery({});
  const recipes = recipesData?.recipes;
  const { data: myCards } = api.cards.getMyCards.useQuery({ sortBy: "value" });

  const formattedCards: CardInstance[] =
    myCards?.map((o: any) => ({
      id: o.cards.id,
      title: o.cards.title,
      description: o.cards.description || "",
      artwork: o.cards.artwork || "/images/cards/placeholder-nation.png",
      artworkVariants: o.cards.artworkVariants || null,
      cardType: o.cards.cardType,
      rarity: o.cards.rarity,
      season: o.cards.season,
      nsCardId: o.cards.nsCardId || null,
      nsSeason: o.cards.nsSeason || null,
      nsData: o.cards.nsData || null,
      wikiSource: o.cards.wikiSource || null,
      wikiArticleTitle: o.cards.wikiArticleTitle || null,
      wikiUrl: o.cards.wikiUrl || null,
      countryId: o.cards.countryId || null,
      stats: o.cards.stats || {},
      marketValue: o.cards.marketValue || 0,
      totalSupply: o.cards.totalSupply || 0,
      level: o.level || 1,
      evolutionStage: o.cards.evolutionStage || 0,
      enhancements: o.cards.enhancements || null,
      createdAt: o.cards.createdAt,
      updatedAt: o.cards.updatedAt,
      lastTrade: o.cards.lastTrade || null,
      country: o.cards.country,
      owners: [],
    })) || [];

  return (
    <div className="space-y-4">
      {/* Recipe list */}
      <div className="glass-hierarchy-child space-y-2 rounded-xl border p-4">
        <h3 className="text-sm font-bold text-white">Select Crafting Recipe</h3>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {recipes?.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => setSelectedRecipeId(recipe.id)}
              className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                selectedRecipeId === recipe.id
                  ? "border-purple-400/50 bg-purple-500/20 text-purple-400"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              {recipe.name}
            </button>
          ))}
        </div>
      </div>

      <CraftingWorkbench recipeId={selectedRecipeId} availableCards={formattedCards} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { CraftingWorkbench } from "~/components/cards/crafting/CraftingWorkbench";
import type { CardInstance } from "~/types/cards-display";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { CARD_ARTWORK_PLACEHOLDER } from "~/lib/cards/display-utils";

export default function VaultCraftingPage() {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  const { data: recipesData } = api.crafting.getRecipes.useQuery({});
  const recipes = recipesData?.recipes;
  const { data: myCards } = api.cards.getMyCards.useQuery({ sortBy: "value" });

  const formattedCards: CardInstance[] =
    myCards?.map((o: any) => ({
      id: o.cards.id,
      // craftCard consumes ownership rows, not card definitions
      ownershipId: o.id,
      isLocked: o.isLocked ?? false,
      title: o.cards.title,
      description: o.cards.description || "",
      artwork: o.cards.artwork || CARD_ARTWORK_PLACEHOLDER,
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
      <div className="bg-surface-secondary border-separator rounded-row space-y-2 border p-4">
        <h3 className="text-headline text-label">Select crafting recipe</h3>
        <ToggleGroup
          type="single"
          disallowEmpty
          variant="pill"
          aria-label="Crafting recipe"
          value={selectedRecipeId ?? ""}
          onValueChange={(v) => v && setSelectedRecipeId(v)}
          className="flex gap-2 overflow-x-auto pb-2"
        >
          {recipes?.map((recipe) => (
            <ToggleGroupItem key={recipe.id} value={recipe.id} className="shrink-0">
              {recipe.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <CraftingWorkbench recipeId={selectedRecipeId} availableCards={formattedCards} />
    </div>
  );
}

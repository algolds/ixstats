"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { categoryLine } from "~/lib/cards/category-taxonomy";
import type { CardSheetData } from "~/lib/cards/hub/sheet";
import { SuggestCategoryDialog } from "./SuggestCategoryDialog";

interface CardSheetCategoryProps {
  card: CardSheetData["card"];
  /** Only a signed-in player can suggest a category, and never for a retired card. */
  signedIn: boolean;
}

/**
 * A lore card's category in About ("Uncategorised" when it has none) and, for a signed-in player, a quiet "Suggest a
 * category" that staff review (not on a retired card, which takes no suggestions). NS, Special and Trophy cards have
 * no category to show.
 */
export function CardSheetCategory({ card, signedIn }: CardSheetCategoryProps) {
  const [open, setOpen] = useState(false);
  if (card.cardType !== "LORE") return null;
  return (
    <p className="text-callout text-label-secondary">
      Category: {categoryLine(card.category, card.subcategory)}
      {signedIn && !card.isRetired && (
        <SuggestCategoryDialog
          open={open}
          onOpenChange={setOpen}
          cardId={card.id}
          cardTitle={card.title}
          current={{ category: card.category, subcategory: card.subcategory }}
        >
          <Button
            variant="link"
            size="sm"
            className="text-footnote text-label-secondary ml-3 h-auto px-0 align-baseline underline"
          >
            Suggest a category
          </Button>
        </SuggestCategoryDialog>
      )}
    </p>
  );
}

"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { CARD_HUB_PATHS } from "~/lib/cards/hub-routes";
import type { CardSheetData, SheetCopy } from "~/lib/cards/hub/sheet";

interface CopyActionsProps {
  copy: SheetCopy;
  card: CardSheetData["card"];
  onAddToShowcase: (ownershipId: string) => void;
}

/**
 * The actions on one held copy. Phase 4 adds fuse, dust, inscribe and the fixed-price listing here (and "Sell at
 * auction" becomes "List"); Phase 5 adds "Add to binder". A bound card is never offered for sale, and a copy already
 * in a listing or trade is not offered again.
 */
export function CopyActions({ copy, card, onAddToShowcase }: CopyActionsProps) {
  const ownershipId = copy.face.copy?.ownershipId;
  if (!ownershipId) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={() => onAddToShowcase(ownershipId)}>
        Add to showcase
      </Button>
      {!card.isBound && !copy.isLocked && (
        <Button size="sm" variant="secondary" asChild>
          <Link
            href={`${CARD_HUB_PATHS.market}?tab=selling&sell=${encodeURIComponent(ownershipId)}`}
          >
            Sell at auction
          </Link>
        </Button>
      )}
    </div>
  );
}

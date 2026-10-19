"use client";

import { useId } from "react";
import { Hammer } from "iconoir-react";
import { Button } from "~/components/ui/button";
import type { CraftOfferView } from "~/hooks/cards/useSheetEconomy";
import { useMarketActions } from "~/hooks/cards/useMarketActions";

/** The server's price: the realm's dust, plus IxC when the rarity's floor charges any. */
function craftLabel({ dust, credits }: CraftOfferView["quote"]): string {
  const cost = `${dust.toLocaleString()} dust`;
  return credits > 0
    ? `Craft for ${cost} and ${credits.toLocaleString()} IxC`
    : `Craft for ${cost}`;
}

/** Craft a Standard copy of this card from its realm's dust and IxC, or say why it can't be crafted. */
export function CraftButton({ cardId, offer }: { cardId: string; offer: CraftOfferView }) {
  const { craft } = useMarketActions(cardId);
  const hintId = useId();
  if (!offer.verdict.ok) {
    return <p className="text-footnote text-label-secondary">{offer.verdict.reason}</p>;
  }
  const short = offer.dust < offer.quote.dust;
  return (
    <div className="space-y-1">
      <Button
        variant="secondary"
        disabled={short || craft.isPending}
        aria-describedby={short ? hintId : undefined}
        onClick={() => craft.mutate({ cardId })}
      >
        <Hammer aria-hidden />
        {craftLabel(offer.quote)}
      </Button>
      {short && (
        <p id={hintId} className="text-footnote text-label-secondary">
          {`You have ${offer.dust.toLocaleString()} of the ${offer.quote.dust.toLocaleString()} dust this needs.`}
        </p>
      )}
    </div>
  );
}

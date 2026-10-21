import { cn } from "~/lib/utils/cn";
import { RARITY_LABEL } from "~/lib/cards/face/labels";
import type { CardRarity } from "~/lib/cards/face/types";

/** A rarity in running UI (rows, headers, odds): its gem in the rarity colour, then its name. */
export function RarityMark({ rarity, className }: { rarity: CardRarity; className?: string }) {
  return (
    <span
      data-card-rarity={rarity}
      className={cn("text-footnote text-label-secondary inline-flex items-center gap-1", className)}
    >
      <span aria-hidden="true" className="card-rarity-gem size-3 shrink-0" />
      {RARITY_LABEL[rarity]}
    </span>
  );
}

import Link from "next/link";
import { Trophy } from "iconoir-react";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import type { LorewardPlace, LorewardType } from "~/lib/vault/vault-bonus";
import { CONTEST_LABEL, PLACE_LABEL, wikiPageHref } from "./format";

export interface TrophyCardTile {
  id: string;
  title: string;
  contest: LorewardType;
  place: LorewardPlace;
}

interface TrophyCardsProps {
  cards: TrophyCardTile[];
  /** The card an article badge pointed to. */
  highlightCardId?: string;
}

/** The trophy cards a player holds: one one-of-one card per Loreward place. */
export function TrophyCards({ cards, highlightCardId }: TrophyCardsProps) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <li key={card.id}>
          <Card
            content="collectible"
            variant="well"
            padding="sm"
            data-highlighted={card.id === highlightCardId ? "" : undefined}
            className={cn(
              "flex items-center gap-3",
              card.id === highlightCardId && "ring-tint ring-2"
            )}
          >
            <Trophy aria-hidden className="text-tint size-5 shrink-0" />
            <div className="min-w-0">
              <Link
                href={wikiPageHref(card.title)}
                className="text-label text-headline block truncate hover:underline"
              >
                {card.title}
              </Link>
              <span className="text-label-secondary text-footnote">
                {CONTEST_LABEL[card.contest]} {PLACE_LABEL[card.place]}
              </span>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

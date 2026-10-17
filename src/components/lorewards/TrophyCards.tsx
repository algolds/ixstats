import Link from "next/link";
import { CardFace } from "~/components/cards/face/CardFace";
import { cardSheetHref } from "~/lib/cards/face/sheet-link";
import { CARD_HUB_PATHS } from "~/lib/cards/hub-routes";
import type { TrophyCardSummary } from "~/lib/lorewards/trophy-summary";
import { ixstatesLinkHref } from "~/lib/system/wikios-standalone";
import { cn } from "~/lib/utils";
import { CONTEST_LABEL, PLACE_LABEL, wikiPageHref } from "./format";

interface TrophyCardsProps {
  cards: TrophyCardSummary[];
  /** The card an article badge pointed to. */
  highlightCardId?: string;
  /** Whose trophies these are: their passport handle opens a sheet through their display, which shows its art. */
  holderHandle: string | null;
  /** The viewer's own trophies: their sheet opens in Mine. */
  own: boolean;
}

/** The trophy cards a player holds, as their faces: one one-of-one card per Loreward place. */
export function TrophyCards({ cards, highlightCardId, holderHandle, own }: TrophyCardsProps) {
  const hrefFor = (cardId: string) =>
    ixstatesLinkHref(
      own
        ? cardSheetHref(CARD_HUB_PATHS.mine, cardId)
        : cardSheetHref(
            CARD_HUB_PATHS.explore,
            cardId,
            holderHandle ? { kind: "holder", handle: holderHandle } : null
          )
    );
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-4">
      {cards.map((card) => (
        <li
          key={card.id}
          data-highlighted={card.id === highlightCardId ? "" : undefined}
          className={cn(
            "rounded-card space-y-1",
            card.id === highlightCardId && "ring-tint ring-offset-surface ring-2 ring-offset-2"
          )}
        >
          <CardFace face={card.face} size="S" className="w-full" href={hrefFor(card.id)} />
          <p className="text-footnote text-label-secondary">
            {CONTEST_LABEL[card.contest]} {PLACE_LABEL[card.place]}
          </p>
          <Link
            href={wikiPageHref(card.title)}
            aria-label={`The article, ${card.title}`}
            className="text-footnote text-tint hover:underline"
          >
            The article
          </Link>
        </li>
      ))}
    </ul>
  );
}

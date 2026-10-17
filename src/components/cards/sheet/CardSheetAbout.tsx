"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils/cn";
import { focusRing } from "~/components/ui/button";
import { cardWikiHref } from "~/components/cards/display/card-wiki-href";
import { LoreWikiExcerpt } from "~/components/cards/display/LoreWikiExcerpt";
import { NationStatesAttribution } from "~/components/cards/display/NationStatesAttribution";
import { CardTakedownVerificationModal } from "~/components/cards/display/CardTakedownVerificationModal";
import { parseCardArticleSource } from "~/lib/cards/card-sources";
import { cleanWikiUsername } from "~/lib/cards/lore-card-author-info";
import type { ArtCredit } from "~/lib/cards/face/art-credit";
import type { CardSheetData } from "~/lib/cards/hub/sheet";

const AUTHOR_STALE_MS = 60 * 60 * 1000;

/** The wiki account that wrote the article; null for a missing or placeholder name ("Unknown", "… community"). */
function cleanAuthor(raw: string | null | undefined): string | null {
  const name = cleanWikiUsername(raw);
  if (!name || /community/i.test(name) || name.toLowerCase() === "unknown") return null;
  return name;
}

/**
 * Who wrote the article: the author the importer stored, else the article's wiki asked live. A Commons file has no
 * article history to ask.
 */
function useArticleAuthor(card: CardSheetData["card"], isLore: boolean): string | null {
  const articleSource = parseCardArticleSource(card.wikiSource);
  const stored = cleanAuthor(card.author);
  const live = api.loreCards.getCardAuthorInfo.useQuery(
    { articleTitle: card.wikiArticleTitle ?? "", source: articleSource ?? "ixwiki" },
    {
      enabled: isLore && articleSource !== null && Boolean(card.wikiArticleTitle) && !stored,
      staleTime: AUTHOR_STALE_MS,
    }
  );
  return stored ?? cleanAuthor(live.data?.authorInfo?.displayAuthor);
}

function ArtCreditLine({ credit }: { credit: ArtCredit }) {
  return (
    <p className="text-footnote text-label-secondary">
      Art:{" "}
      {credit.sourceUrl ? (
        <a
          href={credit.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("underline", focusRing)}
        >
          {credit.line}
        </a>
      ) : (
        credit.line
      )}
    </p>
  );
}

/** NS cards keep NationStates' own credit and self-service takedown; every other card points to the help. */
function Takedown({ card }: { card: CardSheetData["card"] }) {
  const [open, setOpen] = useState(false);
  if (!card.ns) {
    return (
      <p className="text-footnote">
        <Link
          href="/help/vault/lore-cards#takedowns"
          className={cn("text-tint underline", focusRing)}
        >
          How to ask for a takedown
        </Link>
      </p>
    );
  }
  return (
    <>
      <NationStatesAttribution onRequestTakedown={() => setOpen(true)} />
      <CardTakedownVerificationModal
        isOpen={open}
        onClose={() => setOpen(false)}
        cardId={card.id}
        cardTitle={card.title}
        season={card.ns.season}
        onTakedownSuccess={() => setOpen(false)}
      />
    </>
  );
}

/** "About": the lore excerpt and wiki link, the author and art credit, and the takedown link. */
export function CardSheetAbout({ card }: { card: CardSheetData["card"] }) {
  // A legacy Commons card has no title but still links to its file page.
  const isLore =
    card.cardType === "LORE" && (Boolean(card.wikiArticleTitle) || card.wikiSource === "commons");
  const writer = useArticleAuthor(card, isLore);
  const wikiUrl = cardWikiHref({
    wikiSource: card.wikiSource,
    wikiArticleTitle: card.wikiArticleTitle,
    descriptionUrl: card.descriptionUrl,
  });

  return (
    <section aria-labelledby="sheet-about" className="space-y-3">
      <h3 id="sheet-about" className="text-headline">
        About
      </h3>
      {isLore ? (
        <LoreWikiExcerpt card={card} wikiUrl={wikiUrl} />
      ) : (
        card.description && <p className="text-callout text-label-secondary">{card.description}</p>
      )}
      {writer && <p className="text-footnote text-label-secondary">Article by {writer}</p>}
      {card.artCredit && <ArtCreditLine credit={card.artCredit} />}
      <Takedown card={card} />
    </section>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldAlert } from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils/cn";
import { Button, focusRing } from "~/components/ui/button";
import { cardWikiHref } from "~/components/cards/display/card-wiki-href";
import { LoreWikiExcerpt } from "~/components/cards/display/LoreWikiExcerpt";
import { NationStatesAttribution } from "~/components/cards/display/NationStatesAttribution";
import { CardTakedownVerificationModal } from "~/components/cards/display/CardTakedownVerificationModal";
import { ArtCreditLine } from "~/components/cards/face/ArtCreditLine";
import { parseCardArticleSource } from "~/lib/cards/card-sources";
import { cleanWikiUsername } from "~/lib/cards/lore-card-author-info";
import type { CardSheetData } from "~/lib/cards/hub/sheet";
import { RequestTakedownDialog } from "./RequestTakedownDialog";

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

/**
 * NS cards keep NationStates' own credit and self-service takedown. A signed-in player asks for any other card to come
 * down from here; a visitor is pointed to the help.
 */
function Takedown({ card, signedIn }: { card: CardSheetData["card"]; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  if (!card.ns && signedIn) {
    return (
      <RequestTakedownDialog
        open={open}
        onOpenChange={setOpen}
        cardId={card.id}
        cardTitle={card.title}
      >
        <Button variant="link" size="sm" className="h-auto px-0">
          <ShieldAlert />
          Request a takedown
        </Button>
      </RequestTakedownDialog>
    );
  }
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

interface CardSheetAboutProps {
  card: CardSheetData["card"];
  /** The viewer may not see the card's art (a silhouette or a retired card): nothing here may show or link it. */
  artHidden: boolean;
  /** Only a signed-in player can request a takedown here. */
  signedIn: boolean;
}

/** "About": the lore excerpt and wiki link, the author and art credit, and the takedown action. */
export function CardSheetAbout({ card, artHidden, signedIn }: CardSheetAboutProps) {
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
        <LoreWikiExcerpt card={card} wikiUrl={wikiUrl} artHidden={artHidden} />
      ) : (
        card.description && <p className="text-callout text-label-secondary">{card.description}</p>
      )}
      {writer && <p className="text-footnote text-label-secondary">Article by {writer}</p>}
      {card.artCredit && (
        <ArtCreditLine credit={card.artCredit} label="Art:" className="text-footnote" />
      )}
      <Takedown card={card} signedIn={signedIn} />
    </section>
  );
}

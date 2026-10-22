"use client";

import { Fragment, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { InfoCircle } from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils/cn";
import { refocus } from "~/lib/utils/focus";
import { Button, focusRing } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Tooltip } from "~/components/ui/tooltip";
import { cardWikiHref } from "~/components/cards/display/card-wiki-href";
import { LoreWikiExcerpt } from "~/components/cards/display/LoreWikiExcerpt";
import { NationStatesDataCredit } from "~/components/cards/display/NationStatesAttribution";
import { CardTakedownVerificationModal } from "~/components/cards/display/CardTakedownVerificationModal";
import { ArtCreditLine } from "~/components/cards/face/ArtCreditLine";
import { parseCardArticleSource } from "~/lib/cards/card-sources";
import type { NsProvenance } from "~/lib/cards/face/ns-provenance";
import { cleanWikiUsername } from "~/lib/cards/lore-card-author-info";
import type { CardSheetData } from "~/lib/cards/hub/sheet";
import { RequestTakedownDialog } from "./RequestTakedownDialog";

const AUTHOR_STALE_MS = 60 * 60 * 1000;

const NS_DATA = "About NationStates data";

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

/** An NS card's NationStates facts, then its page there. */
function NsFacts({ ns }: { ns: NsProvenance }) {
  const facts = [ns.nation, ns.season ? `season ${ns.season}` : null, ns.region, ns.category];
  return (
    <p className="text-callout text-label-secondary">
      {facts.filter(Boolean).join(" · ")} ·{" "}
      <a
        href={ns.cardUrl ?? ns.nationUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("text-tint underline", focusRing)}
      >
        View on NationStates
      </a>
    </p>
  );
}

interface NsDataInfoProps {
  triggerRef: RefObject<HTMLButtonElement | null>;
  onTakedown: () => void;
}

/**
 * The (i) at the end of an NS card's credits: NationStates' own credit and disclaimer, and its self-service takedown,
 * which proves the nation is the asker's.
 */
function NsDataInfo({ triggerRef, onTakedown }: NsDataInfoProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content={NS_DATA} disabled={open}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            size="icon-sm"
            variant="ghost"
            aria-label={NS_DATA}
            className="text-label-secondary -my-1 align-middle"
          >
            <InfoCircle aria-hidden />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent aria-label={NS_DATA} className="text-footnote text-label-secondary space-y-3">
        <p>
          <NationStatesDataCredit linkClassName={cn("underline", focusRing)} />
        </p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setOpen(false);
            onTakedown();
          }}
        >
          Verify & request takedown
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/**
 * One caption for the article's author, the art and its licence; an NS card's ends with its (i). The NS takedown's
 * dialog opens as the popover closes, so focus comes back to the (i) once the dialog closes.
 */
function Credits({ card, writer }: { card: CardSheetData["card"]; writer: string | null }) {
  const [takedown, setTakedown] = useState(false);
  const info = useRef<HTMLButtonElement>(null);
  const parts: ReactNode[] = [];
  if (writer) parts.push(`Article by ${writer}`);
  if (card.artCredit) parts.push(<ArtCreditLine credit={card.artCredit} label="Art:" />);
  if (parts.length === 0 && !card.ns) return null;
  return (
    <>
      <p className="text-footnote text-label-secondary">
        {parts.map((part, index) => (
          <Fragment key={index}>
            {index > 0 && " · "}
            {part}
          </Fragment>
        ))}
        {card.ns && (
          <>
            {parts.length > 0 && " "}
            <NsDataInfo triggerRef={info} onTakedown={() => setTakedown(true)} />
          </>
        )}
      </p>
      {card.ns && (
        <CardTakedownVerificationModal
          isOpen={takedown}
          onClose={() => setTakedown(false)}
          cardId={card.id}
          cardTitle={card.title}
          season={card.ns.season}
          onTakedownSuccess={() => setTakedown(false)}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            refocus(info.current);
          }}
        />
      )}
    </>
  );
}

/** Any card but an NS one: a signed-in player asks for it to come down from here; a visitor is pointed to the help. */
function Takedown({ card, signedIn }: { card: CardSheetData["card"]; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  if (signedIn) {
    return (
      <RequestTakedownDialog
        open={open}
        onOpenChange={setOpen}
        cardId={card.id}
        cardTitle={card.title}
      >
        <Button
          variant="link"
          size="sm"
          className="text-footnote text-label-secondary h-auto px-0 underline"
        >
          Request a takedown
        </Button>
      </RequestTakedownDialog>
    );
  }
  return (
    <p className="text-footnote">
      <Link
        href="/help/vault/lore-cards#takedowns"
        className={cn("text-label-secondary underline", focusRing)}
      >
        How to ask for a takedown
      </Link>
    </p>
  );
}

interface CardSheetAboutProps {
  card: CardSheetData["card"];
  /** The card is retired, so its art shows nowhere and nothing here may show or link it; shown art is credited. */
  artHidden: boolean;
  /** Only a signed-in player can request a takedown here. */
  signedIn: boolean;
}

/**
 * "About": the lore excerpt and wiki link, an NS card's NationStates facts, one credits caption, and the takedown
 * action, which for an NS card sits behind the caption's (i).
 */
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
      {card.ns && <NsFacts ns={card.ns} />}
      <Credits card={card} writer={writer} />
      {!card.ns && <Takedown card={card} signedIn={signedIn} />}
    </section>
  );
}

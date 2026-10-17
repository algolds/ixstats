"use client";

import Link from "next/link";
import { Lock } from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { focusRing } from "~/components/ui/button";
import { FINISH_LABEL } from "~/lib/cards/face/labels";
import { CARD_HUB_PATHS } from "~/lib/cards/hub-routes";
import type { CardSheetData, SheetCopy } from "~/lib/cards/hub/sheet";
import { CopyActions } from "./CopyActions";

interface CardSheetCopiesProps {
  card: CardSheetData["card"];
  realmName: string;
  copies: SheetCopy[];
  onAddToShowcase: (ownershipId: string) => void;
}

/** "Your copies": each copy with its serial, finish, level and actions; or how to get the card. */
export function CardSheetCopies({
  card,
  realmName,
  copies,
  onAddToShowcase,
}: CardSheetCopiesProps) {
  return (
    <section aria-labelledby="sheet-copies" className="space-y-3">
      <h3 id="sheet-copies" className="text-headline">
        Your copies
      </h3>
      {card.isBound && copies.length > 0 && (
        <p className="text-footnote text-label-secondary">Bound to your account</p>
      )}
      {copies.length === 0 ? (
        <HowToGet card={card} realmName={realmName} />
      ) : (
        <ul className="divide-separator divide-y">
          {copies.map((copy) => (
            <CopyRow
              key={copy.face.copy?.ownershipId ?? copy.face.cardId}
              copy={copy}
              card={card}
              onAddToShowcase={onAddToShowcase}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * For a card the viewer does not hold: where it comes from, and the market for one that can be bought. A retired card
 * no longer comes from anywhere, so nothing is said.
 */
function HowToGet({ card, realmName }: { card: CardSheetData["card"]; realmName: string }) {
  if (card.isRetired) {
    return <p className="text-callout text-label-secondary">You do not have this card yet.</p>;
  }
  if (card.isBound) {
    return (
      <p className="text-callout text-label-secondary">
        You do not have this card yet. It is earned as a reward, and never traded or sold.
      </p>
    );
  }
  return (
    <p className="text-callout text-label-secondary">
      You do not have this card yet. It comes in {realmName} packs, on the market and in trades.{" "}
      <Link
        href={`${CARD_HUB_PATHS.market}?for=${encodeURIComponent(card.id)}`}
        className={cn("text-tint underline", focusRing)}
      >
        See it in the market
      </Link>
    </p>
  );
}

function CopyRow({
  copy,
  card,
  onAddToShowcase,
}: {
  copy: SheetCopy;
  card: CardSheetData["card"];
  onAddToShowcase: (ownershipId: string) => void;
}) {
  const facts = copy.face.copy;
  if (!facts) return null;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="text-callout tabular-nums">
        <p className="text-label">
          #{facts.serialNumber} · {FINISH_LABEL[facts.finish]} · Level {facts.level}
        </p>
        <p className="text-footnote text-label-secondary flex flex-wrap items-center gap-x-2">
          <span>Since {copy.acquiredAt.toLocaleDateString()}</span>
          {copy.isLocked && (
            <span className="inline-flex items-center gap-1">
              <Lock aria-hidden className="size-3" />
              In a listing or trade
            </span>
          )}
        </p>
      </div>
      <CopyActions copy={copy} card={card} onAddToShowcase={onAddToShowcase} />
    </li>
  );
}

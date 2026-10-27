"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowSeparate, Package, Shop } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { ValueSelect } from "~/components/ui/value-select";
import { copyPicker, type HeldCopy } from "~/lib/cards/face/copy-pick";
import { CARD_HUB_PATHS, marketTabHref, STORE_PATH } from "~/lib/cards/hub-routes";
import type { CardSheetData, SheetCopy } from "~/lib/cards/hub/sheet";
import { withQuery } from "~/lib/utils/with-query";
import { COPIES_HEADING_ID, copyLabel, CopyActions } from "./CopyActions";

interface CardSheetCopiesProps {
  card: CardSheetData["card"];
  /** The viewer's copies, best first. */
  held: HeldCopy<SheetCopy>[];
  picked: HeldCopy<SheetCopy> | null;
  onPick: (ownershipId: string) => void;
  onAddToShowcase: (ownershipId: string) => void;
}

/** "Your copies": a picker over the viewer's copies and the picked copy's action bar; or where to get the card. */
export function CardSheetCopies({
  card,
  held,
  picked,
  onPick,
  onAddToShowcase,
}: CardSheetCopiesProps) {
  return (
    <section aria-labelledby={COPIES_HEADING_ID} className="space-y-3">
      {/* Focusable from script only: focus lands here once a break down or fusion takes the picked copy away. */}
      <h3 id={COPIES_HEADING_ID} tabIndex={-1} className="text-headline">
        Your copies
      </h3>
      {card.isBound && picked && (
        <p className="text-footnote text-label-secondary">Bound to your account</p>
      )}
      {picked ? (
        <>
          <CopyPicker held={held} picked={picked} onPick={onPick} />
          <CopyActions
            key={picked.facts.ownershipId}
            held={picked}
            card={card}
            onAddToShowcase={onAddToShowcase}
          />
        </>
      ) : (
        <HowToGet card={card} />
      )}
    </section>
  );
}

interface CopyPickerProps {
  held: HeldCopy<SheetCopy>[];
  picked: HeldCopy<SheetCopy>;
  onPick: (ownershipId: string) => void;
}

/** Chips for a few copies, one dropdown for many, and nothing for one. */
function CopyPicker({ held, picked, onPick }: CopyPickerProps) {
  const kind = copyPicker(held.length);
  if (kind === "none") return null;
  if (kind === "menu") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <ValueSelect
          aria-label="Pick a copy"
          size="sm"
          value={picked.facts.ownershipId}
          onValueChange={onPick}
          options={held.map((h) => [h.facts.ownershipId, copyLabel(h.facts)] as const)}
        />
        <span className="text-footnote text-label-secondary tabular-nums">
          {held.length} copies
        </span>
      </div>
    );
  }
  return (
    <RadioCardGroup
      aria-label="Pick a copy"
      value={picked.facts.ownershipId}
      onValueChange={onPick}
      className="flex flex-wrap gap-2"
    >
      {held.map((h) => (
        <RadioCard
          key={h.facts.ownershipId}
          value={h.facts.ownershipId}
          indicator={false}
          className="text-footnote w-auto items-center rounded-full px-3 py-1 tabular-nums"
        >
          {copyLabel(h.facts)}
        </RadioCard>
      ))}
    </RadioCardGroup>
  );
}

/** A chip that links to where the card can be got. */
function WhereChip({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Button size="sm" variant="secondary" className="rounded-full" asChild>
      <Link href={href}>
        {icon}
        {label}
      </Link>
    </Button>
  );
}

/**
 * For a card the viewer does not hold: where to get it. A retired card no longer comes from anywhere, so nothing is
 * said, a bound one is only earned, and packs never draw a Special card (`packPoolWhere`).
 */
function HowToGet({ card }: { card: CardSheetData["card"] }) {
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
    <div role="group" aria-label="Get this card" className="flex flex-wrap gap-2">
      {card.cardType !== "SPECIAL" && (
        <WhereChip
          href={withQuery(STORE_PATH, { view: "packs" })}
          icon={<Package aria-hidden />}
          label="Packs"
        />
      )}
      <WhereChip
        href={`${CARD_HUB_PATHS.market}?for=${encodeURIComponent(card.id)}`}
        icon={<Shop aria-hidden />}
        label="Market"
      />
      <WhereChip
        href={marketTabHref("trades")}
        icon={<ArrowSeparate aria-hidden />}
        label="Trades"
      />
    </div>
  );
}

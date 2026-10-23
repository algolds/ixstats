"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowSeparate, Calendar, Combine, EditPencil, Lock, Shop, Trash } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Tooltip } from "~/components/ui/tooltip";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import {
  useSheetEconomy,
  type CopyEconomyView,
  type FusionGroupView,
} from "~/hooks/cards/useSheetEconomy";
import type { HeldCopy } from "~/lib/cards/face/copy-pick";
import { FINISH_LABEL } from "~/lib/cards/face/labels";
import type { CardCopyFacts } from "~/lib/cards/face/types";
import { CARD_HUB_PATHS, marketTabHref, tradeBuilderHref } from "~/lib/cards/hub-routes";
import type { CardSheetData, SheetCopy } from "~/lib/cards/hub/sheet";
import { BreakDownDialog } from "./economy/BreakDownDialog";
import { useDialogFocus, type DialogFocus } from "./economy/dialog-focus";
import { FuseDialog } from "./economy/FuseDialog";
import { ListCopyDialog } from "./economy/ListCopyDialog";
import { SignDialog } from "./economy/SignDialog";

/** The "Your copies" heading, where focus goes once a burn takes the picked copy away. */
export const COPIES_HEADING_ID = "sheet-copies";

type Open = "list" | "fuse" | "breakdown" | "sign" | null;

/**
 * What the Sell group holds: the sale actions for a free copy; for a locked one, where it already is (Selling for a
 * listing or an auction, else Trades, as only a trade offer locks a copy otherwise); nothing for a bound card, which is
 * never sold, nor for a locked copy until the economy says where it is.
 */
type Sale = "sell" | "selling" | "trades" | null;

function saleOf(isBound: boolean, isLocked: boolean, economy: CopyEconomyView | null): Sale {
  if (isBound) return null;
  if (!isLocked) return "sell";
  if (!economy) return null;
  return (economy.listingId ?? economy.auctionId) === null ? "trades" : "selling";
}

/** A copy by its serial, finish and level. */
export const copyLabel = (facts: CardCopyFacts) =>
  `#${facts.serialNumber} · ${FINISH_LABEL[facts.finish]} · Level ${facts.level}`;

const dated = (date: Date, month: "short" | "long") =>
  date.toLocaleDateString(undefined, { day: "numeric", month, year: "numeric" });

interface CopyActionsProps {
  held: HeldCopy<SheetCopy>;
  card: CardSheetData["card"];
  onAddToShowcase: (ownershipId: string) => void;
}

/**
 * The action bar for the picked copy, headed by its serial, finish, level, value and facts, in three groups: Sell
 * (list at a fixed price, sell at auction, offer in a trade), Workshop (fuse, break down for dust) and Keep (add to a
 * showcase, sign). A group with nothing to offer is left out. What a copy allows, and what it is worth, come from the
 * server (`cards.getSheetEconomy`); until that arrives only the auction, the trade and the showcase show.
 */
export function CopyActions({ held, card, onAddToShowcase }: CopyActionsProps) {
  const { data } = useSheetEconomy(card.id);
  const [open, setOpen] = useState<Open>(null);
  const { focus, settle } = useDialogFocus();
  const showcaseButton = useRef<HTMLButtonElement>(null);
  const headId = useId();
  const { copy, facts } = held;
  const ownershipId = facts.ownershipId;
  const economy = data?.copies.find((c) => c.ownershipId === ownershipId) ?? null;
  const group = data?.fusionGroups.find((g) => g.ownershipIds.includes(ownershipId)) ?? null;
  const sale = saleOf(card.isBound, copy.isLocked, economy);
  // A burn takes the copy away; a listing or a signature only the button that opened the dialog.
  const done = (burned: boolean) => () => {
    settle(burned ? document.getElementById(COPIES_HEADING_ID) : showcaseButton.current);
    setOpen(null);
  };

  return (
    <div role="group" aria-labelledby={headId} className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p id={headId} className="text-callout text-label tabular-nums">
          {copyLabel(facts)}
        </p>
        {economy && <CopyValue value={economy.value} retired={card.isRetired} />}
        <FactChip
          icon={<Calendar aria-hidden />}
          label={`Since ${dated(copy.acquiredAt, "short")}`}
          hint={`In your collection since ${dated(copy.acquiredAt, "long")}`}
        />
        {copy.isLocked && (
          <FactChip icon={<Lock aria-hidden />} label="Locked" hint="In a listing or trade" />
        )}
      </div>
      {/* The groups stack on a phone, and sit side by side from sm up. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6">
        <SellGroup
          sale={sale}
          ownershipId={ownershipId}
          onList={economy ? () => setOpen("list") : null}
        />
        {economy && <WorkshopGroup economy={economy} group={group} onOpen={setOpen} />}
        <ActionGroup label="Keep">
          <Button
            ref={showcaseButton}
            size="sm"
            variant="secondary"
            onClick={() => onAddToShowcase(ownershipId)}
          >
            Add to showcase
          </Button>
          {economy?.canSign && (
            <Button size="sm" variant="secondary" onClick={() => setOpen("sign")}>
              <EditPencil aria-hidden />
              Sign
            </Button>
          )}
        </ActionGroup>
      </div>
      {data && economy && (
        <CopyDialogs
          open={open}
          onClose={() => setOpen(null)}
          done={done}
          focus={focus}
          card={card}
          ownershipId={ownershipId}
          economy={economy}
          group={group}
          signerName={data.signerName}
        />
      )}
    </div>
  );
}

interface SellGroupProps {
  sale: Sale;
  ownershipId: string;
  /** Listing needs the copy's value to suggest a price, so it waits for the economy. */
  onList: (() => void) | null;
}

function SellGroup({ sale, ownershipId, onList }: SellGroupProps) {
  if (sale === null) return null;
  // A copy on sale, at auction or offered is managed, and cancelled, where it is.
  if (sale !== "sell") {
    return (
      <ActionGroup label="Sell">
        <Button size="sm" variant="secondary" asChild>
          <Link href={marketTabHref(sale)}>
            {sale === "selling" ? "See it in Selling" : "See it in Trades"}
          </Link>
        </Button>
      </ActionGroup>
    );
  }
  return (
    <ActionGroup label="Sell">
      {onList && (
        <Button size="sm" variant="secondary" onClick={onList}>
          <Shop aria-hidden />
          List
        </Button>
      )}
      <Button size="sm" variant="secondary" asChild>
        <Link href={`${CARD_HUB_PATHS.market}?tab=selling&sell=${encodeURIComponent(ownershipId)}`}>
          Auction
        </Link>
      </Button>
      <Button size="sm" variant="secondary" asChild>
        <Link href={tradeBuilderHref({ give: ownershipId })}>
          <ArrowSeparate aria-hidden />
          Trade
        </Link>
      </Button>
    </ActionGroup>
  );
}

interface WorkshopGroupProps {
  economy: CopyEconomyView;
  group: FusionGroupView | null;
  onOpen: (open: Open) => void;
}

function WorkshopGroup({ economy, group, onOpen }: WorkshopGroupProps) {
  const breaks = economy.breakdownBlocker === null;
  if (!group && !breaks) return null;
  return (
    <ActionGroup label="Workshop">
      {group && (
        <Button size="sm" variant="secondary" onClick={() => onOpen("fuse")}>
          <Combine aria-hidden />
          Fuse
        </Button>
      )}
      {breaks && (
        <Button size="sm" variant="secondary" onClick={() => onOpen("breakdown")}>
          <Trash aria-hidden />
          Break down
        </Button>
      )}
    </ActionGroup>
  );
}

function ActionGroup({ label, children }: { label: string; children: ReactNode }) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="space-y-1">
      <p id={labelId} className="text-footnote text-label-secondary">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/**
 * A fact about the copy: an icon and a short label, shown so a keyboard user reads it too, with the longer phrasing in
 * a tooltip.
 */
function FactChip({ icon, label, hint }: { icon: ReactNode; label: string; hint: string }) {
  return (
    <Tooltip content={hint}>
      <span className="bg-fill-3 text-label-secondary text-caption inline-flex h-6 items-center gap-1 rounded-full px-2 tabular-nums [&_svg]:size-3.5 [&_svg]:shrink-0">
        {icon}
        {label}
      </span>
    </Tooltip>
  );
}

/** The copy's value, from the server; a retired card's copies are worth nothing, and say why. */
function CopyValue({ value, retired }: { value: number; retired: boolean }) {
  return (
    <span className="text-callout text-label-secondary inline-flex items-center gap-1 tabular-nums">
      {retired && <span className="text-footnote mr-1">Retired</span>}
      <IxCreditsSymbol className="size-[0.8em]" />
      <span>{value.toLocaleString()}</span>
    </span>
  );
}

interface CopyDialogsProps {
  open: Open;
  onClose: () => void;
  done: (burned: boolean) => () => void;
  focus: DialogFocus;
  card: CardSheetData["card"];
  ownershipId: string;
  economy: CopyEconomyView;
  group: FusionGroupView | null;
  signerName: string | null;
}

/**
 * A dialog mounts only while open: each opening starts from the copy's value and an empty inscription, and the sheet
 * holds no closed dialogs (each one carries the copy mutations).
 */
function CopyDialogs({
  open,
  onClose,
  done,
  economy,
  group,
  signerName,
  ...rest
}: CopyDialogsProps) {
  const shared = {
    cardTitle: rest.card.title,
    ownershipId: rest.ownershipId,
    focus: rest.focus,
    onOpenChange: (next: boolean) => {
      if (!next) onClose();
    },
  };
  return (
    <>
      {open === "list" && (
        <ListCopyDialog {...shared} open onDone={done(false)} suggestedPrice={economy.value} />
      )}
      {open === "breakdown" && (
        <BreakDownDialog {...shared} open onDone={done(true)} dust={economy.dust} />
      )}
      {open === "fuse" && group && (
        <FuseDialog {...shared} open onDone={done(true)} group={group} />
      )}
      {open === "sign" && (
        <SignDialog {...shared} open onDone={done(false)} signerName={signerName} />
      )}
    </>
  );
}

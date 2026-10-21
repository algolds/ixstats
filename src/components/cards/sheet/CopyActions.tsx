"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowSeparate, Combine, EditPencil, Shop, Trash } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import {
  useSheetEconomy,
  type CopyEconomyView,
  type FusionGroupView,
} from "~/hooks/cards/useSheetEconomy";
import { CARD_HUB_PATHS, tradeBuilderHref } from "~/lib/cards/hub-routes";
import type { CardSheetData, SheetCopy } from "~/lib/cards/hub/sheet";
import { BreakDownDialog } from "./economy/BreakDownDialog";
import { useDialogFocus, type DialogFocus } from "./economy/dialog-focus";
import { FuseDialog } from "./economy/FuseDialog";
import { ListCopyDialog } from "./economy/ListCopyDialog";
import { SignDialog } from "./economy/SignDialog";

/** The "Your copies" heading, where focus goes once a burn takes the copy's row away. */
export const COPIES_HEADING_ID = "sheet-copies";

type Open = "list" | "fuse" | "breakdown" | "sign" | null;

interface CopyActionsProps {
  copy: SheetCopy;
  card: CardSheetData["card"];
  onAddToShowcase: (ownershipId: string) => void;
}

/**
 * The actions on one held copy (spec §2.3 Detail sheet): add to a showcase, list at a fixed price or sell at auction,
 * fuse, break down for dust, and sign. Phase 5 adds "Add to binder". A bound card is never offered for sale (spec
 * §2.1 Bound cards), and a copy already in a listing or trade is not offered again. What a copy allows, and what it is
 * worth, come from the server (`cards.getSheetEconomy`); until that arrives only the showcase and the auction form show.
 */
export function CopyActions({ copy, card, onAddToShowcase }: CopyActionsProps) {
  const { data } = useSheetEconomy(card.id);
  const [open, setOpen] = useState<Open>(null);
  const { focus, settle } = useDialogFocus();
  const showcaseButton = useRef<HTMLButtonElement>(null);
  const ownershipId = copy.face.copy?.ownershipId;
  if (!ownershipId) return null;
  const economy = data?.copies.find((c) => c.ownershipId === ownershipId) ?? null;
  const group = data?.fusionGroups.find((g) => g.ownershipIds.includes(ownershipId)) ?? null;
  const sellable = !card.isBound && !copy.isLocked;
  // A burn takes the copy's whole row away; a listing or a signature only the button that opened the dialog.
  const done = (burned: boolean) => () => {
    settle(burned ? document.getElementById(COPIES_HEADING_ID) : showcaseButton.current);
    setOpen(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {economy && <CopyValue value={economy.value} retired={card.isRetired} />}
      <Button
        ref={showcaseButton}
        size="sm"
        variant="secondary"
        onClick={() => onAddToShowcase(ownershipId)}
      >
        Add to showcase
      </Button>
      {sellable && economy && (
        <Button size="sm" variant="secondary" onClick={() => setOpen("list")}>
          <Shop aria-hidden />
          List
        </Button>
      )}
      {sellable && <AuctionLink ownershipId={ownershipId} />}
      {sellable && (
        <Button size="sm" variant="ghost" asChild>
          <Link href={tradeBuilderHref({ give: ownershipId })}>
            <ArrowSeparate aria-hidden />
            Offer in a trade
          </Link>
        </Button>
      )}
      {economy && <WorkshopButtons economy={economy} group={group} onOpen={setOpen} />}
      {economy && (economy.listingId ?? economy.auctionId) !== null && <SellingLink />}
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

function AuctionLink({ ownershipId }: { ownershipId: string }) {
  return (
    <Button size="sm" variant="secondary" asChild>
      <Link href={`${CARD_HUB_PATHS.market}?tab=selling&sell=${encodeURIComponent(ownershipId)}`}>
        Sell at auction
      </Link>
    </Button>
  );
}

/** A copy on sale or at auction is managed, and cancelled, from the Selling tab. */
function SellingLink() {
  return (
    <Button size="sm" variant="ghost" asChild>
      <Link href={`${CARD_HUB_PATHS.market}?tab=selling`}>See it in Selling</Link>
    </Button>
  );
}

interface WorkshopButtonsProps {
  economy: CopyEconomyView;
  group: FusionGroupView | null;
  onOpen: (open: Open) => void;
}

function WorkshopButtons({ economy, group, onOpen }: WorkshopButtonsProps) {
  return (
    <>
      {group && (
        <Button size="sm" variant="secondary" onClick={() => onOpen("fuse")}>
          <Combine aria-hidden />
          Fuse
        </Button>
      )}
      {economy.breakdownBlocker === null && (
        <Button size="sm" variant="ghost" onClick={() => onOpen("breakdown")}>
          <Trash aria-hidden />
          Break down
        </Button>
      )}
      {economy.canSign && (
        <Button size="sm" variant="ghost" onClick={() => onOpen("sign")}>
          <EditPencil aria-hidden />
          Sign
        </Button>
      )}
    </>
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
 * A dialog mounts only while open: each opening starts from the copy's value and an empty inscription, and a sheet with
 * many copies holds no closed dialogs (each one carries the copy mutations).
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

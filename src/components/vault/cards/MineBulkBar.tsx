"use client";

import { useId, useState, type RefObject } from "react";
import { Combine, Shop, Trash } from "iconoir-react";
import type { CardFinish } from "@prisma/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import { useDialogFocus, type DialogFocus } from "~/components/cards/sheet/economy/dialog-focus";
import { FuseDialog } from "~/components/cards/sheet/economy/FuseDialog";
import { useCopyActions } from "~/hooks/cards/useCopyActions";
import { useEconomyNumbers } from "~/hooks/cards/useSheetEconomy";
import {
  copyBlocker,
  dustYield,
  fusionBlocker,
  MAX_WORKSHOP_COPIES,
  type WorkshopCopy,
} from "~/lib/cards/dust";
import type { CardEconomyConfig } from "~/lib/cards/economy-config";
import { nextFinish } from "~/lib/cards/finish";
import type { MineRow } from "~/lib/cards/hub/mine";
import { MAX_BULK_LISTINGS } from "~/lib/cards/market/fees";
import { cn } from "~/lib/utils/cn";
import { BulkListDialog, copiesLabel } from "./BulkListDialog";

export interface SelectedCopy extends WorkshopCopy {
  ownershipId: string;
  title: string;
  /** Tells copies of one card apart in the bulk list. */
  serialNumber: number;
  value: number;
}

/**
 * A Mine row as the bulk actions judge it; null for a row without a copy. A copy a pending trade offer names counts as
 * locked, as the workshop counts it (`judgedCopiesTx`).
 */
export function selectedCopyOf(row: MineRow): SelectedCopy | null {
  const copy = row.face.copy;
  if (!copy) return null;
  return {
    ownershipId: copy.ownershipId,
    cardId: row.face.cardId,
    title: row.face.title,
    serialNumber: copy.serialNumber,
    value: row.value,
    rarity: row.face.rarity,
    finish: copy.finish,
    importDiscounted: row.importDiscounted,
    inscription: row.inscription,
    isLocked: row.isLocked || row.inOffer,
    isBound: row.isBound,
  };
}

interface FusePlan {
  from: CardFinish;
  to: CardFinish;
  title: string;
}

/** What the selection allows. The server refuses the same copies; these say why first. */
interface BulkPlan {
  dust: number;
  /** Fusing is offered only when the selection fuses. */
  fuse: FusePlan | null;
  /** Null when a copy is bound or locked (listing is not offered); else why listing is off, or null. */
  list: { blocker: string | null } | null;
  breakDownBlocker: string | null;
}

function planBulk(copies: SelectedCopy[], economy: CardEconomyConfig): BulkPlan {
  const [first] = copies;
  const to = first ? nextFinish(first.finish) : null;
  const listable = copies.every((c) => !c.isBound && !c.isLocked);
  const tooMany = (max: number, verb: string) =>
    copies.length > max ? `${verb} up to ${max} copies at a time.` : null;
  return {
    dust: copies.reduce((sum, c) => sum + dustYield(c, economy), 0),
    fuse:
      first && to && fusionBlocker(copies, economy) === null
        ? { from: first.finish, to, title: first.title }
        : null,
    list: listable ? { blocker: tooMany(MAX_BULK_LISTINGS, "List") } : null,
    breakDownBlocker:
      tooMany(MAX_WORKSHOP_COPIES, "Break down") ??
      copies.map((c) => copyBlocker(c, "break down")).find((r) => r !== null) ??
      null,
  };
}

interface MineBulkBarProps {
  copies: SelectedCopy[];
  onAddToShowcase: () => void;
  /** Ends select mode: Done, or a bulk action that went through. */
  onDone: () => void;
  /** Where focus goes once a bulk action ends select mode, since the bar leaves with it. */
  focusAfter?: RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * Select mode's actions, held above the tab bar while the grid scrolls (spec §2.3 Mine): add to a showcase, fuse, list
 * and break down. Phase 5 adds binders. The count, and why an action is off, are announced as the picks change.
 */
export function MineBulkBar({
  copies,
  onAddToShowcase,
  onDone,
  focusAfter,
  className,
}: MineBulkBarProps) {
  const { data: numbers } = useEconomyNumbers();
  const id = useId();
  const plan = numbers && copies.length > 0 ? planBulk(copies, numbers.economy) : null;
  const reasons = {
    list: plan?.list?.blocker ? `${id}-list` : undefined,
    breakDown: plan?.breakDownBlocker ? `${id}-breakdown` : undefined,
  };
  return (
    <FacetMaterial
      role="group"
      aria-label="Selected cards"
      className={cn(
        "z-chrome sticky bottom-[calc(var(--shell-tabbar-height)+0.5rem)] flex flex-wrap items-center gap-2 p-2",
        className
      )}
    >
      <span aria-live="polite" className="text-callout px-2 tabular-nums">
        {copies.length} selected
      </span>
      <Button size="sm" disabled={copies.length === 0} onClick={onAddToShowcase}>
        Add to showcase
      </Button>
      {plan && (
        <WorkshopActions
          copies={copies}
          plan={plan}
          reasons={reasons}
          onDone={onDone}
          focusAfter={focusAfter}
        />
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          // The bar leaves with select mode; focus goes where the pane says, not to the page body.
          focusAfter?.current?.focus();
          onDone();
        }}
      >
        Done
      </Button>
      {/* Always present, so a reason that appears is announced; while empty it cancels its row's gap. */}
      <span
        aria-live="polite"
        className="text-footnote text-label-secondary flex w-full flex-col px-2 empty:-mt-2"
      >
        {reasons.breakDown && <span id={reasons.breakDown}>{plan?.breakDownBlocker}</span>}
        {reasons.list && <span id={reasons.list}>{plan?.list?.blocker}</span>}
      </span>
    </FacetMaterial>
  );
}

type Open = "fuse" | "list" | "breakdown" | null;

interface WorkshopActionsProps {
  copies: SelectedCopy[];
  plan: BulkPlan;
  reasons: { list?: string; breakDown?: string };
  onDone: () => void;
  focusAfter?: RefObject<HTMLElement | null>;
}

function WorkshopActions({ copies, plan, reasons, onDone, focusAfter }: WorkshopActionsProps) {
  const [open, setOpen] = useState<Open>(null);
  const { focus, settle } = useDialogFocus();
  const count = copies.length;
  // The bar leaves with select mode, so focus goes where the pane says; a dismissed dialog gives it back to its opener.
  const dialog = {
    focus,
    onDone: () => {
      settle(focusAfter?.current ?? null);
      setOpen(null);
      onDone();
    },
    onOpenChange: (next: boolean) => {
      if (!next) setOpen(null);
    },
  };

  return (
    <>
      {plan.fuse && (
        <Button size="sm" variant="secondary" onClick={() => setOpen("fuse")}>
          <Combine aria-hidden />
          Fuse {count}
        </Button>
      )}
      {plan.list && (
        <Button
          size="sm"
          variant="secondary"
          disabled={plan.list.blocker !== null}
          aria-describedby={reasons.list}
          onClick={() => setOpen("list")}
        >
          <Shop aria-hidden />
          List {count}
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={plan.breakDownBlocker !== null}
        aria-describedby={reasons.breakDown}
        onClick={() => setOpen("breakdown")}
      >
        <Trash aria-hidden />
        Break down {count}
      </Button>
      {open === "breakdown" && <BreakDownConfirm {...dialog} copies={copies} dust={plan.dust} />}
      {open === "fuse" && plan.fuse && (
        <FuseDialog
          {...dialog}
          open
          cardTitle={plan.fuse.title}
          group={{
            finish: plan.fuse.from,
            next: plan.fuse.to,
            ownershipIds: copies.map((c) => c.ownershipId),
          }}
        />
      )}
      {open === "list" && <BulkListDialog {...dialog} open copies={copies} />}
    </>
  );
}

interface BreakDownConfirmProps {
  copies: SelectedCopy[];
  dust: number;
  focus: DialogFocus;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/** Confirm a bulk break-down with the dust it gives. It stays open until the break-down goes through. */
function BreakDownConfirm({ copies, dust, focus, onOpenChange, onDone }: BreakDownConfirmProps) {
  const { breakDown } = useCopyActions();
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent {...focus}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {`Break down ${copiesLabel(copies.length)} for ${dust.toLocaleString()} dust?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Broken-down copies are gone for good. Each copy&apos;s dust goes to its card&apos;s
            realm and can craft that realm&apos;s cards.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep them</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={breakDown.isPending}
            onClick={(event) => {
              event.preventDefault();
              breakDown.mutate(
                { ownershipIds: copies.map((c) => c.ownershipId) },
                { onSuccess: onDone }
              );
            }}
          >
            Break down
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

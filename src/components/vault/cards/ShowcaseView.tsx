"use client";

import { useId, type RefObject } from "react";
import { EditPencil, NavArrowLeft, Pin, PinSlash, Plus, Trash } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button, focusRing } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { useShowcaseRefresh } from "~/hooks/useShowcaseRefresh";
import { cardFaceLabel } from "~/lib/cards/face/accessible-name";
import { SHOWCASE_LIMITS } from "~/lib/cards/face/showcase-limits";
import type { SheetFrom } from "~/lib/cards/face/sheet-link";
import type { CardFaceData } from "~/lib/cards/face/types";
import type { ShowcaseView as ShowcaseData } from "~/lib/cards/hub/showcases";
import { cn } from "~/lib/utils/cn";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { CardGrid } from "./CardGrid";
import { ShowcaseEditorDialog } from "./ShowcaseEditorDialog";
import { ShowcasePickerDialog } from "./ShowcasePickerDialog";

interface ShowcaseViewProps {
  showcase: ShowcaseData;
  /** The showcase's name; focus goes there when the page changes under the control that had it. */
  headingRef: RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onOpenCard: (cardId: string, from?: SheetFrom | null) => void;
}

const notifyError = (error: { message: string }) => vaultNotify.error(error.message);

/** Whether the showcase is pinned, and who may see it: for its owner's eyes. */
export function ShowcaseBadges({ showcase }: { showcase: { pinned: boolean; isPublic: boolean } }) {
  return (
    <div className="flex flex-wrap gap-1">
      {showcase.pinned && (
        <Badge variant="info">
          <Pin />
          Pinned
        </Badge>
      )}
      <Badge variant={showcase.isPublic ? "secondary" : "default"}>
        {showcase.isPublic ? "Public" : "Private"}
      </Badge>
    </div>
  );
}

/** The copies already in the showcase, which the picker leaves out. */
const copyIds = (showcase: ShowcaseData) =>
  new Set(showcase.items.flatMap((item) => (item.face.copy ? [item.face.copy.ownershipId] : [])));

/**
 * "Remove Caphiria", or, when another copy in the showcase shares the title, the face's full name and the serial,
 * so each Remove names its own copy.
 */
function removeLabel(face: CardFaceData, sharedTitle: boolean): string {
  if (!sharedTitle || !face.copy) return `Remove ${face.title}`;
  return `Remove ${cardFaceLabel(face)}, #${face.copy.serialNumber}`;
}

/** The titles more than one copy in the showcase has. */
function sharedTitles(showcase: ShowcaseData): Set<string> {
  const seen = new Set<string>();
  const shared = new Set<string>();
  for (const { face } of showcase.items) {
    if (seen.has(face.title)) shared.add(face.title);
    seen.add(face.title);
  }
  return shared;
}

/** Opens the picker. After an add, focus goes to the heading: the add can disable this button or replace it. */
function AddCards({
  showcase,
  focusAfterAdd,
  reasonId,
}: {
  showcase: ShowcaseData;
  focusAfterAdd: () => void;
  /** The note saying why the button is disabled, when it is. */
  reasonId?: string;
}) {
  return (
    <ShowcasePickerDialog
      showcaseId={showcase.id}
      existing={copyIds(showcase)}
      focusAfterAdd={focusAfterAdd}
      trigger={
        <Button size="sm" disabled={reasonId !== undefined} aria-describedby={reasonId}>
          <Plus />
          Add cards
        </Button>
      }
    />
  );
}

/** One showcase: its cards with their art, and for its owner the actions that change it. */
export function ShowcaseView({ showcase, headingRef, onBack, onOpenCard }: ShowcaseViewProps) {
  const refresh = useShowcaseRefresh();
  const remove = api.cards.removeFromShowcase.useMutation({
    onSuccess: () => refresh(showcase.id),
    onError: notifyError,
  });
  const focusHeading = () => headingRef.current?.focus();
  // The showcase is the place each card opens from, so the sheet shows the art the showcase shows.
  const from: SheetFrom = { kind: "showcase", id: showcase.id };
  const shared = sharedTitles(showcase);
  const removeButton = (face: CardFaceData) => {
    const ownershipId = face.copy?.ownershipId;
    if (!ownershipId) return null;
    return (
      <Button
        size="sm"
        variant="ghost"
        className="w-full"
        aria-label={removeLabel(face, shared.has(face.title))}
        disabled={remove.isPending}
        onClick={() => remove.mutate({ showcaseId: showcase.id, ownershipId })}
      >
        Remove
      </Button>
    );
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <NavArrowLeft />
        Sets
      </Button>
      <header className="space-y-2">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className={cn("text-title-2 rounded-control-sm", focusRing)}
        >
          {showcase.name}
        </h2>
        {!showcase.isOwner && (
          <p className="text-callout text-label-secondary">{`By ${showcase.ownerName ?? "a player"}`}</p>
        )}
        {showcase.description && (
          <p className="text-callout text-label-secondary">{showcase.description}</p>
        )}
        {showcase.isOwner && <ShowcaseBadges showcase={showcase} />}
      </header>
      {showcase.isOwner && (
        <OwnerActions showcase={showcase} focusAfterAdd={focusHeading} onDeleted={onBack} />
      )}
      {showcase.items.length === 0 ? (
        <EmptyState
          compact
          title="No cards in this showcase yet"
          action={
            showcase.isOwner ? (
              <AddCards showcase={showcase} focusAfterAdd={focusHeading} />
            ) : undefined
          }
        />
      ) : (
        <CardGrid
          faces={showcase.items.map((item) => item.face)}
          onOpen={(face) => onOpenCard(face.cardId, from)}
          label={`${showcase.name} cards`}
          action={showcase.isOwner ? removeButton : undefined}
        />
      )}
    </div>
  );
}

/** Add (here once the showcase has cards), pin, edit and delete, each saying why when it cannot be used. */
function OwnerActions({
  showcase,
  focusAfterAdd,
  onDeleted,
}: {
  showcase: ShowcaseData;
  focusAfterAdd: () => void;
  onDeleted: () => void;
}) {
  const refresh = useShowcaseRefresh();
  const id = useId();
  const pin = api.cards.pinShowcase.useMutation({
    onSuccess: (result, input) => {
      // A pin takes the pin off whichever showcase held it, so every cached showcase reads again.
      refresh();
      // The showcase went private before the pin landed (another tab): it stays unpinned.
      if (input.pinned && !result.pinned) {
        vaultNotify.error("Not pinned. Make the showcase public before you pin it.");
      }
    },
    onError: notifyError,
  });
  const full = showcase.items.length >= SHOWCASE_LIMITS.items;
  // A private showcase never shows to others, so it cannot be the wallet's.
  const pinBlocked = !showcase.pinned && !showcase.isPublic;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {showcase.items.length > 0 && (
          <AddCards
            showcase={showcase}
            focusAfterAdd={focusAfterAdd}
            reasonId={full ? `${id}-full` : undefined}
          />
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={pinBlocked || pin.isPending}
          aria-describedby={pinBlocked ? `${id}-pin` : undefined}
          onClick={() => pin.mutate({ showcaseId: showcase.id, pinned: !showcase.pinned })}
        >
          {showcase.pinned ? <PinSlash /> : <Pin />}
          {showcase.pinned ? "Unpin from wallet" : "Pin to wallet"}
        </Button>
        <ShowcaseEditorDialog
          showcase={showcase}
          trigger={
            <Button size="sm" variant="secondary">
              <EditPencil />
              Edit
            </Button>
          }
        />
        <DeleteShowcase showcase={showcase} onDeleted={onDeleted} />
      </div>
      {full && (
        <p id={`${id}-full`} className="text-footnote text-label-secondary">
          {`This showcase is full. It holds up to ${SHOWCASE_LIMITS.items} cards.`}
        </p>
      )}
      {pinBlocked && (
        <p id={`${id}-pin`} className="text-footnote text-label-secondary">
          Only a public showcase can be pinned. Make it public in Edit.
        </p>
      )}
    </div>
  );
}

function DeleteShowcase({
  showcase,
  onDeleted,
}: {
  showcase: ShowcaseData;
  onDeleted: () => void;
}) {
  const refresh = useShowcaseRefresh();
  const destroy = api.cards.deleteShowcase.useMutation({
    onSuccess: () => {
      refresh(showcase.id);
      onDeleted();
    },
    onError: notifyError,
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Trash />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Delete ${showcase.name}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            Your cards stay in Mine. Only the showcase goes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => destroy.mutate({ showcaseId: showcase.id })}
          >
            Delete showcase
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

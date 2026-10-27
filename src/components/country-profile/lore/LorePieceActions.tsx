"use client";

import { useState } from "react";
import Link from "next/link";
import { EditPencil, EyeClosed, OpenBook, Pin, PinSlash } from "iconoir-react";
import { Button } from "~/components/ui/button";
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
import { wikiReaderPath } from "~/lib/wiki-os/config";

export interface LorePieceActionProps {
  title: string;
  pinned: boolean;
  /** Owner and co-authors: Edit. */
  canWrite: boolean;
  /** The owner: Pin or Unpin, and Hide. */
  isOwner: boolean;
  /** A curation change for this piece is in flight. */
  busy: boolean;
  onEdit: (title: string) => void;
  onSetPinned: (title: string, pinned: boolean) => void;
  onHide: (title: string) => void;
}

/** Hiding takes a piece off the Lore tab without touching the wiki; the owner confirms it first. */
function HideAction({
  title,
  busy,
  onHide,
}: Pick<LorePieceActionProps, "title" | "busy" | "onHide">) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(true)}>
        <EyeClosed aria-hidden="true" />
        Hide
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hide {title} from the Lore tab?</AlertDialogTitle>
          <AlertDialogDescription>
            The page stays on the wiki. To show it again, add it with Add an existing page.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => onHide(title)}>
            Hide the piece
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * A piece's actions beside its heading: Open in WikiOS for every reader, Edit for owner and co-authors, Pin or Unpin
 * and Hide for the owner. Nothing a viewer may not do is offered (the server refuses it anyway).
 */
export function LorePieceActions(props: LorePieceActionProps) {
  const { title, pinned, canWrite, isOwner, busy } = props;
  return (
    <div className="flex flex-wrap gap-1">
      <Button asChild size="sm" variant="secondary">
        <Link href={wikiReaderPath(title)}>
          <OpenBook aria-hidden="true" />
          Open in WikiOS
        </Link>
      </Button>
      {canWrite && (
        <Button size="sm" variant="ghost" onClick={() => props.onEdit(title)}>
          <EditPencil aria-hidden="true" />
          Edit
        </Button>
      )}
      {isOwner && (
        <>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => props.onSetPinned(title, !pinned)}
          >
            {pinned ? <PinSlash aria-hidden="true" /> : <Pin aria-hidden="true" />}
            {pinned ? "Unpin" : "Pin"}
          </Button>
          <HideAction title={title} busy={busy} onHide={props.onHide} />
        </>
      )}
    </div>
  );
}

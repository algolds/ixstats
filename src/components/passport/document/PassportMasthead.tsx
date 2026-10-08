"use client";

import React from "react";
import Link from "next/link";
import { EditPencil, Send } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { ShareSheet } from "~/components/share/ShareSheet";
import { IxnayPassportSeal } from "../cards/IxnayPassportSeal";

interface PassportMastheadProps {
  /** The canonical handle from the payload; never the URL segment. */
  handle: string;
  isOwner: boolean;
  /** A signed-in visitor who is not the holder sees Message. */
  viewerSignedIn: boolean;
  /** Flip the document to its configuration face (owner only). */
  onEdit: () => void;
  /** Lets the parent return focus here when the passport flips back. */
  editButtonRef?: React.Ref<HTMLButtonElement>;
}

/** Passport header: seal and title, then Edit (owner) or Message (signed-in visitor), and Share. */
export const PassportMasthead = React.memo(function PassportMasthead({
  handle,
  isOwner,
  viewerSignedIn,
  onEdit,
  editButtonRef,
}: PassportMastheadProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <IxnayPassportSeal size="sm" />
        <h1 className="text-label text-headline">IxStates Passport</h1>
      </div>

      <div className="flex items-center gap-2">
        {isOwner && (
          <Button ref={editButtonRef} type="button" variant="default" size="sm" onClick={onEdit}>
            <EditPencil aria-hidden />
            <span>Edit</span>
          </Button>
        )}
        {!isOwner && viewerSignedIn && (
          <Button asChild variant="default" size="sm">
            <Link href={`/messages?user=${encodeURIComponent(handle)}`}>
              <Send aria-hidden />
              <span>Message</span>
            </Link>
          </Button>
        )}
        <ShareSheet
          path={`/@${handle}`}
          title={`@${handle} on IxStates Passport`}
          imagePath={`/id/${encodeURIComponent(handle)}/opengraph-image`}
          downloadName={`ixstates-passport-${handle}.png`}
        />
      </div>
    </div>
  );
});

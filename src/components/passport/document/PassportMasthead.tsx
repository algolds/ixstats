"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { Check, EditPencil, Send, ShareAndroid } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { getBasePath } from "~/lib/base-path";
import { IxnayPassportSeal } from "../cards/IxnayPassportSeal";

interface PassportMastheadProps {
  /** The canonical handle from the payload; never the URL segment. */
  handle: string;
  isOwner: boolean;
  /** A signed-in visitor who is not the holder sees Message. */
  viewerSignedIn: boolean;
  /** Flip the document to its configuration face (owner only). */
  onEdit: () => void;
}

/** Passport header: seal and title, then Edit (owner) or Message (signed-in visitor), and Share. */
export const PassportMasthead = React.memo(function PassportMasthead({
  handle,
  isOwner,
  viewerSignedIn,
  onEdit,
}: PassportMastheadProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShareLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${getBasePath()}/@${handle}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard unavailable (permission denied or insecure context): nothing copied.
    }
  }, [handle]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <IxnayPassportSeal size="sm" />
        <h1 className="text-label text-headline">IxStates Passport</h1>
      </div>

      <div className="flex items-center gap-2">
        {isOwner && (
          <Button type="button" variant="default" size="sm" onClick={onEdit}>
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
        <Button type="button" variant="secondary" size="sm" onClick={handleShareLink}>
          {copiedLink ? (
            <Check aria-hidden className="text-success" />
          ) : (
            <ShareAndroid aria-hidden />
          )}
          <span>{copiedLink ? "Copied" : "Share"}</span>
        </Button>
      </div>
    </div>
  );
});

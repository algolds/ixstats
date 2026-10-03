"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { Check, Send, Settings, ShareAndroid as Share2 } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { IxnayPassportSeal } from "../cards/IxnayPassportSeal";

interface PassportMastheadProps {
  cleanUsername: string;
  isOwner: boolean;
  /** Flip the document to its configuration face (owner only). */
  onEdit: () => void;
}

/** Passport header: seal, title, and the edit, message and share actions. */
export const PassportMasthead = React.memo(function PassportMasthead({
  cleanUsername,
  isOwner,
  onEdit,
}: PassportMastheadProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShareLink = useCallback(async () => {
    try {
      const url =
        typeof window !== "undefined"
          ? window.location.href
          : `https://ixstats.com/@${cleanUsername}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard unavailable (permission denied or insecure context): nothing copied.
    }
  }, [cleanUsername]);

  return (
    <div className="border-separator flex flex-wrap items-center justify-between gap-4 border-b pb-5">
      <div className="flex items-center gap-3">
        <IxnayPassportSeal />
        <div>
          <h1 className="text-label text-title-3">IxStates passport</h1>
          <p className="text-label-secondary text-footnote">User identity</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isOwner ? (
          <Button type="button" variant="default" onClick={onEdit}>
            <Settings aria-hidden />
            <span>Edit passport</span>
          </Button>
        ) : (
          <Button asChild variant="default">
            <Link href={`/messages?user=${encodeURIComponent(cleanUsername)}`}>
              <Send aria-hidden />
              <span>Send message</span>
            </Link>
          </Button>
        )}

        <Button type="button" variant="secondary" onClick={handleShareLink}>
          {copiedLink ? <Check aria-hidden className="text-success" /> : <Share2 aria-hidden />}
          <span>{copiedLink ? "Copied" : "Share"}</span>
        </Button>
      </div>
    </div>
  );
});

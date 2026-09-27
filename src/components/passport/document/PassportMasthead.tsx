"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { Check, Send, Settings, ShareAndroid as Share2 } from "iconoir-react";
import { IxnayPassportSeal } from "../cards/IxnayPassportSeal";

interface PassportMastheadProps {
  cleanUsername: string;
  isOwner: boolean;
  /** Flip the document to its configuration face (owner only). */
  onEdit: () => void;
}

/** Passport header: seal, title, and the edit / message / share actions. */
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
          : `https://ixstats.com/id/@${cleanUsername}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // clipboard unavailable (permission denied / insecure context) — nothing copied
    }
  }, [cleanUsername]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/8 pb-5 dark:border-white/10">
      <div className="flex items-center gap-3">
        <IxnayPassportSeal />
        <div>
          <div className="flex items-center gap-2">
            <h1
              className="text-foreground font-mono text-xs font-bold tracking-[0.14em] uppercase sm:text-sm"
              style={{ fontOpticalSizing: "auto" } as React.CSSProperties}
            >
              IXSTATES PASSPORT
            </h1>
          </div>
          <p className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
            USER IDENTITY
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {isOwner ? (
          <button
            type="button"
            onClick={onEdit}
            data-cuelume-press="soft"
            className="bg-foreground text-background inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 hover:opacity-90 active:scale-[0.96]"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Edit Passport</span>
          </button>
        ) : (
          <Link
            href={`/messages?user=${encodeURIComponent(cleanUsername)}`}
            data-cuelume-press="soft"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 hover:bg-blue-700 active:scale-[0.96]"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Send Message</span>
          </Link>
        )}

        <button
          type="button"
          onClick={handleShareLink}
          data-cuelume-press="soft"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/10 bg-black/[0.02] px-3.5 py-2 text-xs font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 hover:bg-black/[0.05] active:scale-[0.96] dark:border-white/15 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
        >
          {copiedLink ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Share2 className="h-3.5 w-3.5" />
          )}
          <span>{copiedLink ? "Copied" : "Share"}</span>
        </button>
      </div>
    </div>
  );
});

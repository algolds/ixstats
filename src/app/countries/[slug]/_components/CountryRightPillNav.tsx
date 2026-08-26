"use client";

import React, { useState } from "react";
import Link from "next/link";
// oxlint-disable-next-line eslint/no-unused-vars
import { ShareAndroid as Share2, Check, Group as Users, Settings, Spark as Sparkles } from "iconoir-react";
import { cn } from "~/lib/utils";

interface CountryRightPillNavProps {
  countryName: string;
  countryId: string;
  isOwnCountry: boolean;
  onOpenActions: () => void;
}

/**
 * CountryRightPillNav — Apple-grade Contextual Action Pill matching MyCountry's CommandRightPillNav.
 * Houses the country management action, share trigger, and quick owner settings shortcut.
 */
export function CountryRightPillNav({
  // oxlint-disable-next-line eslint/no-unused-vars
  countryName,
  countryId: _countryId,
  isOwnCountry,
  onOpenActions,
}: CountryRightPillNavProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="facet-surface facet-refraction flex items-center gap-1.5 rounded-2xl border border-black/8 dark:border-white/10 bg-white/70 dark:bg-stone-900/70 p-1.5 shadow-md saturate-180 backdrop-blur-2xl">
      {/* Share Profile Button */}
      <button
        onClick={handleShare}
        data-cuelume-press="soft"
        aria-label={copied ? "Link copied" : "Share country profile"}
        className={cn(
          "facet-interactive flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
          copied
            ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
            : "text-stone-600 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
        )}
        title="Copy Public Profile Link"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-500" />
            <span>Copied</span>
          </>
        ) : (
          <>
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Share</span>
          </>
        )}
      </button>

      {/* Country Actions / Manage Button */}
      <button
        onClick={onOpenActions}
        data-cuelume-press="soft"
        aria-label={isOwnCountry ? "Manage Nation" : "Country Actions"}
        className="facet-interactive flex items-center gap-1.5 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 px-3.5 py-1.5 text-xs font-bold shadow-sm transition-all duration-150 hover:opacity-90 active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
      >
        <Users className="h-3.5 w-3.5" />
        <span>{isOwnCountry ? "Manage Nation" : "Country Actions"}</span>
      </button>

      {/* Direct Settings Link (Owner only) */}
      {isOwnCountry && (
        <Link
          href="/settings#ixnayid-section"
          data-cuelume-press="soft"
          aria-label="Account Settings"
          className="facet-interactive flex items-center justify-center rounded-xl p-1.5 text-stone-600 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
          title="Account Settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

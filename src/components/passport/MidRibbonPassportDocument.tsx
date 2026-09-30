"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Check, Copy, Spark as Sparkles } from "iconoir-react";
import { cn } from "~/lib/utils";
import { GuillochePattern } from "./cards/GuillochePattern";
import { PassportBackFace } from "./document/PassportBackFace";
import { PassportMasthead } from "./document/PassportMasthead";
import { PassportStatGrid } from "./document/PassportStatGrid";
import { PassportTabRibbon } from "./document/PassportTabRibbon";
import { PassportLorewardsModal } from "./modals/PassportLorewardsModal";
import { PassportTabBody } from "./PassportTabPanels";
import type { PassportPayload, PassportTabType, PassportVisibility } from "./types";

interface MidRibbonPassportDocumentProps {
  cleanUsername: string;
  displayName: string;
  avatarUrl: string | null;
  data: PassportPayload;
  isOwner: boolean;
  activeTab: PassportTabType;
  onSelectTab: (tab: PassportTabType) => void;
}

/**
 * Upscales Clerk and CDN avatar URLs to crisp Retina/4K resolutions.
 */
function getHighResolutionAvatar(url: string | null, size = 600): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.includes("clerk.com") ||
      parsed.hostname.includes("clerk.dev") ||
      parsed.hostname.includes("img.clerk.com")
    ) {
      parsed.searchParams.set("width", String(size));
      parsed.searchParams.set("height", String(size));
      parsed.searchParams.set("quality", "100");
      parsed.searchParams.set("fit", "crop");
      return parsed.toString();
    }
    return url;
  } catch {
    return url;
  }
}

const DEFAULT_VISIBILITY: PassportVisibility = {
  accolades: true,
  impact: true,
  forumStats: true,
  vaultCards: true,
  historyStream: true,
};

export function MidRibbonPassportDocument({
  cleanUsername,
  displayName,
  avatarUrl,
  data,
  isOwner,
  activeTab,
  onSelectTab,
}: MidRibbonPassportDocumentProps) {
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLorewardsModalOpen, setIsLorewardsModalOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const featuredRealm = data.featuredRealm;

  // Authoritative Role from Database / Admin / Clerk
  const roleName = data.account.roleName || featuredRealm?.role || "Leader";

  // High-Resolution Avatar for physical passport biometric rendering
  const highResAvatarUrl = getHighResolutionAvatar(avatarUrl, 800);

  // Editable Signature State
  const [signature, setSignature] = useState(displayName);

  // Passport presentation & privacy preferences
  const [visibility, setVisibility] = useState<PassportVisibility>(DEFAULT_VISIBILITY);
  const handleVisibilityChange = useCallback(
    (key: keyof PassportVisibility, value: boolean) =>
      setVisibility((current) => ({ ...current, [key]: value })),
    []
  );

  const handleCopyHandle = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`@${cleanUsername}`);
      setCopiedHandle(true);
      setTimeout(() => setCopiedHandle(false), 2000);
    } catch {
      // clipboard unavailable (permission denied / insecure context) — nothing copied
    }
  }, [cleanUsername]);

  const handleEdit = useCallback(() => setIsFlipped(true), []);
  const handleDone = useCallback(() => setIsFlipped(false), []);
  const handleOpenLorewards = useCallback(() => setIsLorewardsModalOpen(true), []);
  const handleOpenVault = useCallback(() => onSelectTab("vault"), [onSelectTab]);

  const realmName = featuredRealm?.name ?? "—";
  const passportNumber = `IX-${cleanUsername.toUpperCase().substring(0, 4)}-${data.account.userId ? data.account.userId.substring(0, 4).toUpperCase() : "882"}`;
  const entryDate = data.account.createdAt
    ? new Date(data.account.createdAt)
        .toLocaleDateString("en-US", { month: "short", year: "numeric" })
        .toUpperCase()
    : "RECENT";

  const vault = data.vault;
  const ribbonCounts = { realms: data.realmCount, vault: vault.totalCards };

  // Apple §4 springs: flip is interruptible, from presentation value
  const flipTransition = shouldReduceMotion
    ? { duration: 0.2, ease: "easeOut" as const }
    : { type: "spring" as const, bounce: 0, duration: 0.4 };

  return (
    <div className="relative w-full" style={{ perspective: 1800 }}>
      <motion.div
        className="relative w-full"
        style={{ transformStyle: "preserve-3d", willChange: "transform" } as React.CSSProperties}
        animate={{ rotateY: shouldReduceMotion ? 0 : isFlipped ? 180 : 0 }}
        transition={flipTransition}
      >
        {/* ========================================================================= */}
        {/* FRONT FACE OF THE PASSPORT                                               */}
        {/* ========================================================================= */}
        <motion.div
          className={cn(
            // Apple §12 Materials: translucent layer, not opaque bar — content scrolls under, weight encodes hierarchy
            "bg-card/70 dark:bg-card/60 relative w-full rounded-3xl border border-black/10 shadow-2xl saturate-[180%] backdrop-blur-[20px] [backface-visibility:hidden] dark:border-white/15",
            "supports-[backdrop-filter:blur(0)]:bg-card/85",
            isFlipped ? "pointer-events-none opacity-0" : "opacity-100"
          )}
          style={{ willChange: shouldReduceMotion ? undefined : "opacity" }}
          animate={{ opacity: isFlipped ? 0 : 1 }}
          transition={shouldReduceMotion ? { duration: 0.2 } : { duration: 0.15 }}
        >
          <GuillochePattern opacity={0.06} />

          <div className="relative z-10">
            {/* 1. TOP IDENTITY & OVERVIEW CARD SECTION */}
            <div className="space-y-6 p-5 sm:p-7">
              {/* Header: Clean Sovereign Masthead with Frosted IX Emblem */}
              <PassportMasthead
                cleanUsername={cleanUsername}
                isOwner={isOwner}
                onEdit={handleEdit}
              />

              {/* Identity & Overview Grid (Restrained Information Grammar) */}
              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                {/* Left: Unobstructed High-Res Portrait & Signature */}
                <div className="flex flex-col items-center gap-3.5 sm:items-start lg:col-span-4">
                  <div className="bg-muted relative h-44 w-38 overflow-hidden rounded-2xl border-2 border-black/15 shadow-sm sm:h-52 sm:w-44 dark:border-white/20">
                    {highResAvatarUrl ? (
                      <img
                        src={highResAvatarUrl}
                        alt={displayName}
                        className="h-full w-full transform-gpu object-cover select-none"
                        loading="eager"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-stone-200 font-mono text-4xl font-bold text-stone-600 select-none dark:bg-stone-800">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="w-full max-w-[175px] space-y-0.5 border-t border-black/15 pt-1.5 text-center sm:text-left dark:border-white/20">
                    <span className="text-muted-foreground block font-mono text-xs tracking-wider uppercase">
                      SIGNATURE
                    </span>
                    <span className="text-foreground/90 block truncate font-serif text-sm font-medium tracking-wider italic select-none">
                      {signature || displayName}
                    </span>
                  </div>
                </div>

                {/* Right: Identity & 4-Cell Information Grammar Grid */}
                <div className="space-y-4 lg:col-span-8">
                  {/* Name, Handle & Role */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-foreground font-sans text-2xl font-bold tracking-tight">
                        {displayName}
                      </h2>
                      <button
                        type="button"
                        onClick={handleCopyHandle}
                        className="hover:text-foreground inline-flex cursor-pointer items-center gap-1 rounded-lg bg-black/5 px-2.5 py-1 font-mono text-xs font-semibold text-stone-600 transition-colors hover:bg-black/10 dark:bg-white/5 dark:text-stone-300"
                      >
                        <span>@{cleanUsername}</span>
                        {copiedHandle ? (
                          <Check className="h-2.5 w-2.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-2.5 w-2.5" />
                        )}
                      </button>

                      {/* Authoritative User Role Badge */}
                      {roleName && (
                        <span className="rounded-lg border border-blue-500/25 bg-blue-500/10 px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider text-blue-600 uppercase dark:text-blue-400">
                          {roleName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Information Grammar 4-Cell Matrix */}
                  <div className="grid grid-cols-2 gap-3 border-y border-black/8 py-3.5 font-mono text-xs sm:grid-cols-4 dark:border-white/10">
                    <div>
                      <span className="text-muted-foreground block text-xs uppercase">
                        IDENTITY NO.
                      </span>
                      <strong className="text-foreground font-bold">{passportNumber}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs uppercase">
                        DATE JOINED
                      </span>
                      <strong className="text-foreground font-bold">{entryDate}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs uppercase">
                        PRIMARY REALM
                      </span>
                      <strong className="text-foreground font-bold">{realmName}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs uppercase">
                        STATUS
                      </span>
                      <span className="font-bold text-emerald-500">ACTIVE</span>
                    </div>
                  </div>

                  {/* Stat Overview Grid (Lorewards, Streak, Forum, Vault) */}
                  <PassportStatGrid
                    visibility={visibility}
                    lorewards={data.wiki.lorewards}
                    forum={data.forum}
                    vault={vault}
                    onOpenLorewards={handleOpenLorewards}
                    onOpenVault={handleOpenVault}
                  />

                  {/* ThinkPages Voice Bio (if available) */}
                  {data.thinkpages.bio && (
                    <div className="space-y-1 rounded-xl border border-black/6 bg-black/[0.015] p-3 dark:border-white/8 dark:bg-white/[0.02]">
                      <div className="flex items-center gap-1.5 text-blue-500">
                        <Sparkles className="h-3 w-3" />
                        <span className="font-mono text-xs font-bold tracking-wider uppercase">
                          ThinkPages Bio
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs leading-relaxed italic">
                        "{data.thinkpages.bio}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. MID-CARD DIE-CUT INDEX RIBBON */}
            <PassportTabRibbon
              activeTab={activeTab}
              onSelectTab={onSelectTab}
              counts={ribbonCounts}
            />

            {/* 3. LOWER TAB BODY CONTENT — Apple §4 spring, §9 rubber-band, §11 will-change */}
            <div
              className="space-y-6 overscroll-contain p-5 sm:p-7"
              style={{ overscrollBehavior: "contain" } as React.CSSProperties}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0.15, ease: "easeOut" }
                      : { type: "spring", bounce: 0, duration: 0.35 }
                  }
                  style={{ willChange: shouldReduceMotion ? undefined : "transform, opacity" }}
                >
                  <PassportTabBody
                    activeTab={activeTab}
                    handle={cleanUsername}
                    data={data}
                    showHistory={visibility.historyStream}
                    isOwner={isOwner}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* ========================================================================= */}
        {/* BACK FACE OF THE PASSPORT (CONFIGURATION & PRIVACY CONTROLS)               */}
        {/* ========================================================================= */}
        <PassportBackFace
          isFlipped={isFlipped}
          shouldReduceMotion={Boolean(shouldReduceMotion)}
          displayName={displayName}
          signature={signature}
          onSignatureChange={setSignature}
          visibility={visibility}
          onVisibilityChange={handleVisibilityChange}
          onDone={handleDone}
        />
      </motion.div>

      {/* Interactive Lorewards Civic Accolades Modal */}
      <PassportLorewardsModal
        open={isLorewardsModalOpen}
        onOpenChange={setIsLorewardsModalOpen}
        wiki={data.wiki}
        cleanUsername={cleanUsername}
      />
    </div>
  );
}

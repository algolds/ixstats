"use client";

import React, { useState, useCallback, useId } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Check, Copy, Spark as Sparkles } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetCard, MotionFacetCard } from "~/components/ui/facet-container";
import { Stat } from "~/components/ui/stat";
import { REDUCED_MOTION_FADE, springSmooth, tweenFast } from "~/lib/design/motion";
import { GuillochePattern } from "./cards/GuillochePattern";
import { PassportBackFace } from "./document/PassportBackFace";
import { PassportMasthead } from "./document/PassportMasthead";
import { PassportStatGrid } from "./document/PassportStatGrid";
import {
  PassportTabRibbon,
  passportTabId,
  passportTabPanelId,
} from "./document/PassportTabRibbon";
import { PassportLorewardsModal } from "./modals/PassportLorewardsModal";
import { PassportTabBody } from "./PassportTabPanels";
import type { PassportPayload, PassportTabType } from "./types";

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

  // Saved signature inscription (PassportPreference.signature); the display name when unset.
  const signature = data.account.signature || displayName;

  // Saved section visibility: hidden sections are already absent from `data`.
  const visibility = data.privacy;

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
  const tabIdBase = `passport-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const realmName = featuredRealm?.name ?? "—";
  const passportNumber = `IX-${cleanUsername.toUpperCase().substring(0, 4)}-${data.account.userId ? data.account.userId.substring(0, 4).toUpperCase() : "882"}`;
  const entryDate = data.account.createdAt
    ? new Date(data.account.createdAt)
        .toLocaleDateString("en-US", { month: "short", year: "numeric" })
        .toUpperCase()
    : "RECENT";

  const vault = data.vault;
  const ribbonCounts = { realms: data.realmCount, vault: vault?.totalCards };

  // Facet springs: the flip is interruptible (spring-smooth); Reduce Motion cross-fades.
  const flipTransition = shouldReduceMotion ? REDUCED_MOTION_FADE : springSmooth;

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
        <MotionFacetCard
          // v2 document: the translucent glass page (Facet 3.1 glass hero + tinted shadow; no
          // clipping blob); the panels inside stay opaque (glass never nests).
          variant="glass"
          glow="shadow"
          className={cn(
            "relative w-full [backface-visibility:hidden]",
            isFlipped ? "pointer-events-none opacity-0" : "opacity-100"
          )}
          style={{ willChange: shouldReduceMotion ? undefined : "opacity" }}
          animate={{ opacity: isFlipped ? 0 : 1 }}
          transition={tweenFast}
        >
          <GuillochePattern opacity={0.06} />

          <div className="relative">
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
                <div className="flex flex-col items-center gap-4 sm:items-start lg:col-span-4">
                  <div className="bg-fill-3 border-separator rounded-card shadow-card relative h-44 w-38 overflow-hidden border-2 sm:h-52 sm:w-44">
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
                      <div className="bg-fill-3 text-large-title text-label-secondary flex h-full w-full items-center justify-center select-none">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="border-separator w-full max-w-[175px] space-y-0.5 border-t pt-2 text-center sm:text-left">
                    <Eyebrow className="block">Signature</Eyebrow>
                    <span className="text-label text-body block truncate font-serif italic select-none">
                      {signature}
                    </span>
                  </div>
                </div>

                {/* Right: Identity & 4-Cell Information Grammar Grid */}
                <div className="space-y-4 lg:col-span-8">
                  {/* Name, Handle & Role */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-label text-title-1">{displayName}</h2>
                      <Button
                        type="button"
                        variant="gray"
                        size="sm"
                        onClick={handleCopyHandle}
                        aria-label={
                          copiedHandle ? "Handle copied" : `Copy handle @${cleanUsername}`
                        }
                        className="text-label-secondary"
                      >
                        <span>@{cleanUsername}</span>
                        {copiedHandle ? (
                          <Check aria-hidden className="text-success size-3.5" />
                        ) : (
                          <Copy aria-hidden className="size-3.5" />
                        )}
                      </Button>

                      {/* Authoritative user role */}
                      {roleName && <Badge variant="info">{roleName}</Badge>}
                    </div>
                  </div>

                  {/* Information Grammar 4-Cell Matrix */}
                  <div className="border-separator grid grid-cols-2 gap-3 border-y py-3 sm:grid-cols-4">
                    <Stat size="sm" label="Identity no." value={passportNumber} />
                    <Stat size="sm" label="Date joined" value={entryDate} />
                    <Stat size="sm" label="Primary realm" value={realmName} />
                    <Stat
                      size="sm"
                      label="Status"
                      value={<span className="text-success-ink">Active</span>}
                    />
                  </div>

                  {/* Stat Overview Grid (Lorewards, Streak, Forum, Vault) */}
                  <PassportStatGrid
                    visibility={visibility}
                    lorewards={data.wiki.lorewards}
                    forumStats={data.forum.stats}
                    vault={vault}
                    onOpenLorewards={handleOpenLorewards}
                    onOpenVault={handleOpenVault}
                  />

                  {/* ThinkPages Voice Bio (if available) */}
                  {data.thinkpages.bio && (
                    <FacetCard variant="inset" padding="sm" className="space-y-1">
                      <div className="text-label-secondary text-subhead flex items-center gap-2">
                        <Sparkles aria-hidden className="size-3.5" />
                        <span>ThinkPages bio</span>
                      </div>
                      <p className="text-label-secondary text-callout italic">
                        "{data.thinkpages.bio}"
                      </p>
                    </FacetCard>
                  )}
                </div>
              </div>
            </div>

            {/* 2. MID-CARD DIE-CUT INDEX RIBBON */}
            <PassportTabRibbon
              activeTab={activeTab}
              onSelectTab={onSelectTab}
              counts={ribbonCounts}
              idBase={tabIdBase}
            />

            {/* 3. LOWER TAB BODY CONTENT — Apple §4 spring, §9 rubber-band, §11 will-change.
                The ribbon's tab panel: labelled by the selected tab, focusable (tabs pattern). */}
            <div
              role="tabpanel"
              id={passportTabPanelId(tabIdBase)}
              aria-labelledby={passportTabId(tabIdBase, activeTab)}
              tabIndex={0}
              className="focus-visible:outline-tint space-y-6 overscroll-contain p-5 focus-visible:outline-2 focus-visible:-outline-offset-2 sm:p-7"
              style={{ overscrollBehavior: "contain" } as React.CSSProperties}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={shouldReduceMotion ? REDUCED_MOTION_FADE : springSmooth}
                  style={{ willChange: shouldReduceMotion ? undefined : "transform, opacity" }}
                >
                  <PassportTabBody
                    activeTab={activeTab}
                    handle={cleanUsername}
                    data={data}
                    onOpenVault={handleOpenVault}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </MotionFacetCard>

        {/* ========================================================================= */}
        {/* BACK FACE OF THE PASSPORT (CONFIGURATION & PRIVACY CONTROLS)               */}
        {/* ========================================================================= */}
        <PassportBackFace
          isFlipped={isFlipped}
          shouldReduceMotion={Boolean(shouldReduceMotion)}
          displayName={displayName}
          isOwner={isOwner}
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

"use client";

import React, { useState, useCallback, useId } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Check, Copy, Spark as Sparkles } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Stat } from "~/components/ui/stat";
import { REDUCED_MOTION_FADE, springSmooth, tweenFast } from "~/lib/design/motion";
import { PassportBackFace } from "./document/PassportBackFace";
import { PassportMasthead } from "./document/PassportMasthead";
import { PassportPortrait } from "./document/PassportPortrait";
import { PassportStatGrid } from "./document/PassportStatGrid";
import { PassportTabRibbon, passportTabId, passportTabPanelId } from "./document/PassportTabRibbon";
import { PassportLorewardsModal } from "./modals/PassportLorewardsModal";
import { PassportTabBody } from "./PassportTabPanels";
import type { PassportPayload, PassportTabType } from "./types";
import { Card } from "~/components/ui/card";
import { CosmeticChatBadge } from "~/components/vault/CosmeticChatBadge";
import { useUserCosmetics } from "~/hooks/usePublicCosmetics";

const MotionCard = motion.create(Card);

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

  // Role from the database, admin or Clerk
  const roleName = data.account.roleName || featuredRealm?.role || "Leader";

  const highResAvatarUrl = getHighResolutionAvatar(avatarUrl, 800);
  // The holder's equipped cosmetics, the same for every visitor (VT-12).
  const cosmetics = useUserCosmetics(data.account.userId);

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
      // Clipboard unavailable (permission denied or insecure context): nothing copied.
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
    ? new Date(data.account.createdAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "Recent";

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
        {/* Front face */}
        <MotionCard
          className={cn(
            "relative w-full [backface-visibility:hidden]",
            isFlipped ? "pointer-events-none opacity-0" : "opacity-100"
          )}
          style={{ willChange: shouldReduceMotion ? undefined : "opacity" }}
          animate={{ opacity: isFlipped ? 0 : 1 }}
          transition={tweenFast}
        >
          <div className="relative">
            {/* Identity and overview */}
            <div className="space-y-6 p-5 sm:p-7">
              {/* Masthead */}
              <PassportMasthead
                cleanUsername={cleanUsername}
                isOwner={isOwner}
                onEdit={handleEdit}
              />

              {/* Identity and overview grid */}
              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                {/* Portrait and signature */}
                <div className="flex flex-col items-center gap-4 sm:items-start lg:col-span-4">
                  <PassportPortrait
                    displayName={displayName}
                    avatarUrl={highResAvatarUrl}
                    cosmetics={cosmetics}
                  />

                  <div className="border-separator w-full max-w-[175px] space-y-0.5 border-t pt-2 text-center sm:text-left">
                    <Eyebrow className="block">Signature</Eyebrow>
                    <span className="text-label text-body block truncate font-serif italic select-none">
                      {signature}
                    </span>
                  </div>
                </div>

                {/* Identity details */}
                <div className="space-y-4 lg:col-span-8">
                  {/* Name, handle and role */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-label text-title-1">{displayName}</h2>
                      <CosmeticChatBadge badge={cosmetics?.chatBadge} className="size-5" />
                      <Button
                        type="button"
                        variant="secondary"
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

                  {/* Identity facts */}
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

                  {/* Lorewards, streak, forum and Vault stats */}
                  <PassportStatGrid
                    visibility={visibility}
                    lorewards={data.wiki.lorewards}
                    forumStats={data.forum.stats}
                    vault={vault}
                    onOpenLorewards={handleOpenLorewards}
                    onOpenVault={handleOpenVault}
                  />

                  {/* ThinkPages bio */}
                  {data.thinkpages.bio && (
                    <Card variant="well" padding="sm" className="space-y-1">
                      <div className="text-label-secondary text-subhead flex items-center gap-2">
                        <Sparkles aria-hidden className="size-3.5" />
                        <span>ThinkPages bio</span>
                      </div>
                      <p className="text-label-secondary text-callout italic">
                        "{data.thinkpages.bio}"
                      </p>
                    </Card>
                  )}
                </div>
              </div>
            </div>

            {/* Tab ribbon */}
            <PassportTabRibbon
              activeTab={activeTab}
              onSelectTab={onSelectTab}
              counts={ribbonCounts}
              idBase={tabIdBase}
            />

            {/* The ribbon's tab panel: labelled by the selected tab, focusable (tabs pattern). */}
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
        </MotionCard>

        {/* Back face: configuration and privacy controls */}
        <PassportBackFace
          isFlipped={isFlipped}
          shouldReduceMotion={Boolean(shouldReduceMotion)}
          displayName={displayName}
          isOwner={isOwner}
          onDone={handleDone}
        />
      </motion.div>

      {/* Lorewards modal */}
      <PassportLorewardsModal
        open={isLorewardsModalOpen}
        onOpenChange={setIsLorewardsModalOpen}
        wiki={data.wiki}
        cleanUsername={cleanUsername}
      />
    </div>
  );
}

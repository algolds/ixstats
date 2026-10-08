"use client";

import React, { useState, useCallback, useId } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import { REDUCED_MOTION_FADE, springSmooth, tweenFast } from "~/lib/design/motion";
import { PassportBackFace } from "./document/PassportBackFace";
import { PassportFrontFace } from "./document/PassportFrontFace";
import { PassportTabRibbon, passportTabId, passportTabPanelId } from "./document/PassportTabRibbon";
import { PassportLorewardsModal } from "./modals/PassportLorewardsModal";
import { PassportTabBody } from "./PassportTabPanels";
import type { PassportPayload, PassportTabType } from "./types";
import { Card } from "~/components/ui/card";
import { useUserCosmetics } from "~/hooks/usePublicCosmetics";

const MotionCard = motion.create(Card);

interface MidRibbonPassportDocumentProps {
  displayName: string;
  avatarUrl: string | null;
  data: PassportPayload;
  isOwner: boolean;
  /** Signed-in visitors who are not the holder see Message. */
  viewerSignedIn: boolean;
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
  displayName,
  avatarUrl,
  data,
  isOwner,
  viewerSignedIn,
  activeTab,
  onSelectTab,
}: MidRibbonPassportDocumentProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLorewardsModalOpen, setIsLorewardsModalOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const highResAvatarUrl = getHighResolutionAvatar(avatarUrl, 800);
  // The holder's equipped cosmetics, the same for every visitor (VT-12).
  const cosmetics = useUserCosmetics(data.account.userId);

  const handleEdit = useCallback(() => setIsFlipped(true), []);
  const handleDone = useCallback(() => setIsFlipped(false), []);
  const handleOpenLorewards = useCallback(() => setIsLorewardsModalOpen(true), []);
  const handleOpenVault = useCallback(() => onSelectTab("vault"), [onSelectTab]);
  const tabIdBase = `passport-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const ribbonCounts = { realms: data.realmCount, vault: data.vault?.totalCards };

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
            <PassportFrontFace
              data={data}
              displayName={displayName}
              avatarUrl={highResAvatarUrl}
              cosmetics={cosmetics}
              isOwner={isOwner}
              viewerSignedIn={viewerSignedIn}
              onEdit={handleEdit}
              onOpenLorewards={handleOpenLorewards}
            />

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
                    handle={data.handle}
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
        cleanUsername={data.handle}
      />
    </div>
  );
}

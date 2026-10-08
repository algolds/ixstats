"use client";

import React, { useState, useCallback, useEffect, useId, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import { REDUCED_MOTION_FADE, springSmooth } from "~/lib/design/motion";
import { PassportBackFace } from "./document/PassportBackFace";
import { PassportFrontFace } from "./document/PassportFrontFace";
import { PassportTabRibbon, passportTabId, passportTabPanelId } from "./document/PassportTabRibbon";
import { PassportLorewardsModal } from "./modals/PassportLorewardsModal";
import { PassportTabBody } from "./PassportTabPanels";
import { DEFAULT_PASSPORT_TAB, passportRibbonCounts } from "./passport-tabs";
import type { PassportPayload, PassportTabType } from "./types";
import { Card } from "~/components/ui/card";
import { useUserCosmetics } from "~/hooks/usePublicCosmetics";

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
  // The cover opens once, when the passport first appears on its default tab. A deep link to
  // another tab skips it; the value is fixed at mount so a later tab change never replays it.
  const [playOpenEntrance] = useState(() => activeTab === DEFAULT_PASSPORT_TAB);

  const highResAvatarUrl = getHighResolutionAvatar(avatarUrl, 800);
  // The holder's equipped cosmetics, the same for every visitor (VT-12).
  const cosmetics = useUserCosmetics(data.account.userId);

  // The face that goes inert drops focus; on flip-back it returns to Edit (never on first mount).
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const wasFlipped = useRef(false);
  useEffect(() => {
    if (wasFlipped.current && !isFlipped) editButtonRef.current?.focus({ preventScroll: true });
    wasFlipped.current = isFlipped;
  }, [isFlipped]);

  const handleEdit = useCallback(() => setIsFlipped(true), []);
  const handleDone = useCallback(() => setIsFlipped(false), []);
  const handleOpenLorewards = useCallback(() => setIsLorewardsModalOpen(true), []);
  const tabIdBase = `passport-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const ribbonCounts = passportRibbonCounts(data);

  return (
    <div
      data-testid="passport-flip-root"
      className={cn("relative w-full", playOpenEntrance && "animate-passport-open")}
      style={{ perspective: 1800 }}
    >
      {/* The flip is CSS only: a 3D turn, or an opacity crossfade under Reduce Motion. */}
      <div
        data-testid="passport-flip-card"
        className={cn(
          "relative w-full transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] transform-3d",
          "motion-reduce:[transform:none] motion-reduce:transition-none",
          isFlipped && "[transform:rotateY(180deg)]"
        )}
      >
        {/* Front face. Inert while hidden so focus and clicks cannot reach it. */}
        <Card
          data-testid="passport-front-face"
          inert={isFlipped}
          className={cn(
            "relative w-full [backface-visibility:hidden]",
            "motion-reduce:transition-opacity motion-reduce:duration-150",
            isFlipped && "motion-reduce:pointer-events-none motion-reduce:opacity-0"
          )}
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
              editButtonRef={editButtonRef}
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
                  <PassportTabBody activeTab={activeTab} handle={data.handle} data={data} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </Card>

        {/* Back face: configuration and privacy controls */}
        <PassportBackFace
          isFlipped={isFlipped}
          displayName={displayName}
          isOwner={isOwner}
          onDone={handleDone}
        />
      </div>

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

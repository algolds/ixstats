"use client";

import React, { useState, useEffect, useEffectEvent, useRef } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { stripBasePath } from "~/lib/base-path";
import { motion, type PanInfo } from "motion/react";
import { Halo, useHaloSize, SIZE_PRESETS, HaloProvider, type SizePresets } from "./HaloPrimitives";
import { CompactView, ExpandedView, NavTray } from "./views";
import { useDynamicIslandState } from "./hooks";
import type { ViewMode } from "./types";
import { useActiveDIPlugin } from "./plugin-context";
import { useNotificationStore } from "~/stores/notificationStore";
import { useToastQueueStore } from "~/stores/toastQueueStore";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { HaloTourProvider, useHaloTour } from "./HaloTourContext";
import { springSnappy, tweenFast } from "~/lib/design/motion";
import { cn } from "~/lib/utils";
import { useHydrated } from "~/hooks/useHydrated";

const HaloTourTooltip = dynamic(() => import("./HaloTourTooltip").then((m) => m.HaloTourTooltip), {
  ssr: false,
});

interface CommandPaletteProps {
  className?: string;
  isSticky?: boolean;
  scrollY?: number;
}

interface SizeInputs {
  isForumActive: boolean;
  isExpanded: boolean;
  expandedMode: string;
  isWikiActive: boolean;
  activeIsSticky: boolean;
  isCollapsed: boolean;
  hasActiveSection: boolean;
}

function computeExpandedSize(prev: SizePresets, expandedMode: string): SizePresets {
  if (expandedMode === "search") return SIZE_PRESETS.ULTRA; // 630px wide
  if (expandedMode === "notifications") {
    return prev === SIZE_PRESETS.ULTRA ? SIZE_PRESETS.ULTRA : SIZE_PRESETS.TALL;
  }
  if (expandedMode === "settings") {
    return prev === SIZE_PRESETS.ULTRA ? SIZE_PRESETS.ULTRA : SIZE_PRESETS.MEDIUM;
  }
  if (expandedMode === "mycountry") return SIZE_PRESETS.MEDIUM; // 371px wide, the profile and country dropdown
  if (expandedMode.startsWith("plugin:")) return SIZE_PRESETS.ULTRA; // 630px wide
  return SIZE_PRESETS.MEDIUM;
}

function computeWikiPillSize(
  activeIsSticky: boolean,
  isCollapsed: boolean,
  hasActiveSection: boolean
): SizePresets {
  if (activeIsSticky && isCollapsed) {
    return hasActiveSection ? SIZE_PRESETS.COMPACT : SIZE_PRESETS.WIKI_COMPACT; // 170x32 -> 200x36
  }
  if (activeIsSticky) {
    return hasActiveSection ? SIZE_PRESETS.COMPACT_LONG : SIZE_PRESETS.COMPACT; // 200x36 -> 300x44
  }
  return hasActiveSection ? SIZE_PRESETS.COMPACT_LONG : SIZE_PRESETS.WIKI_INLINE; // 280x38 -> 300x44
}

function computePillSize(inputs: SizeInputs): SizePresets {
  const { isWikiActive, isForumActive, activeIsSticky, isCollapsed, hasActiveSection } = inputs;
  if (isWikiActive) return computeWikiPillSize(activeIsSticky, isCollapsed, hasActiveSection);
  if (isForumActive) {
    // 180x32 compact forum text mode, or 300x40 for hover state and expanded full text
    return isCollapsed ? SIZE_PRESETS.WIKI_COMPACT : SIZE_PRESETS.COMPACT_LONG;
  }
  if (activeIsSticky && isCollapsed) return SIZE_PRESETS.COMPACT; // 200x36 pill
  if (activeIsSticky) return SIZE_PRESETS.COMPACT_LONG; // 320x40 pill (hover state)
  return SIZE_PRESETS.COMPACT_TALL; // 360x44 pill (inline in navbar)
}

/** The island preset for the current state. `prev` keeps a widened panel wide across mode changes. */
function computeSize(prev: SizePresets, inputs: SizeInputs): SizePresets {
  if (inputs.isExpanded) return computeExpandedSize(prev, inputs.expandedMode);
  return computePillSize(inputs);
}

function CommandPaletteContent({
  isSticky = false,
  scrollY = 0,
  diState,
  isTourActive = false,
}: {
  isSticky?: boolean;
  scrollY?: number;
  diState: ReturnType<typeof useDynamicIslandState>;
  isTourActive?: boolean;
}) {
  const { setSize } = useHaloSize();
  const mounted = useHydrated();
  const [isCollapsed, setIsCollapsed] = useState(false);
  // The pathname the tray was opened on; navigating elsewhere closes it without an effect
  const [navTrayAt, setNavTrayAt] = useState<{ path: string | null } | null>(null);
  const [pillBounce, setPillBounce] = useState(false);
  const [isNavLoading, setIsNavLoading] = useState(false);

  const [isWriterMode, setIsWriterMode] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const checkWriterMode = () => {
      setIsWriterMode(document.documentElement.classList.contains("wikios-writer-mode"));
    };
    checkWriterMode();
    const observer = new MutationObserver(checkWriterMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const activeIsSticky = isSticky || isWriterMode;

  useEffect(() => {
    const handleStart = () => setIsNavLoading(true);
    const handleEnd = () => setIsNavLoading(false);

    window.addEventListener("ixstats-nav-start", handleStart);
    window.addEventListener("ixstats-nav-end", handleEnd);

    return () => {
      window.removeEventListener("ixstats-nav-start", handleStart);
      window.removeEventListener("ixstats-nav-end", handleEnd);
    };
  }, []);

  // Use shared state management
  const {
    mode,
    isExpanded,
    expandedMode,
    searchQuery,
    debouncedSearchQuery,
    searchFilter,
    isUserInteracting,
    searchResults,
    isSearchPending,
    setSearchQuery,
    setSearchFilter,
    setIsUserInteracting,
    switchMode,
  } = diState;

  const diPathname = usePathname();
  const navTrayOpen = navTrayAt !== null && navTrayAt.path === diPathname;

  // Plugin system: read active plugin
  const activePlugin = useActiveDIPlugin();
  const pluginAccentColor = activePlugin?.accentColor ?? "var(--tint)";
  const isWikiActive = activePlugin?.id === "wiki";

  const { activeSectionId, tocEntries } = useWikiContext();
  const hasActiveSection = !!(activeSectionId && tocEntries.some((e) => e.id === activeSectionId));

  // Dynamic size based on sticky/collapsed state + wiki/forum context + expanded state
  const isForumActive = activePlugin?.id === "forum";
  useEffect(() => {
    setSize((prev) =>
      computeSize(prev, {
        isForumActive,
        isExpanded,
        expandedMode,
        isWikiActive,
        activeIsSticky,
        isCollapsed,
        hasActiveSection,
      })
    );
  }, [
    setSize,
    isForumActive,
    activeIsSticky,
    isCollapsed,
    isWikiActive,
    isExpanded,
    expandedMode,
    hasActiveSection,
  ]);

  // Swipe-up gesture handler
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y < -30 || info.velocity.y < -200) {
      if (!isExpanded) {
        setPillBounce(true);
        setTimeout(() => setPillBounce(false), 300);
        setNavTrayAt({ path: diPathname });
      }
    }
  };

  // Initialize notification store
  const initialize = useNotificationStore((state) => state.initialize);

  useEffect(() => {
    initialize().catch(console.error);
  }, [initialize]);

  // Auto-collapse when sticky and not interacting
  // Not sticky and not forum: the pill is never collapsed, so a leftover collapse is dropped now
  if (!(activeIsSticky || isForumActive) && isCollapsed) setIsCollapsed(false);

  useEffect(() => {
    if ((activeIsSticky || isForumActive) && !isUserInteracting && !isCollapsed) {
      const id = setTimeout(() => setIsCollapsed(true), 1200);
      return () => clearTimeout(id);
    }
    return;
  }, [activeIsSticky, isForumActive, isUserInteracting, isCollapsed]);

  const prevToastIdRef = useRef<string | null>(null);
  const lastTriggerRef = useRef<string | null>(null);

  const openFromTrigger = (nextMode: ViewMode) => {
    lastTriggerRef.current =
      nextMode === "compact" ? null : nextMode.startsWith("plugin:") ? "plugin" : nextMode;
    switchMode(nextMode);
  };

  const closeFromPanel = () => {
    const fallback = expandedMode.startsWith("plugin:") ? "plugin" : expandedMode;
    const target = lastTriggerRef.current ?? fallback;
    lastTriggerRef.current = null;
    switchMode("compact");
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-halo-trigger="${target}"]`)?.focus();
    });
  };

  // Briefly uncollapse sticky DI so the user sees the notification peek
  const peekForToast = useEffectEvent((toastId: string) => {
    if (toastId === prevToastIdRef.current) return;
    prevToastIdRef.current = toastId;
    if (activeIsSticky && isCollapsed) {
      setIsCollapsed(false);
      setIsUserInteracting(true);
      // Let the auto-collapse timer re-engage after 3s
      setTimeout(() => setIsUserInteracting(false), 3000);
    }
  });

  useEffect(() => {
    // A toast already queued on mount has been seen
    prevToastIdRef.current = useToastQueueStore.getState().queue[0]?.id ?? null;
    return useToastQueueStore.subscribe((state) => {
      const latest = state.queue[0];
      if (latest) peekForToast(latest.id);
    });
  }, []);

  if (!mounted) return null;

  return (
    <>
      <div className="relative">
        {/* DI pill — draggable for swipe-up nav tray. During the walkthrough the island carries
            a static tint ring instead of a looping pulse. It has no movement, so it is the same
            under Reduce Motion. */}
        <motion.div
          data-tour-highlight={isTourActive ? "true" : undefined}
          className={cn("rounded-full", isTourActive && "ring-tint/50 ring-2")}
          animate={{
            y: pillBounce ? -4 : 0,
          }}
          transition={springSnappy}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.15}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          style={{ touchAction: "none" }}
        >
          <Halo id="command-palette">
            {!isExpanded ? (
              <div key="compact" className="h-full w-full">
                <CompactView
                  mode={mode}
                  isSticky={activeIsSticky}
                  isCollapsed={isCollapsed}
                  isNavLoading={isNavLoading}
                  setIsCollapsed={setIsCollapsed}
                  setIsUserInteracting={setIsUserInteracting}
                  onSwitchMode={openFromTrigger}
                  scrollY={scrollY}
                  activePlugin={activePlugin}
                  pluginCenter={activePlugin?.center}
                  pluginActions={activePlugin?.actions}
                  pluginBadge={activePlugin?.badge}
                />
              </div>
            ) : (
              <div key="expanded" className="h-full w-full">
                <ExpandedView
                  mode={expandedMode}
                  onClose={closeFromPanel}
                  onSwitchMode={switchMode}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  searchFilter={searchFilter}
                  setSearchFilter={setSearchFilter}
                  debouncedSearchQuery={debouncedSearchQuery}
                  searchResults={searchResults}
                  isSearchPending={isSearchPending}
                  activePlugin={activePlugin}
                />
              </div>
            )}
          </Halo>

          {/* Section accent line — visible when sticky */}
          {activeIsSticky && (
            <motion.div
              className="pointer-events-none absolute right-1/4 -bottom-0.5 left-1/4 h-[2px] rounded-full"
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 0.8, scaleX: 1 }}
              transition={tweenFast}
              style={{ backgroundColor: pluginAccentColor }}
            />
          )}
        </motion.div>

        {/* Nav tray dropdown */}
        <NavTray isOpen={navTrayOpen && !isExpanded} onClose={() => setNavTrayAt(null)} />

        {/* Walkthrough tooltip overlay */}
        <HaloTourTooltip />
      </div>
    </>
  );
}

export function CommandPalette({ className, isSticky, scrollY }: CommandPaletteProps) {
  const pathname = usePathname();
  const normalizedPath = stripBasePath(pathname || "/");

  // On /maps pages, the MapDynamicIsland provides a dedicated map-specific DI.
  if (normalizedPath.startsWith("/maps")) return null;

  return (
    <HaloTourProvider>
      <HaloProvider initialSize={SIZE_PRESETS.COMPACT_TALL}>
        <CommandPaletteWrapper className={className} isSticky={isSticky} scrollY={scrollY} />
      </HaloProvider>
    </HaloTourProvider>
  );
}

function CommandPaletteWrapper({
  className,
  isSticky,
  scrollY,
}: {
  className?: string;
  isSticky?: boolean;
  scrollY?: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isInitialized = useHydrated();
  const diState = useDynamicIslandState();
  const { isExpanded, switchMode } = diState;

  // Close dropdown when clicking outside - use shared state
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target) return;

      // Ignore elements that have been unmounted during the click lifecycle
      if (!target.isConnected) {
        return;
      }

      // Allow clicks inside Radix portals/popovers/dialogs/tooltips
      if (
        target.closest("[data-radix-popper-content-wrapper]") ||
        target.closest("[role='dialog']") ||
        target.closest("[role='tooltip']")
      ) {
        return;
      }

      if (!target.closest("#command-palette")) {
        switchMode("compact");
      }
    };

    if (isExpanded && isInitialized) {
      document.addEventListener("mousedown", handleClickOutside, { passive: true });
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
    return;
  }, [isExpanded, isInitialized, switchMode]);

  const { isActive: isTourActive } = useHaloTour();

  // Don't render until properly initialized
  if (!isInitialized) {
    return null;
  }

  return (
    <div
      ref={wrapperRef}
      className={`z-nav pointer-events-none relative flex w-full items-center justify-center ${className || ""}`}
      style={{
        maxWidth: isExpanded ? "100%" : isSticky ? "400px" : "100%",
      }}
    >
      <div className="pointer-events-auto">
        <CommandPaletteContent
          isSticky={isSticky}
          scrollY={scrollY}
          diState={diState}
          isTourActive={isTourActive}
        />
      </div>
    </div>
  );
}

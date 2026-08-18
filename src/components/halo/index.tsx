"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, type PanInfo } from "motion/react";
import {
  DynamicIsland,
  useDynamicIslandSize,
  SIZE_PRESETS,
  DynamicIslandProvider,
  type SizePresets,
} from "../ui/dynamic-island";
import { CompactView } from "./CompactView";
import { ExpandedView } from "./ExpandedView";
import { NavTray, getSectionForPath } from "./NavTray";
import { useDynamicIslandState } from "./hooks";
// eslint-disable-next-line unused-imports/no-unused-imports
import { useActiveDIPlugin, DIPluginProvider } from "./plugin-context";
import { useNotificationStore } from "~/stores/notificationStore";
import { useToastQueueStore } from "~/stores/toastQueueStore";
import { IOSActivityIndicator } from "~/components/ui/loader";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { HaloTourProvider, useHaloTour } from "./HaloTourContext";
import { HaloTourTooltip } from "./HaloTourTooltip";

// Re-export original dynamic island components for backward compatibility
export {
  DynamicIsland,
  DynamicContainer,
  useDynamicIslandSize,
  SIZE_PRESETS,
  DynamicIslandProvider,
  Halo,
  HaloContainer,
  useHaloSize,
  HaloProvider,
} from "../ui/dynamic-island";

// Re-export plugin system for page-level consumption
export {
  useDIPlugin,
  useActiveDIPlugin,
  useAllDIPlugins,
  useDIPluginView,
  DIPluginProvider,
} from "./plugin-context";
export type { DIPlugin, DIAction, DIViewProps, DIBadge } from "./types";

interface CommandPaletteProps {
  className?: string;
  isSticky?: boolean;
  scrollY?: number;
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
  const { state: diSizeState, setSize } = useDynamicIslandSize();
  const [mounted, setMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [diPulseClass, setDiPulseClass] = useState("");
  const [navTrayOpen, setNavTrayOpen] = useState(false);
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
    countriesData,
    setMode,
    setIsExpanded,
    setExpandedMode,
    setSearchQuery,
    setSearchFilter,
    setIsUserInteracting,
    switchMode,
  } = diState;

  const diPathname = usePathname();
  const prevNavRef = useRef(diPathname);
  const sectionInfo = getSectionForPath(diPathname || "/");

  // ── Plugin system: read active plugin ──
  const activePlugin = useActiveDIPlugin();
  const pluginAccentColor = activePlugin?.accentColor ?? sectionInfo.accent;
  const isWikiActive = activePlugin?.id === "wiki";

  const { activeSectionId, tocEntries } = useWikiContext();
  const hasActiveSection = !!(activeSectionId && tocEntries.some((e) => e.id === activeSectionId));

  // Dynamic size based on sticky/collapsed state + wiki/forum context + expanded state
  useEffect(() => {
    let newSize: SizePresets;
    const isForumActive = activePlugin?.id === "forum";

    if (isNavLoading) {
      newSize = SIZE_PRESETS.WIKI_COMPACT; // compact loading pill size (180x40)
    } else if (isExpanded) {
      if (expandedMode === "search") {
        newSize = SIZE_PRESETS.ULTRA; // 630px wide
      } else if (expandedMode === "notifications") {
        newSize = diSizeState.size === SIZE_PRESETS.ULTRA ? SIZE_PRESETS.ULTRA : SIZE_PRESETS.TALL;
      } else if (expandedMode === "settings") {
        newSize = SIZE_PRESETS.MEDIUM; // 371px wide
      } else if (expandedMode === "mycountry") {
        newSize = SIZE_PRESETS.MEDIUM; // 371px wide — profile/country dropdown
      } else if (expandedMode.startsWith("plugin:")) {
        newSize = SIZE_PRESETS.ULTRA; // 630px wide
      } else {
        newSize = SIZE_PRESETS.MEDIUM;
      }
    } else {
      if (isWikiActive) {
        if (activeIsSticky && isCollapsed) {
          newSize = hasActiveSection ? SIZE_PRESETS.COMPACT : SIZE_PRESETS.WIKI_COMPACT; // 170x32 -> 200x36
        } else if (activeIsSticky) {
          newSize = hasActiveSection ? SIZE_PRESETS.COMPACT_LONG : SIZE_PRESETS.COMPACT; // 200x36 -> 300x44
        } else {
          newSize = hasActiveSection ? SIZE_PRESETS.COMPACT_LONG : SIZE_PRESETS.WIKI_INLINE; // 280x38 -> 300x44
        }
      } else if (isForumActive) {
        if (isCollapsed) {
          newSize = SIZE_PRESETS.WIKI_COMPACT; // 180x32 — compact forum text mode
        } else {
          newSize = SIZE_PRESETS.COMPACT_LONG; // 300x40 — hover state/expanded full text
        }
      } else {
        if (activeIsSticky && isCollapsed) {
          newSize = SIZE_PRESETS.COMPACT; // 200x36 pill
        } else if (activeIsSticky && !isCollapsed) {
          newSize = SIZE_PRESETS.COMPACT_LONG; // 320x40 pill (hover state)
        } else {
          newSize = SIZE_PRESETS.COMPACT_TALL; // 360x44 pill (inline in navbar)
        }
      }
    }
    setSize(newSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    setSize,
    activeIsSticky,
    isCollapsed,
    isWikiActive,
    activePlugin?.id,
    isExpanded,
    expandedMode,
    isNavLoading,
    hasActiveSection,
  ]);

  useEffect(() => {
    if (isWikiActive && diPathname !== prevNavRef.current) {
      prevNavRef.current = diPathname;
      setDiPulseClass("animate-di-nav-pulse");
      const timer = setTimeout(() => setDiPulseClass(""), 400);
      return () => clearTimeout(timer);
    }
    return;
  }, [diPathname, isWikiActive]);

  // Close nav tray when navigating
  useEffect(() => {
    setNavTrayOpen(false);
  }, [diPathname]);

  // Swipe-up gesture handler
  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.y < -30 || info.velocity.y < -200) {
        if (!isExpanded) {
          setPillBounce(true);
          setTimeout(() => setPillBounce(false), 300);
          setNavTrayOpen(true);
        }
      }
    },
    [isExpanded]
  );

  // Initialize notification store
  const initialize = useNotificationStore((state) => state.initialize);

  useEffect(() => {
    setMounted(true);
    initialize().catch(console.error);
  }, [initialize]);

  // Auto-collapse when sticky and not interacting - optimized with proper cleanup
  const collapseTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    // Clear existing timeout
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
    }

    const isForumActive = activePlugin?.id === "forum";

    if ((activeIsSticky || isForumActive) && !isUserInteracting && !isCollapsed) {
      collapseTimeoutRef.current = setTimeout(() => setIsCollapsed(true), 1200);
    } else if (!(activeIsSticky || isForumActive) && isCollapsed) {
      // Immediately expand when not sticky and not forum
      setIsCollapsed(false);
    }

    return () => {
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }
    };
  }, [activeIsSticky, isUserInteracting, isCollapsed, activePlugin?.id]);

  // Track manual close state to prevent unwanted auto-expansion
  const wasManuallyClosedRef = useRef(true); // Start compact on mount

  // Reset manual close when the URL (section/step) changes
  const lastUrlRef = useRef("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentUrl = window.location.pathname + window.location.search;
      if (lastUrlRef.current && currentUrl !== lastUrlRef.current) {
        wasManuallyClosedRef.current = false;
      }
      lastUrlRef.current = currentUrl;
    }
  }, [diPathname, activePlugin]);

  // Reset manual close flag when builder plugin view is manually expanded
  useEffect(() => {
    if (activePlugin?.id === "builder" && mode === "plugin:builder") {
      wasManuallyClosedRef.current = false;
    }
  }, [mode, activePlugin]);

  // Set manual close flag when leaving builder plugin mode
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (activePlugin?.id === "builder") {
      if (
        prevModeRef.current === "plugin:builder" &&
        (mode === "compact" ||
          mode === "search" ||
          mode === "settings" ||
          mode === "notifications" ||
          mode === "mycountry")
      ) {
        wasManuallyClosedRef.current = true;
      }
    }
    prevModeRef.current = mode;
  }, [mode, activePlugin]);

  // Scroll-based collapse/expand for the builder hero DI
  const prevIsStickyRef = useRef(activeIsSticky);
  useEffect(() => {
    if (activePlugin?.id === "builder") {
      const selectedTemplate =
        activePlugin.filter && typeof activePlugin.filter === "object"
          ? (activePlugin.filter as Record<string, unknown>).selectedTemplate
          : undefined;

      if (activeIsSticky && !prevIsStickyRef.current && isExpanded) {
        switchMode("compact");
      } else if (!activeIsSticky && prevIsStickyRef.current && !isExpanded) {
        if (!wasManuallyClosedRef.current && !selectedTemplate) {
          switchMode("plugin:builder");
        }
      }
    }
    prevIsStickyRef.current = activeIsSticky;
  }, [activeIsSticky, activePlugin, isExpanded, switchMode]);

  // Trigger-based expansion (e.g. on country select, or welcome modal close)
  const lastProcessedTriggerRef = useRef(0);
  useEffect(() => {
    if (activePlugin?.id === "builder") {
      const pluginTrigger =
        activePlugin.filter && typeof activePlugin.filter === "object"
          ? (activePlugin.filter as Record<string, unknown>).diExpansionTrigger
          : undefined;

      if (typeof pluginTrigger === "number") {
        if (pluginTrigger > lastProcessedTriggerRef.current) {
          lastProcessedTriggerRef.current = pluginTrigger;
          wasManuallyClosedRef.current = false; // Reset on trigger expansion
          switchMode("plugin:builder");
        } else if (pluginTrigger < lastProcessedTriggerRef.current) {
          lastProcessedTriggerRef.current = pluginTrigger;
        }
      }
    }
  }, [activePlugin, switchMode]);

  // Ring + bump animation on any new toast
  const [ringActive, setRingActive] = useState(false);
  const toastQueue = useToastQueueStore((s) => s.queue);
  const prevToastIdRef = useRef<string | null>(null);

  useEffect(() => {
    const latest = toastQueue[0];
    if (!latest || latest.id === prevToastIdRef.current) return;
    prevToastIdRef.current = latest.id;

    // Trigger ring + bump
    setRingActive(true);

    // Briefly uncollapse sticky DI so the user sees the notification peek
    if (activeIsSticky && isCollapsed) {
      setIsCollapsed(false);
      setIsUserInteracting(true);
      // Let the auto-collapse timer re-engage after 3s
      setTimeout(() => setIsUserInteracting(false), 3000);
    }

    // Also pulse for critical
    if (latest.priority === "critical") {
      setDiPulseClass("animate-di-critical");
      setTimeout(() => setDiPulseClass(""), 1200);
    }

    const timer = setTimeout(() => setRingActive(false), 600);
    return () => clearTimeout(timer);
  }, [toastQueue, activeIsSticky, isCollapsed, setIsUserInteracting]);

  if (!mounted) return null;

  return (
    <>
      <div className="relative">
        {/* Expanding ring on new notification */}
        <AnimatePresence>
          {ringActive && (
            <motion.div
              key="ring"
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-blue-400/60"
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 1.35, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>

        {/* DI pill — draggable for swipe-up nav tray */}
        <motion.div
          className={`rounded-full ${diPulseClass}`}
          animate={{
            scale: ringActive ? 1.04 : 1,
            y: pillBounce ? -4 : 0,
            boxShadow: isTourActive
              ? [
                  "0 0 0px rgba(59, 130, 246, 0)",
                  "0 0 15px rgba(59, 130, 246, 0.5)",
                  "0 0 0px rgba(59, 130, 246, 0)",
                ]
              : "0 0 0px rgba(0, 0, 0, 0)",
          }}
          transition={
            isTourActive
              ? {
                  boxShadow: {
                    repeat: Infinity,
                    duration: 2,
                    ease: "easeInOut",
                  },
                  scale: { type: "spring", stiffness: 500, damping: 20 },
                  y: { type: "spring", stiffness: 500, damping: 20 },
                }
              : { type: "spring", stiffness: 500, damping: 20 }
          }
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.15}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          style={{ touchAction: "none" }}
        >
          <DynamicIsland id="command-palette">
            {isNavLoading ? (
              <div
                key="loading"
                className="flex h-10 w-full items-center justify-center gap-2 px-3 text-neutral-200"
              >
                <IOSActivityIndicator size="sm" />
                <span className="animate-pulse text-xs font-semibold tracking-wide">
                  Loading...
                </span>
              </div>
            ) : !isExpanded ? (
              <div key="compact" className="h-full w-full">
                <CompactView
                  mode={mode}
                  isSticky={activeIsSticky}
                  isCollapsed={isCollapsed}
                  setIsCollapsed={setIsCollapsed}
                  setIsUserInteracting={setIsUserInteracting}
                  onSwitchMode={switchMode}
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
                  onClose={() => switchMode("compact")}
                  onSwitchMode={switchMode}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  searchFilter={searchFilter}
                  setSearchFilter={setSearchFilter}
                  debouncedSearchQuery={debouncedSearchQuery}
                  searchResults={searchResults}
                  countriesData={countriesData}
                  activePlugin={activePlugin}
                />
              </div>
            )}
          </DynamicIsland>

          {/* Section accent line — visible when sticky */}
          {activeIsSticky && (
            <motion.div
              className="pointer-events-none absolute right-1/4 -bottom-0.5 left-1/4 h-[2px] rounded-full"
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 0.8, scaleX: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              style={{ backgroundColor: pluginAccentColor }}
            />
          )}
        </motion.div>

        {/* Nav tray dropdown */}
        <NavTray isOpen={navTrayOpen && !isExpanded} onClose={() => setNavTrayOpen(false)} />

        {/* Walkthrough tooltip overlay */}
        <HaloTourTooltip />
      </div>
    </>
  );
}

export function CommandPalette({ className, isSticky, scrollY }: CommandPaletteProps) {
  const pathname = usePathname();

  // On /maps pages, the MapDynamicIsland provides a dedicated map-specific DI
  if (pathname?.startsWith("/maps")) return null;

  return (
    <HaloTourProvider>
      <DynamicIslandProvider initialSize={SIZE_PRESETS.COMPACT_TALL}>
        <CommandPaletteWrapper className={className} isSticky={isSticky} scrollY={scrollY} />
      </DynamicIslandProvider>
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
  const [isInitialized, setIsInitialized] = useState(false);
  const diState = useDynamicIslandState();
  const { isExpanded, switchMode } = diState;

  // Initialize once on mount
  useEffect(() => {
    setIsInitialized(true);

    return () => {
      setIsInitialized(false);
    };
  }, []);

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
        target.closest("[data-radix-portal]") ||
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
      className={`pointer-events-none relative z-[10000] flex w-full items-center justify-center ${className || ""}`}
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

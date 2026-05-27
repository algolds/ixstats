// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, type PanInfo } from "motion/react";
import {
  DynamicIsland,
  useDynamicIslandSize,
  SIZE_PRESETS,
  DynamicIslandProvider,
} from "../ui/dynamic-island";
import { CompactView } from "./CompactView";
import { ExpandedView } from "./ExpandedView";
import { NavTray, getSectionForPath } from "./NavTray";
import { useDynamicIslandState } from "./hooks";
import { useActiveDIPlugin, DIPluginProvider } from "./plugin-context";
import { useNotificationStore } from "~/stores/notificationStore";
import { useToastQueueStore } from "~/stores/toastQueueStore";

// Re-export original dynamic island components for backward compatibility
export {
  DynamicIsland,
  DynamicContainer,
  useDynamicIslandSize,
  SIZE_PRESETS,
  DynamicIslandProvider,
} from "../ui/dynamic-island";

// Re-export plugin system for page-level consumption
export { useDIPlugin, useActiveDIPlugin, useAllDIPlugins, useDIPluginView, DIPluginProvider } from "./plugin-context";
export type { DIPlugin, DIAction, DIViewProps, DIBadge } from "./types";

interface CommandPaletteProps {
  className?: string;
  isSticky?: boolean;
  scrollY?: number;
}

function CommandPaletteContent({
  isSticky = false,
  scrollY = 0,
}: {
  isSticky?: boolean;
  scrollY?: number;
}) {
  const { setSize } = useDynamicIslandSize();
  const [mounted, setMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [diPulseClass, setDiPulseClass] = useState("");
  const [navTrayOpen, setNavTrayOpen] = useState(false);
  const [pillBounce, setPillBounce] = useState(false);

  // Use shared state management
  const {
    mode,
    isExpanded,
    expandedMode,
    searchQuery,
    debouncedSearchQuery,
    searchFilter,
    isUserInteracting,
    timeDisplayMode,
    searchResults,
    countriesData,
    setMode,
    setIsExpanded,
    setExpandedMode,
    setSearchQuery,
    setSearchFilter,
    setIsUserInteracting,
    setTimeDisplayMode,
    switchMode,
  } = useDynamicIslandState();

  const diPathname = usePathname();
  const prevNavRef = useRef(diPathname);
  const sectionInfo = getSectionForPath(diPathname || "/");

  // ── Plugin system: read active plugin ──
  const activePlugin = useActiveDIPlugin();
  const pluginAccentColor = activePlugin?.accentColor ?? sectionInfo.accent;
  const isWikiActive = activePlugin?.id === "wiki";

  // Dynamic size based on sticky/collapsed state + wiki context
  useEffect(() => {
    let newSize: string;
    if (isWikiActive) {
      if (isSticky && isCollapsed) {
        newSize = SIZE_PRESETS.WIKI_COMPACT; // 170x32 — compact wiki pill
      } else if (isSticky) {
        newSize = SIZE_PRESETS.COMPACT; // 200x36 — hover state
      } else {
        newSize = SIZE_PRESETS.WIKI_INLINE; // 280x38 — inline wiki pill
      }
    } else {
      if (isSticky && isCollapsed) {
        newSize = SIZE_PRESETS.COMPACT; // 200x36 pill
      } else if (isSticky && !isCollapsed) {
        newSize = SIZE_PRESETS.COMPACT_LONG; // 320x40 pill (hover state)
      } else {
        newSize = SIZE_PRESETS.COMPACT_TALL; // 360x44 pill (inline in navbar)
      }
    }
    setSize(newSize);
  }, [setSize, isSticky, isCollapsed, isWikiActive]);

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

    if (isSticky && !isUserInteracting && !isCollapsed) {
      collapseTimeoutRef.current = setTimeout(() => setIsCollapsed(true), 1200);
    } else if (!isSticky && isCollapsed) {
      // Immediately expand when not sticky
      setIsCollapsed(false);
    }

    return () => {
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }
    };
  }, [isSticky, isUserInteracting, isCollapsed]);

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
    if (isSticky && isCollapsed) {
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
  }, [toastQueue, isSticky, isCollapsed, setIsUserInteracting]);

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
          }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.15}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          style={{ touchAction: "none" }}
        >
          <DynamicIsland id="command-palette">
            <CompactView
              isSticky={isSticky}
              isCollapsed={isCollapsed}
              setIsCollapsed={setIsCollapsed}
              setIsUserInteracting={setIsUserInteracting}
              timeDisplayMode={timeDisplayMode}
              setTimeDisplayMode={setTimeDisplayMode}
              onSwitchMode={switchMode}
              scrollY={scrollY}
              activePlugin={activePlugin}
              pluginCenter={activePlugin?.center}
              pluginActions={activePlugin?.actions}
              pluginBadge={activePlugin?.badge}
            />
          </DynamicIsland>

          {/* Section accent line — visible when sticky */}
          {isSticky && (
            <motion.div
              className="pointer-events-none absolute -bottom-0.5 left-1/4 right-1/4 h-[2px] rounded-full"
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 0.8, scaleX: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              style={{ backgroundColor: pluginAccentColor }}
            />
          )}
        </motion.div>

        {/* Nav tray dropdown */}
        <NavTray
          isOpen={navTrayOpen && !isExpanded}
          onClose={() => setNavTrayOpen(false)}
        />
      </div>

      {/* Expanded dropdown content - only on desktop */}
      {isExpanded && (
        <ExpandedView
          mode={expandedMode}
          onClose={() => switchMode("compact")}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          debouncedSearchQuery={debouncedSearchQuery}
          searchResults={searchResults}
          countriesData={countriesData}
          activePlugin={activePlugin}
        />
      )}
    </>
  );
}

export function CommandPalette({ className, isSticky, scrollY }: CommandPaletteProps) {
  const pathname = usePathname();

  // On /maps pages, the MapDynamicIsland provides a dedicated map-specific DI
  if (pathname?.startsWith("/maps")) return null;

  return (
    <div
      className={`z-[10000] flex items-center justify-center ${className || ""}`}
      style={{
        width: "100%", // Always use full width for proper centering
        maxWidth: isSticky ? "400px" : "100%",
      }}
    >
      <DynamicIslandProvider initialSize={SIZE_PRESETS.COMPACT_TALL}>
        <DIPluginProvider>
          <CommandPaletteWrapper isSticky={isSticky} scrollY={scrollY} />
        </DIPluginProvider>
      </DynamicIslandProvider>
    </div>
  );
}

function CommandPaletteWrapper({ isSticky, scrollY }: { isSticky?: boolean; scrollY?: number }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { isExpanded, switchMode } = useDynamicIslandState();

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
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        switchMode("compact");
      }
    };

    if (isExpanded && isInitialized) {
      document.addEventListener("mousedown", handleClickOutside, { passive: true });
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
    return;
  }, [isExpanded, isInitialized, switchMode]);

  // Don't render until properly initialized
  if (!isInitialized) {
    return null;
  }

  return (
    <div ref={wrapperRef} className="relative flex items-center justify-center">
      <CommandPaletteContent isSticky={isSticky} scrollY={scrollY} />
    </div>
  );
}

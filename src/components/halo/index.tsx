"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { stripBasePath } from "~/lib/base-path";
import { motion, type PanInfo } from "motion/react";
import { Halo, useHaloSize, SIZE_PRESETS, HaloProvider, type SizePresets } from "./HaloPrimitives";
import { CompactView, ExpandedView, NavTray } from "./views";
import { useDynamicIslandState } from "./hooks";
import type { CommandPaletteProps, ViewMode } from "./types";
import { isChromelessPath, type AppDefinition } from "~/lib/navigation/app-sections";
import { useActiveDIPlugin } from "./plugin-context";
import { useNotificationStore } from "~/stores/notificationStore";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { HaloTourProvider, useHaloTour } from "./HaloTourContext";
import { springSnappy } from "~/lib/design/motion";
import { cn } from "~/lib/utils";
import { useHydrated } from "~/hooks/useHydrated";

const HaloTourTooltip = dynamic(() => import("./HaloTourTooltip").then((m) => m.HaloTourTooltip), {
  ssr: false,
});

interface SizeInputs {
  isExpanded: boolean;
  expandedMode: string;
  ownsWikiCenter: boolean;
  hasActiveSection: boolean;
}

function computeExpandedSize(expandedMode: string): SizePresets {
  if (expandedMode === "search") return SIZE_PRESETS.ULTRA; // 630px wide
  if (expandedMode === "notifications") return SIZE_PRESETS.TALL;
  if (expandedMode === "settings") return SIZE_PRESETS.MEDIUM;
  if (expandedMode === "mycountry") return SIZE_PRESETS.MEDIUM; // 371px wide, the profile and country dropdown
  if (expandedMode.startsWith("plugin:")) return SIZE_PRESETS.ULTRA; // 630px wide
  return SIZE_PRESETS.MEDIUM;
}

function computePillSize(inputs: SizeInputs): SizePresets {
  if (inputs.ownsWikiCenter) {
    return inputs.hasActiveSection ? SIZE_PRESETS.COMPACT_LONG : SIZE_PRESETS.WIKI_INLINE;
  }
  return SIZE_PRESETS.COMPACT_TALL;
}

/** Deterministic island preset per mode so switching panels never races stale size state. */
function computeSize(inputs: SizeInputs): SizePresets {
  if (inputs.isExpanded) return computeExpandedSize(inputs.expandedMode);
  return computePillSize(inputs);
}

function CommandPaletteContent({
  diState,
  isTourActive = false,
  trayApps,
}: {
  diState: ReturnType<typeof useDynamicIslandState>;
  isTourActive?: boolean;
  trayApps?: readonly AppDefinition[];
}) {
  const { setSize } = useHaloSize();
  // The pathname the tray was opened on; navigating elsewhere closes it without an effect
  const [navTrayAt, setNavTrayAt] = useState<{ path: string | null } | null>(null);
  const [pillBounce, setPillBounce] = useState(false);
  const [isNavLoading, setIsNavLoading] = useState(false);

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
    searchResults,
    isSearchPending,
    setSearchQuery,
    setSearchFilter,
    switchMode,
  } = diState;

  const diPathname = usePathname();
  const normalizedDiPath = stripBasePath(diPathname || "/");
  const isChromeless = isChromelessPath(normalizedDiPath);
  const navTrayOpen = isChromeless && navTrayAt !== null && navTrayAt.path === diPathname;

  // Plugin system: read active plugin
  const activePlugin = useActiveDIPlugin();
  const ownsWikiCenter = activePlugin?.id === "wiki" && Boolean(activePlugin.center);

  const { activeSectionId, tocEntries } = useWikiContext();
  const hasActiveSection = !!(activeSectionId && tocEntries.some((e) => e.id === activeSectionId));

  useEffect(() => {
    setSize(
      computeSize({
        isExpanded,
        expandedMode,
        ownsWikiCenter,
        hasActiveSection,
      })
    );
  }, [setSize, ownsWikiCenter, isExpanded, expandedMode, hasActiveSection]);

  // Downward pull gesture opens NavTray below the island on chromeless routes
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!isChromeless || isExpanded) return;
    if (info.offset.y > 30 || info.velocity.y > 200) {
      setPillBounce(true);
      setTimeout(() => setPillBounce(false), 300);
      setNavTrayAt({ path: diPathname });
    } else if (navTrayOpen && (info.offset.y < -20 || info.velocity.y < -150)) {
      setNavTrayAt(null);
    }
  };

  // Initialize notification store
  const initialize = useNotificationStore((state) => state.initialize);

  useEffect(() => {
    initialize().catch(console.error);
  }, [initialize]);

  const lastTriggerRef = useRef<string | null>(null);

  const openFromTrigger = (nextMode: ViewMode, triggerOverride?: string) => {
    setNavTrayAt(null);
    lastTriggerRef.current =
      nextMode === "compact"
        ? null
        : (triggerOverride ?? (nextMode.startsWith("plugin:") ? "plugin" : nextMode));
    switchMode(nextMode);
  };

  const closeFromPanel = () => {
    const fallback = expandedMode.startsWith("plugin:") ? "plugin" : expandedMode;
    const target = lastTriggerRef.current ?? fallback;
    lastTriggerRef.current = null;
    switchMode("compact");
    requestAnimationFrame(() => {
      (
        document.querySelector<HTMLElement>(`[data-halo-trigger="${target}"]`) ??
        document.querySelector<HTMLElement>(`[data-halo-trigger="${fallback}"]`)
      )?.focus();
    });
  };

  return (
    <div className="relative">
      {/* DI pill — chromeless routes allow a downward pull for the quick-navigation tray. During the
          walkthrough the island carries a static tint ring instead of a looping pulse. */}
      <motion.div
        data-tour-highlight={isTourActive ? "true" : undefined}
        className={cn("rounded-full", isTourActive && "ring-tint/50 ring-2")}
        animate={{
          y: pillBounce ? 4 : 0,
        }}
        transition={springSnappy}
        drag={isChromeless ? "y" : false}
        dragConstraints={isChromeless ? { top: 0, bottom: 0 } : undefined}
        dragElastic={isChromeless ? 0.15 : undefined}
        dragMomentum={false}
        onDragEnd={isChromeless ? handleDragEnd : undefined}
        style={isChromeless ? { touchAction: "none" } : undefined}
      >
        <Halo id="command-palette">
          {!isExpanded ? (
            <div key="compact" className="h-full w-full">
              <CompactView
                mode={mode}
                isNavLoading={isNavLoading}
                onSwitchMode={openFromTrigger}
                activePlugin={activePlugin}
                pluginCenter={activePlugin?.center}
                pluginCenterActions={activePlugin?.centerActions}
                pluginActions={activePlugin?.actions}
                pluginBadge={activePlugin?.badge}
                showNavTrayTrigger={isChromeless}
                navTrayOpen={navTrayOpen && !isExpanded}
                onToggleNavTray={() =>
                  setNavTrayAt((prev) =>
                    prev !== null && prev.path === diPathname ? null : { path: diPathname }
                  )
                }
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
      </motion.div>

      {/* Quick navigation tray (chromeless routes only, where AppSidebar / TabBar are absent) */}
      {isChromeless && (
        <NavTray
          isOpen={navTrayOpen && !isExpanded}
          onClose={() => setNavTrayAt(null)}
          apps={trayApps}
        />
      )}

      {/* Walkthrough tooltip overlay */}
      <HaloTourTooltip />
    </div>
  );
}

export function CommandPalette({ className, trayApps, searchApps }: CommandPaletteProps) {
  return (
    <HaloTourProvider>
      <HaloProvider initialSize={SIZE_PRESETS.COMPACT_TALL}>
        <CommandPaletteWrapper className={className} trayApps={trayApps} searchApps={searchApps} />
      </HaloProvider>
    </HaloTourProvider>
  );
}

function CommandPaletteWrapper({ className, trayApps, searchApps }: CommandPaletteProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isInitialized = useHydrated();
  const diState = useDynamicIslandState({ searchApps });
  const { isExpanded, switchMode } = diState;

  // Close dropdown when clicking outside - use shared state
  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
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
      document.addEventListener("pointerdown", handleClickOutside, { passive: true });
      return () => document.removeEventListener("pointerdown", handleClickOutside);
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
      className={`z-nav pointer-events-none relative flex w-full max-w-full items-center justify-center ${className || ""}`}
    >
      <div className="pointer-events-auto">
        <CommandPaletteContent diState={diState} isTourActive={isTourActive} trayApps={trayApps} />
      </div>
    </div>
  );
}

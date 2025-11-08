import React, { useState, useEffect, useRef } from "react";
import {
  DynamicIsland,
  useDynamicIslandSize,
  SIZE_PRESETS,
  DynamicIslandProvider,
} from "../ui/dynamic-island";
import { CompactView } from "./CompactView";
import { ExpandedView } from "./ExpandedView";
import { useDynamicIslandState } from "./hooks";
import { useNotificationStore } from "~/stores/notificationStore";

// Re-export original dynamic island components for backward compatibility
export {
  DynamicIsland,
  DynamicContainer,
  useDynamicIslandSize,
  SIZE_PRESETS,
  DynamicIslandProvider,
} from "../ui/dynamic-island";

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
    crisisEvents,
    setMode,
    setIsExpanded,
    setExpandedMode,
    setSearchQuery,
    setSearchFilter,
    setIsUserInteracting,
    setTimeDisplayMode,
    switchMode,
  } = useDynamicIslandState();

  // Dynamic size based on sticky/collapsed state - optimized for performance
  useEffect(() => {
    const newSize =
      isSticky && isCollapsed
        ? SIZE_PRESETS.COMPACT
        : mode === "compact" || !isSticky
          ? SIZE_PRESETS.COMPACT_TALL
          : SIZE_PRESETS.DEFAULT;

    setSize(newSize);
  }, [mode, setSize, isSticky, isCollapsed]);

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

  if (!mounted) return null;

  return (
    <>
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
          crisisEvents={crisisEvents}
        />
      </DynamicIsland>

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
          crisisEvents={crisisEvents}
        />
      )}
    </>
  );
}

export function CommandPalette({ className, isSticky, scrollY }: CommandPaletteProps) {
  return (
    <div
      className={`z-[10000] flex items-center justify-center ${className || ""}`}
      style={{
        width: "100%", // Always use full width for proper centering
        maxWidth: isSticky ? "600px" : "100%", // Constrain max width when sticky
      }}
    >
      <DynamicIslandProvider initialSize={SIZE_PRESETS.COMPACT_TALL}>
        <CommandPaletteWrapper isSticky={isSticky} scrollY={scrollY} />
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

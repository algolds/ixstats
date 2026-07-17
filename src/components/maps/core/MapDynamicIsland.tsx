"use client";

/**
 * MapDynamicIsland — Self-contained Dynamic Island for the maps page.
 *
 * Replaces BOTH the navbar DI and MapSearchOverlay with a single unified control.
 * Features:
 * - IX logo → home/maps
 * - IxTime display
 * - Auth greeting / sign-in prompt
 * - Search icon → geo search
 * - Settings popover → theme + projection only
 * - Click-outside → smooth retraction
 *
 * All with polished Apple-style liquid glass animations on desktop,
 * and simplified high-performance rendering on mobile.
 */

import { AnimatePresence, motion } from "motion/react";
import { Search, X, Globe, Loader2, MessageCircle, Bell, HelpCircle } from "lucide-react";
// eslint-disable-next-line unused-imports/no-unused-imports
import { withBasePath } from "~/lib/base-path";
import type { ProjectionMode, MapLayerType } from "~/lib/map-config";
import { cn } from "~/lib/utils";
import { useIsMobile } from "~/hooks/useIsMobile";
import type { OverlayVisibility } from "./IxWorldMap";

// Extracted state hook, components, and helper utilities
import { useDynamicIslandState } from "./hooks/useDynamicIslandState";
import { AuthSection } from "./components/AuthSection";
import { MapSettingsPopover } from "./components/MapSettingsPopover";
import { MapLayersPopover } from "./components/MapLayersPopover";
import { TYPE_META, SPRING, SPRING_SOFT, FlagIcon } from "./utils/dynamic-island-helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MapSearchResult {
  type: string;
  id: string;
  name: string;
  countryId: string | null;
  centroidLng: number;
  centroidLat: number;
}

interface MapDynamicIslandProps {
  projectionMode: ProjectionMode;
  onProjectionChange: (mode: ProjectionMode) => void;
  onSearchResult: (result: MapSearchResult) => void;
  onOpenWelcome?: () => void;
  visibleLayers: Set<MapLayerType>;
  onToggleLayer: (layer: MapLayerType) => void;
  overlayVisibility?: OverlayVisibility;
  onToggleOverlay?: (key: keyof OverlayVisibility) => void;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function MapDynamicIsland({
  projectionMode,
  onProjectionChange,
  onSearchResult,
  onOpenWelcome,
  visibleLayers,
  onToggleLayer,
  overlayVisibility,
  onToggleOverlay,
}: MapDynamicIslandProps) {
  const isMobile = useIsMobile();
  const {
    searchOpen,
    query,
    setQuery,
    selectedIdx,
    setSelectedIdx,
    isFlashing,
    containerRef,
    inputRef,
    user,
    isLoaded,
    theme,
    effectiveTheme,
    setTheme,
    router,
    greeting,
    countryName,
    messageUnreadCount,
    unreadNotifications,
    totalUnread,
    searchLoading,
    grouped,
    flatResults,
    showResults,
    hasResults,
    openSearch,
    closeSearch,
    handleSelect,
    handleKeyDown,
  } = useDynamicIslandState({ onSearchResult });

  const debouncedQueryLength = query.trim().length;

  const mobilePill = (
    <div
      className={cn(
        "relative overflow-hidden rounded-full border shadow-xl transition-colors duration-200",
        isFlashing ? "border-red-500/50" : "border-white/10"
      )}
      style={{
        background: "rgba(0, 0, 0, 0.85)",
      }}
    >
      <div className="relative z-10">
        {searchOpen ? (
          /* ── Mobile Expanded: Search Input ── */
          <div className="flex items-center gap-2 px-4 py-2">
            <Search className="text-muted-foreground h-4 w-4 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIdx(-1);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search countries, cities, places…"
              className="text-foreground placeholder:text-muted-foreground w-[calc(100vw-120px)] bg-transparent text-sm outline-none"
            />
            {searchLoading && debouncedQueryLength >= 2 && (
              <Loader2 className="text-muted-foreground h-3.5 w-3.5 shrink-0 animate-spin" />
            )}
            <button
              onClick={closeSearch}
              className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-full p-1 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          /* ── Mobile Compact: DI Pill ── */
          <div className="flex items-center gap-1 px-3 py-2">
            <AuthSection
              user={user}
              isLoaded={isLoaded}
              greeting={greeting}
              countryName={countryName}
              router={router}
            />

            <button
              onClick={openSearch}
              className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-full p-1 transition-colors"
              title="Search (⌘K)"
            >
              <Search className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={onOpenWelcome}
              className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-full p-1 transition-colors"
              title="Help & Tour"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>

            {user && totalUnread > 0 && (
              <button
                onClick={() =>
                  router.push(messageUnreadCount > 0 ? "/messages" : "/mycountry/intelligence")
                }
                className={cn(
                  "relative shrink-0 rounded-full p-1 transition-all duration-300",
                  isFlashing ? "scale-110 bg-red-500/20" : "text-muted-foreground"
                )}
              >
                {messageUnreadCount > 0 ? (
                  <MessageCircle className="h-3.5 w-3.5 text-blue-500" />
                ) : (
                  <Bell className="h-3.5 w-3.5" />
                )}
                <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              </button>
            )}

            <MapLayersPopover
              visibleLayers={visibleLayers}
              onToggleLayer={onToggleLayer}
              overlayVisibility={overlayVisibility}
              onToggleOverlay={onToggleOverlay}
            />

            <MapSettingsPopover
              projectionMode={projectionMode}
              onProjectionChange={onProjectionChange}
              theme={theme}
              effectiveTheme={effectiveTheme}
              setTheme={setTheme}
              router={router}
            />
          </div>
        )}
      </div>
    </div>
  );

  const desktopPill = (
    <div className="relative">
      {/* Outer glow — multi-layer halos for depth */}
      <motion.div
        layout
        transition={SPRING}
        className={cn(
          "absolute inset-0 rounded-full transition-opacity duration-500",
          isFlashing ? "opacity-100" : "opacity-60"
        )}
        style={{ willChange: "width, height" }}
      >
        <div
          className={cn(
            "absolute inset-0 rounded-full blur-xl transition-colors duration-500",
            isFlashing
              ? "bg-red-500/50"
              : "bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-blue-500/30"
          )}
        />
        <div
          className={cn(
            "absolute inset-0 rounded-full blur-lg transition-colors duration-500",
            isFlashing
              ? "bg-orange-400/40"
              : "bg-gradient-to-r from-cyan-400/20 via-indigo-500/20 to-purple-400/20"
          )}
        />
      </motion.div>

      {/* Main glass pill */}
      <motion.div
        layout
        transition={SPRING}
        animate={isFlashing ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        className={cn(
          "relative overflow-hidden rounded-full border shadow-2xl shadow-black/40 transition-colors duration-500",
          isFlashing ? "border-red-500/50" : "border-white/20 dark:border-white/10"
        )}
        style={{
          willChange: "width, height",
          background: isFlashing
            ? "linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.1) 100%)"
            : "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }}
      >
        {/* Inner refraction edges */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-transparent via-white/30 to-transparent" />
          <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />
          {/* Inner shimmer */}
          <div
            className={cn(
              "absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent will-change-transform",
              isFlashing && "bg-red-500/10"
            )}
            style={{ animationDuration: "3s", animationTimingFunction: "ease-in-out" }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10">
          <AnimatePresence mode="popLayout" initial={false}>
            {searchOpen ? (
              /* ── Expanded: Search Input ── */
              <motion.div
                key="search"
                layout
                initial={{ opacity: 0, filter: "blur(4px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(4px)" }}
                transition={{ ...SPRING_SOFT, opacity: { duration: 0.2 } }}
                className="flex items-center gap-2 px-4 py-2"
              >
                <Search className="text-muted-foreground h-4 w-4 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="search"
                  enterKeyHint="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIdx(-1);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search countries, cities, places…"
                  className="text-foreground placeholder:text-muted-foreground w-64 bg-transparent text-sm outline-none sm:w-80"
                />
                {searchLoading && debouncedQueryLength >= 2 && (
                  <Loader2 className="text-muted-foreground h-3.5 w-3.5 shrink-0 animate-spin" />
                )}
                <button
                  onClick={closeSearch}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-full p-1 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ) : (
              /* ── Compact: DI Pill ── */
              <motion.div
                key="compact"
                layout
                initial={{ opacity: 0, filter: "blur(4px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(4px)" }}
                transition={{ ...SPRING_SOFT, opacity: { duration: 0.2 } }}
                className="flex items-center gap-1 px-3 py-2"
              >
                {/* Auth greeting / sign-in */}
                <AuthSection
                  user={user}
                  isLoaded={isLoaded}
                  greeting={greeting}
                  countryName={countryName}
                  router={router}
                />

                {/* Search button */}
                <button
                  onClick={openSearch}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-full p-1 transition-colors"
                  title="Search (⌘K)"
                >
                  <Search className="h-3.5 w-3.5" />
                </button>

                {/* Help & Tour button */}
                <button
                  onClick={onOpenWelcome}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-full p-1 transition-colors"
                  title="Help & Tour"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>

                {/* Unified Notification/Messages Badge */}
                {user && totalUnread > 0 && (
                  <button
                    onClick={() =>
                      router.push(messageUnreadCount > 0 ? "/messages" : "/mycountry/intelligence")
                    }
                    className={cn(
                      "relative shrink-0 rounded-full p-1 transition-all duration-300",
                      isFlashing
                        ? "scale-125 bg-red-500/20"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                    title={
                      messageUnreadCount > 0
                        ? `${messageUnreadCount} unread messages`
                        : `${unreadNotifications} notifications`
                    }
                  >
                    {messageUnreadCount > 0 ? (
                      <MessageCircle
                        className={cn(
                          "h-3.5 w-3.5 transition-colors",
                          isFlashing ? "text-red-500" : "text-blue-500"
                        )}
                      />
                    ) : (
                      <Bell
                        className={cn(
                          "h-3.5 w-3.5 transition-colors",
                          isFlashing ? "text-red-500" : ""
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "ring-background absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[8px] font-bold text-white shadow-sm ring-2 transition-colors duration-500",
                        messageUnreadCount > 0
                          ? isFlashing
                            ? "animate-bounce bg-red-600"
                            : "bg-red-500"
                          : "bg-gradient-to-r from-blue-500 to-indigo-500"
                      )}
                    >
                      {totalUnread > 99 ? "99+" : totalUnread}
                    </span>
                  </button>
                )}

                {/* Layers */}
                <MapLayersPopover
                  visibleLayers={visibleLayers}
                  onToggleLayer={onToggleLayer}
                  overlayVisibility={overlayVisibility}
                  onToggleOverlay={onToggleOverlay}
                />

                {/* Settings */}
                <MapSettingsPopover
                  projectionMode={projectionMode}
                  onProjectionChange={onProjectionChange}
                  theme={theme}
                  effectiveTheme={effectiveTheme}
                  setTheme={setTheme}
                  router={router}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="absolute top-3 left-1/2 z-[var(--z-floating)] -translate-x-1/2"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {isMobile ? mobilePill : desktopPill}

      {/* ── Search Results Dropdown ── */}
      {isMobile ? (
        showResults && (
          <div className="bg-card mt-2 max-h-80 w-[calc(100vw-24px)] overflow-y-auto rounded-2xl border border-white/10 py-1 shadow-2xl">
            {searchLoading && !hasResults && (
              <div className="text-muted-foreground flex items-center justify-center gap-2 px-4 py-6 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </div>
            )}

            {!searchLoading && !hasResults && flatResults.length === 0 && (
              <div className="text-muted-foreground px-4 py-6 text-center text-sm">
                No results for &ldquo;{query.trim()}&rdquo;
              </div>
            )}

            {grouped.map(([type, items]) => {
              const meta = TYPE_META[type] ?? { icon: Globe, label: type };
              const Icon = meta.icon;
              return (
                <div key={type}>
                  <div className="text-muted-foreground flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </div>
                  {items.map((result) => {
                    const flatIdx = flatResults.indexOf(result);
                    const isHighlighted = flatIdx === selectedIdx;
                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleSelect(result)}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                          isHighlighted
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground/80 hover:bg-accent/50 hover:text-foreground"
                        )}
                      >
                        {result.type === "country" ? (
                          <FlagIcon name={result.name} />
                        ) : (
                          <Icon
                            className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              isHighlighted ? "text-blue-500" : "text-muted-foreground"
                            )}
                          />
                        )}
                        <span className="truncate font-medium">{result.name}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )
      ) : (
        <AnimatePresence>
          {showResults && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={SPRING_SOFT}
              className="bg-card ring-border mt-2 max-h-80 overflow-y-auto rounded-2xl py-1 shadow-2xl ring-1"
            >
              {searchLoading && !hasResults && (
                <div className="text-muted-foreground flex items-center justify-center gap-2 px-4 py-6 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </div>
              )}

              {!searchLoading && !hasResults && flatResults.length === 0 && (
                <div className="text-muted-foreground px-4 py-6 text-center text-sm">
                  No results for &ldquo;{query.trim()}&rdquo;
                </div>
              )}

              {grouped.map(([type, items]) => {
                const meta = TYPE_META[type] ?? { icon: Globe, label: type };
                const Icon = meta.icon;
                return (
                  <div key={type}>
                    <div className="text-muted-foreground flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </div>
                    {items.map((result) => {
                      const flatIdx = flatResults.indexOf(result);
                      const isHighlighted = flatIdx === selectedIdx;
                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleSelect(result)}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                            isHighlighted
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground/80 hover:bg-accent/50 hover:text-foreground"
                          )}
                        >
                          {result.type === "country" ? (
                            <FlagIcon name={result.name} />
                          ) : (
                            <Icon
                              className={cn(
                                "h-3.5 w-3.5 shrink-0",
                                isHighlighted ? "text-blue-500" : "text-muted-foreground"
                              )}
                            />
                          )}
                          <span className="truncate font-medium">{result.name}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

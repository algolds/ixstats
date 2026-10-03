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
 * The island is Halo's acrylic (`FacetMaterial material="acrylic"`), opening into the
 * 40px / 210% expanded sheet (`data-expanded`) while searching — and the results list a
 * `material-regular` panel.
 * Desktop springs its size (layout animation); phones swap content without it.
 */

import { AnimatePresence, motion } from "motion/react";
import {
  Search,
  Xmark as X,
  Globe,
  SystemRestart as Loader2,
  ChatBubble as MessageCircle,
  Bell,
  HelpCircle,
} from "iconoir-react";
import type { ProjectionMode } from "~/lib/maps/map-config";
import { cn } from "~/lib/utils";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import { useIsMobile } from "~/hooks/useIsMobile";

// Extracted state hook, components, and helper utilities
import { useDynamicIslandState } from "./hooks/useDynamicIslandState";
import { AuthSection } from "./components/AuthSection";
import { MapSettingsPopover } from "./components/MapSettingsPopover";
import { TYPE_META, SPRING, SPRING_SOFT, FlagIcon } from "./utils/dynamic-island-helpers";

/** The island as a motion component so its size change springs (layout animation). */
const MotionFacetMaterial = motion.create(FacetMaterial);

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
  /** Realm slug the map shows; search stays inside it */
  realm?: string;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function MapDynamicIsland({
  projectionMode,
  onProjectionChange,
  onSearchResult,
  onOpenWelcome,
  realm,
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
  } = useDynamicIslandState({ onSearchResult, realm });

  const debouncedQueryLength = query.trim().length;

  // Island controls: plain icon buttons on the material (no nested surfaces).
  // The focus ring sits just inside the button: the acrylic pill clips (`overflow-hidden`,
  // 4px of padding), so the shared 2px-offset ring would be cut at the pill's edge.
  const iconButton =
    "text-label-secondary hover:text-label rounded-full focus-visible:-outline-offset-2";

  const unreadButton = user && totalUnread > 0 && (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => router.push(messageUnreadCount > 0 ? "/messages" : "/mycountry/intelligence")}
      aria-label={
        messageUnreadCount > 0
          ? `${messageUnreadCount} unread messages`
          : `${unreadNotifications} notifications`
      }
      title={
        messageUnreadCount > 0
          ? `${messageUnreadCount} unread messages`
          : `${unreadNotifications} notifications`
      }
      className={cn(iconButton, isFlashing && "bg-red/20 text-red")}
    >
      {messageUnreadCount > 0 ? (
        <MessageCircle className={cn("size-3.5", isFlashing ? "text-red" : "text-blue")} />
      ) : (
        <Bell className="size-3.5" />
      )}
      <span
        aria-hidden
        className={cn(
          "ring-surface text-caption absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-semibold tabular-nums ring-2",
          messageUnreadCount > 0 ? "bg-red text-on-red" : "bg-blue text-on-blue"
        )}
      >
        {totalUnread > 99 ? "99+" : totalUnread}
      </span>
    </Button>
  );

  const searchInput = (className: string) => (
    <>
      <Search className="text-label-secondary size-4 shrink-0" aria-hidden />
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
        aria-label="Search the map"
        role="combobox"
        aria-expanded={showResults}
        aria-controls="map-search-results"
        aria-autocomplete="list"
        aria-activedescendant={selectedIdx >= 0 ? `map-search-opt-${selectedIdx}` : undefined}
        className={cn(
          "text-label placeholder:text-label-tertiary text-body bg-transparent outline-none",
          className
        )}
      />
      {searchLoading && debouncedQueryLength >= 2 && (
        <Loader2 className="text-label-secondary size-3.5 shrink-0 animate-spin" aria-hidden />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Close search"
        onClick={closeSearch}
        className={iconButton}
      >
        <X aria-hidden className="size-3.5" />
      </Button>
    </>
  );

  const compactControls = (
    <>
      <AuthSection
        user={user}
        isLoaded={isLoaded}
        greeting={greeting}
        countryName={countryName}
        router={router}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={openSearch}
        title="Search (⌘K)"
        aria-label="Search the map"
        className={iconButton}
      >
        <Search aria-hidden className="size-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onOpenWelcome}
        title="Help and tour"
        aria-label="Help and tour"
        className={iconButton}
      >
        <HelpCircle aria-hidden className="size-3.5" />
      </Button>

      {unreadButton}

      <MapSettingsPopover
        projectionMode={projectionMode}
        onProjectionChange={onProjectionChange}
        theme={theme}
        effectiveTheme={effectiveTheme}
        setTheme={setTheme}
        router={router}
      />
    </>
  );

  /** The island is Halo's acrylic over the map; `data-expanded` while searching. */
  const islandClass = cn(
    "overflow-hidden rounded-full transition-[outline-color,background-color,border-color,box-shadow,backdrop-filter] duration-300",
    "outline-2 outline-transparent outline-solid",
    isFlashing && "outline-red/70"
  );

  const mobilePill = (
    <FacetMaterial
      material="acrylic"
      data-expanded={searchOpen ? "true" : undefined}
      className={islandClass}
    >
      {searchOpen ? (
        <div className="flex items-center gap-2 py-1 pr-1 pl-4">
          {searchInput("w-[calc(100vw-120px)]")}
        </div>
      ) : (
        <div className="flex items-center gap-1 px-2 py-1">{compactControls}</div>
      )}
    </FacetMaterial>
  );

  const desktopPill = (
    <MotionFacetMaterial
      material="acrylic"
      layout
      transition={SPRING}
      animate={isFlashing ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      data-expanded={searchOpen ? "true" : undefined}
      className={islandClass}
      style={{ willChange: "width, height" }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {searchOpen ? (
          /* ── Expanded: Search Input ── */
          <motion.div
            key="search"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ ...SPRING_SOFT, opacity: { duration: 0.15 } }}
            className="flex items-center gap-2 py-1 pr-1 pl-4"
          >
            {searchInput("w-64 sm:w-80")}
          </motion.div>
        ) : (
          /* ── Compact: island controls ── */
          <motion.div
            key="compact"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ ...SPRING_SOFT, opacity: { duration: 0.15 } }}
            className="flex items-center gap-1 px-2 py-1"
          >
            {compactControls}
          </motion.div>
        )}
      </AnimatePresence>
    </MotionFacetMaterial>
  );

  const resultsBody = (
    <>
      {searchLoading && !hasResults && (
        <div className="text-label-secondary text-body flex items-center justify-center gap-2 px-4 py-6">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching…
        </div>
      )}

      {!searchLoading && !hasResults && flatResults.length === 0 && (
        <div className="text-label-secondary text-body px-4 py-6 text-center">
          No results for &ldquo;{query.trim()}&rdquo;
        </div>
      )}

      {grouped.map(([type, items]) => {
        const meta = TYPE_META[type] ?? { icon: Globe, label: type };
        const Icon = meta.icon;
        return (
          <div key={type}>
            <Eyebrow className="flex items-center gap-2 px-3 py-2">
              <Icon className="h-3 w-3" aria-hidden />
              {meta.label}
            </Eyebrow>
            {items.map((result) => {
              const flatIdx = flatResults.indexOf(result);
              const isHighlighted = flatIdx === selectedIdx;
              return (
                <button
                  type="button"
                  id={`map-search-opt-${flatIdx}`}
                  role="option"
                  aria-selected={isHighlighted}
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className={cn(
                    "text-body flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left transition-colors sm:min-h-0",
                    isHighlighted
                      ? "bg-fill-3 text-label"
                      : "text-label-secondary hover:bg-fill-4 hover:text-label"
                  )}
                >
                  {result.type === "country" ? (
                    <FlagIcon name={result.name} />
                  ) : (
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isHighlighted ? "text-tint" : "text-label-secondary"
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
    </>
  );

  return (
    <div
      ref={containerRef}
      className="z-sticky absolute top-3 left-1/2 -translate-x-1/2"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {isMobile ? mobilePill : desktopPill}

      {/* ── Search Results Dropdown ── */}
      {isMobile ? (
        showResults && (
          <FacetMaterial
            material="regular"
            id="map-search-results"
            role="listbox"
            aria-label="Search results"
            className="rounded-card mt-2 max-h-[min(20rem,60dvh)] w-[calc(100vw-24px)] overflow-y-auto overscroll-contain py-1"
          >
            {resultsBody}
          </FacetMaterial>
        )
      ) : (
        <AnimatePresence>
          {showResults && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={SPRING_SOFT}
              className="mt-2"
            >
              <FacetMaterial
                material="regular"
                id="map-search-results"
                role="listbox"
                aria-label="Search results"
                className="rounded-card max-h-80 overflow-y-auto overscroll-contain py-1"
              >
                {resultsBody}
              </FacetMaterial>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

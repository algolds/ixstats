"use client";

/**
 * MapDynamicIsland — Self-contained Dynamic Island for the maps page.
 *
 * Replaces BOTH the navbar DI and MapSearchOverlay with a single unified control.
 * Features:
 * - IX logo → home/maps
 * - IxTime display
 * - Auth greeting / sign-in prompt
 * - Search icon → liquid expansion to geo search (countries, cities, POIs)
 * - Settings popover → theme + projection only
 * - Click-outside → smooth retraction
 *
 * All with polished Apple-style liquid glass animations.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Search, X, Settings, Globe, MapPin, Hexagon, Landmark,
  Loader2, Sun, Moon, Monitor, User, LogIn, Crown, Map as MapIcon,
  Clock, Calendar, Bell, MessageCircle, Link2,
} from "lucide-react";
import { useUser, SignInButton } from "~/context/auth-context";
import { useTheme } from "~/context/theme-context";
import { useIxTime } from "~/contexts/IxTimeContext";
import { useMessageUnreadCount } from "~/hooks/useMessageUnreadCount";
import { useNotificationStore } from "~/stores/notificationStore";
import { useDebounce } from "~/hooks/useDebounce";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { getNationUrl } from "~/lib/slug-utils";
import { flagService } from "~/lib/flag-service";
import { isStandaloneClient } from "~/lib/standalone-detection";
import { useRouter } from "next/navigation";
import type { ProjectionMode } from "~/lib/map-config";

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
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getGreeting = (ixTime: number): string => {
  const date = new Date(ixTime);
  const hour = date.getUTCHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};

const getTimeDisplay = (ixTime: number): string => {
  const date = new Date(ixTime);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${ampm}`;
};

const TYPE_META: Record<string, { icon: typeof Globe; label: string }> = {
  country: { icon: Globe, label: "Countries" },
  city: { icon: MapPin, label: "Cities" },
  subdivision: { icon: Hexagon, label: "Regions" },
  poi: { icon: Landmark, label: "Points of Interest" },
};

/** Tiny inline flag that resolves async via the unified flag service. */
function FlagIcon({ name }: { name: string }) {
  const [url, setUrl] = useState<string | null>(() => flagService.getCachedFlagUrl(name));
  useEffect(() => {
    if (url) return;
    let mounted = true;
    flagService.getFlagUrl(name).then((u) => { if (mounted) setUrl(u); });
    return () => { mounted = false; };
  }, [name, url]);
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      className="h-3.5 w-5 flex-shrink-0 rounded-[2px] border border-white/10 object-cover"
    />
  );
}

// ---------------------------------------------------------------------------
// Spring configs for liquid glass feel
// ---------------------------------------------------------------------------

const SPRING = { type: "spring" as const, stiffness: 400, damping: 30, mass: 0.8 };
const SPRING_SOFT = { type: "spring" as const, stiffness: 300, damping: 28, mass: 1 };

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function MapDynamicIsland({
  projectionMode,
  onProjectionChange,
  onSearchResult,
}: MapDynamicIslandProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [timeDisplayMode, setTimeDisplayMode] = useState<"time" | "date" | "both">("time");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { user, isLoaded } = useUser();
  const { ixTimeTimestamp } = useIxTime();
  const { theme, effectiveTheme, setTheme } = useTheme();
  const router = useRouter();

  const greeting = useMemo(() => getGreeting(ixTimeTimestamp), [ixTimeTimestamp]);
  const timeDisplay = useMemo(() => getTimeDisplay(ixTimeTimestamp), [ixTimeTimestamp]);

  // Profile data for greeting
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user?.id,
  });
  const countryName = userProfile?.country?.name;

  // Notification stats
  const { stats: notificationStats } = useNotificationStore();
  const unreadNotifications = notificationStats.unread || 0;

  // Messages unread count
  const { totalUnread: messageUnreadCount } = useMessageUnreadCount();

  // Unified unread count for the main pill (optional, currently using separate badges)
  const totalUnread = unreadNotifications + messageUnreadCount;

  // ---------------------------------------------------------------------------
  // Geo Search
  // ---------------------------------------------------------------------------

  const debouncedQuery = useDebounce(query.trim(), 250);

  const { data: results, isLoading: searchLoading } = api.geo.searchFeatures.useQuery(
    { query: debouncedQuery, limit: 20 },
    { enabled: debouncedQuery.length >= 2, staleTime: 30_000 }
  );

  const grouped = useMemo(() => {
    if (!results || results.length === 0) return [];
    const groups: Record<string, MapSearchResult[]> = {};
    for (const r of results) {
      (groups[r.type] ??= []).push(r);
    }
    return Object.entries(groups);
  }, [results]);

  const flatResults = results ?? [];
  const showResults = searchOpen && debouncedQuery.length >= 2;
  const hasResults = grouped.length > 0;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    // Wait for input to mount
    requestAnimationFrame(() => {
      requestAnimationFrame(() => inputRef.current?.focus());
    });
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
    setSelectedIdx(-1);
  }, []);

  const handleSelect = useCallback(
    (result: MapSearchResult) => {
      onSearchResult(result);
      closeSearch();
    },
    [onSearchResult, closeSearch]
  );

  // Click outside → close
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [searchOpen, closeSearch]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSearch();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, flatResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && selectedIdx >= 0 && flatResults[selectedIdx]) {
        e.preventDefault();
        handleSelect(flatResults[selectedIdx]);
      }
    },
    [flatResults, selectedIdx, handleSelect, closeSearch]
  );

  // Cmd+K shortcut to toggle search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (searchOpen) closeSearch();
        else openSearch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen, openSearch, closeSearch]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      ref={containerRef}
      className="absolute left-1/2 top-3 z-[var(--z-floating)] -translate-x-1/2"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* ── DI Pill ── */}
      <div className="relative">
        {/* Outer glow — multi-layer halos for depth */}
        <motion.div
          layout
          transition={SPRING}
          className="absolute inset-0 rounded-full opacity-60"
          style={{ willChange: "width, height" }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-blue-500/30 blur-xl" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400/20 via-indigo-500/20 to-purple-400/20 blur-lg" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-300/15 via-purple-300/15 to-blue-300/15 blur-md" />
        </motion.div>

        {/* Main glass pill */}
        <motion.div
          layout
          transition={SPRING}
          className="relative overflow-hidden rounded-full border border-white/20 shadow-2xl shadow-black/40 dark:border-white/10"
          style={{
            willChange: "width, height",
            background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
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
              className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent will-change-transform"
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
              <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
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
                className="w-64 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground sm:w-80"
              />
              {searchLoading && debouncedQuery.length >= 2 && (
                <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-muted-foreground" />
              )}
              <button
                onClick={closeSearch}
                className="flex-shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
              {/* IX Logo */}
              <button
                onClick={() => router.push("/maps")}
                className="group relative flex h-7 w-7 items-center justify-center rounded-xl transition-all duration-300 hover:scale-110 active:scale-95"
              >
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 via-purple-500/30 to-blue-500/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-400/10 via-indigo-500/20 to-purple-400/10 opacity-0 blur-sm transition-opacity duration-500 group-hover:opacity-100" />
                <img
                  src={withBasePath("/images/ix-logo.svg")}
                  alt="IxLogo"
                  className="relative z-10 h-5 w-5 opacity-80 brightness-100 filter transition-all duration-300 group-hover:scale-110 group-hover:opacity-100 group-hover:drop-shadow-lg dark:brightness-0 dark:invert"
                />
              </button>

              {/* Time / Date Toggle */}
              <button
                onClick={() => {
                  setTimeDisplayMode((curr) =>
                    curr === "time" ? "date" : curr === "date" ? "both" : "time"
                  );
                }}
                className="flex items-center gap-1 rounded-md px-2 py-1 cursor-pointer transition-colors hover:bg-accent/50"
              >
                {timeDisplayMode === "time" && (
                  <>
                    <Clock className="h-3 w-3 text-blue-500 opacity-70" />
                    <span className="text-[11px] font-semibold tabular-nums text-foreground/80">
                      {timeDisplay}
                    </span>
                  </>
                )}
                {timeDisplayMode === "date" && (
                  <>
                    <Calendar className="h-3 w-3 text-blue-500 opacity-70" />
                    <span className="text-[11px] font-semibold tabular-nums text-foreground/80">
                      {new Date(ixTimeTimestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </>
                )}
                {timeDisplayMode === "both" && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-blue-500 opacity-70" />
                    <span className="text-[11px] font-semibold tabular-nums text-foreground/80">
                      {timeDisplay}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50">·</span>
                    <span className="text-[10px] font-semibold tabular-nums text-foreground/70">
                      {new Date(ixTimeTimestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </button>

              {/* Separator */}
              <span className="mx-0.5 h-3 w-px flex-shrink-0 bg-border" />

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
                className="flex-shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Search (⌘K)"
              >
                <Search className="h-3.5 w-3.5" />
              </button>

              {/* Unified Notification/Messages Badge */}
              {user && totalUnread > 0 && (
                <button
                  onClick={() => router.push(messageUnreadCount > 0 ? "/messages" : "/notifications")}
                  className="relative flex-shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title={messageUnreadCount > 0 ? `${messageUnreadCount} unread messages` : `${unreadNotifications} notifications`}
                >
                  {messageUnreadCount > 0 ? (
                    <MessageCircle className="h-3.5 w-3.5 text-blue-500" />
                  ) : (
                    <Bell className="h-3.5 w-3.5" />
                  )}
                  <span className={`absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[8px] font-bold text-white shadow-sm ring-2 ring-background ${
                    messageUnreadCount > 0 ? "bg-red-500" : "bg-gradient-to-r from-blue-500 to-indigo-500"
                  }`}>
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                </button>
              )}

              {/* Settings */}
              <MapSettingsPopover
                projectionMode={projectionMode}
                onProjectionChange={onProjectionChange}
                theme={theme}
                effectiveTheme={effectiveTheme}
                setTheme={setTheme}
              />
            </motion.div>
          )}
        </AnimatePresence>
          </div>{/* /content z-10 */}
        </motion.div>{/* /glass pill */}
      </div>{/* /outer relative */}

      {/* ── Search Results Dropdown ── */}
      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={SPRING_SOFT}
            className="mt-2 max-h-80 overflow-y-auto rounded-2xl bg-card py-1 shadow-2xl ring-1 ring-border"
          >
            {searchLoading && !hasResults && (
              <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </div>
            )}

            {!searchLoading && !hasResults && results !== undefined && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No results for &ldquo;{debouncedQuery}&rdquo;
              </div>
            )}

            {grouped.map(([type, items]) => {
              const meta = TYPE_META[type] ?? { icon: Globe, label: type };
              const Icon = meta.icon;
              return (
                <div key={type}>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                          isHighlighted
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground/80 hover:bg-accent/50 hover:text-foreground"
                        }`}
                      >
                        {result.type === "country" ? (
                          <FlagIcon name={result.name} />
                        ) : (
                          <Icon
                            className={`h-3.5 w-3.5 flex-shrink-0 ${
                              isHighlighted ? "text-blue-500" : "text-muted-foreground"
                            }`}
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auth Section — inline in the DI pill
// ---------------------------------------------------------------------------

function AuthSection({
  user,
  isLoaded,
  greeting,
  countryName,
  router,
}: {
  user: any;
  isLoaded: boolean;
  greeting: string;
  countryName?: string;
  router: ReturnType<typeof useRouter>;
}) {
  if (!isLoaded) {
    return <span className="text-[11px] text-muted-foreground">…</span>;
  }

  if (!user) {
    return (
      <SignInButton mode="modal">
        <button className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <LogIn className="h-3 w-3" />
          <span className="hidden sm:inline">Sign in</span>
        </button>
      </SignInButton>
    );
  }

  return (
    <Popover>
      <PopoverTrigger
        render={<div />}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
      >
          {user.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              className="h-4 w-4 rounded-full object-cover ring-1 ring-white/20"
            />
          ) : (
            <User className="h-3 w-3" />
          )}
          <span className="hidden whitespace-nowrap sm:inline">
            {greeting}{user.firstName ? `, ${user.firstName}` : ""}
          </span>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        className="glass-none mt-2 w-64 rounded-2xl border border-border bg-popover p-0 shadow-2xl"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          {user.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              className="h-8 w-8 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground truncate">
              {user.firstName || user.emailAddresses?.[0]?.emailAddress || "User"}
            </div>
            {countryName && (
              <div className="text-[11px] text-muted-foreground truncate">{countryName}</div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="p-1.5 space-y-0.5">
          <button
            onClick={() => router.push("/profile")}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <User className="h-3.5 w-3.5" />
            User Settings
          </button>
        
          {countryName && (
            <button
              onClick={() => router.push(getNationUrl(countryName))}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Crown className="h-3.5 w-3.5" />
               MyCountry
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Settings Popover — theme + projection only
// ---------------------------------------------------------------------------

function MapSettingsPopover({
  projectionMode,
  onProjectionChange,
  theme,
  effectiveTheme,
  setTheme,
}: {
  projectionMode: ProjectionMode;
  onProjectionChange: (mode: ProjectionMode) => void;
  theme: string;
  effectiveTheme: string;
  setTheme: (t: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={<div />}
        className="flex-shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
        title="Settings"
      >
          <Settings className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="glass-none mt-2 w-56 rounded-2xl border border-border bg-popover p-3 shadow-2xl"
        sideOffset={8}
      >
        {/* Theme */}
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Theme
          </div>
          <div className="flex rounded-xl bg-accent/50 p-0.5">
            {(["light", "dark", "system"] as const).map((t) => {
              const Icon = t === "light" ? Sun : t === "dark" ? Moon : Monitor;
              return (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all ${
                    theme === t
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Projection */}
        <div className="mt-3 space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Projection
          </div>
          <div className="flex rounded-xl bg-accent/50 p-0.5">
            {(["globe", "mercator", "dynamic"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onProjectionChange(mode)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all ${
                  projectionMode === mode
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                {mode === "dynamic" ? "Auto" : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

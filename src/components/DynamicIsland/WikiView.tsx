// src/components/DynamicIsland/WikiView.tsx
// Wiki mode for the Dynamic Island — search, collapsible TOC, map, quick actions.

"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
// eslint-disable-next-line unused-imports/no-unused-imports
import dynamic from "next/dynamic";
import {
  Search,
  X,
  FileEdit,
  History,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Link2,
  Clock,
  ExternalLink,
  Bell,
  Settings,
  Bookmark,
  Loader2,
  Play,
  Pause,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { useAuth } from "@clerk/nextjs";
import { api } from "~/trpc/react";
// eslint-disable-next-line unused-imports/no-unused-imports
import { withBasePath, navigateWithBasePath } from "~/lib/base-path";
import { formatMWTimeAgo } from "~/lib/wiki-os/mediawiki-timestamp";
import { PreText } from "~/components/ui/pretext";
import { cn } from "~/lib/utils";
import type { DIViewProps } from "./types";

interface WikiViewProps extends DIViewProps {}

interface LocalDraft {
  title: string;
  type: "source" | "visual";
}

interface PausedSession {
  title: string;
  scrollPercent: number;
  updatedAt: number;
}

export function WikiView({ onClose, onSwitchMode }: WikiViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const {
    articleTitle,
    tocEntries,
    themeColors,
    activeSectionId,
    navigateToSection,
    narratorState,
    narratorActions,
  } = useWikiContext() as any;
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(true);
  const [sessionsOpen, setSessionsOpen] = useState(true);
  const [localDrafts, setLocalDrafts] = useState<LocalDraft[]>([]);
  const [pausedSessions, setPausedSessions] = useState<PausedSession[]>([]);

  // Scan drafts and reading sessions
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Scan local drafts
    const drafts: LocalDraft[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          if (key.startsWith("wikios-draft-html-")) {
            const title = key.substring("wikios-draft-html-".length);
            drafts.push({ title, type: "visual" });
          } else if (key.startsWith("wikios-draft-")) {
            const title = key.substring("wikios-draft-".length);
            if (!drafts.some((d) => d.title === title)) {
              drafts.push({ title, type: "source" });
            }
          }
        }
      }
      setLocalDrafts(drafts);
    } catch (e) {
      console.error("Failed to read drafts:", e);
    }

    // 2. Scan paused sessions
    try {
      const stored = localStorage.getItem("wikios:pausedSessions");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setPausedSessions(parsed);
        }
      } else {
        setPausedSessions([]);
      }
    } catch (e) {
      console.error("Failed to read paused sessions:", e);
    }
  }, [articleTitle, pathname]);

  const isMainPage =
    pathname?.includes("/wiki/Main_Page") || pathname?.includes("/wiki/Main%20Page") || false;

  useEffect(() => {
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const { data: searchData, isFetching: isSearching } = api.wikios.advancedSearch.useQuery(
    { query: searchQuery, limit: 8 },
    { enabled: searchQuery.length >= 2, staleTime: 30_000 }
  );
  const searchResults = searchData?.results ?? [];

  // Recent changes for the feed
  const { data: recentChanges } = api.wikios.getRecentChanges.useQuery(
    { limit: 5 },
    { staleTime: 60_000 }
  );

  const visibleToc = useMemo(() => tocEntries.filter((e) => e.level <= 3), [tocEntries]);

  const handleNavigateToArticle = useCallback(
    (title: string) => {
      onClose();
      navigateWithBasePath(`/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`, router);
    },
    [router, onClose]
  );

  const handleSectionClick = useCallback(
    (id: string) => {
      navigateToSection(id);
      onClose();
    },
    [navigateToSection, onClose]
  );

  const slug = articleTitle ? encodeURIComponent(articleTitle.replace(/ /g, "_")) : null;
  const { isSignedIn } = useAuth();

  const utils = api.useUtils();

  // Stash status query
  const { data: stashData } = api.wikios.isStashed.useQuery(
    { pageTitle: articleTitle ?? "" },
    { enabled: !!articleTitle && isSignedIn, retry: false }
  );
  const isStashed = stashData?.stashed ?? false;
  const stashedIn = useMemo(() => stashData?.stashes ?? [], [stashData]);

  // Mutations
  const stashMutation = api.wikios.stashPage.useMutation({
    onSuccess: () => {
      void utils.wikios.isStashed.invalidate({ pageTitle: articleTitle ?? "" });
      void utils.wikios.getStashes.invalidate();
    },
  });

  const unstashMutation = api.wikios.unstashPage.useMutation({
    onSuccess: () => {
      void utils.wikios.isStashed.invalidate({ pageTitle: articleTitle ?? "" });
      void utils.wikios.getStashes.invalidate();
    },
  });

  const handleToggleStash = useCallback(() => {
    if (!articleTitle || !isSignedIn) return;
    if (isStashed) {
      const firstStash = stashedIn[0];
      if (firstStash) {
        unstashMutation.mutate({ pageTitle: articleTitle, stashId: firstStash.id });
      } else {
        unstashMutation.mutate({ pageTitle: articleTitle });
      }
    } else {
      stashMutation.mutate({ pageTitle: articleTitle });
    }
  }, [articleTitle, isSignedIn, isStashed, stashedIn, stashMutation, unstashMutation]);

  const stashLoading = stashMutation.isPending || unstashMutation.isPending;

  // Scroll tracking
  const [scrollPercent, setScrollPercent] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      setScrollPercent(pct);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Section offsets calculation
  const [sectionOffsets, setSectionOffsets] = useState<Record<string, number>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;

    const calculateOffsets = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;

      const offsets: Record<string, number> = {};
      for (const entry of visibleToc) {
        const el = document.getElementById(entry.id);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY;
          const pct = (top / scrollHeight) * 100;
          offsets[entry.id] = Math.min(100, Math.max(0, pct));
        }
      }
      setSectionOffsets(offsets);
    };

    calculateOffsets();
    window.addEventListener("resize", calculateOffsets);

    return () => window.removeEventListener("resize", calculateOffsets);
  }, [visibleToc, articleTitle]);

  // Word count & reading time
  const [readingTime, setReadingTime] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined" || !articleTitle) {
      setReadingTime(0);
      return;
    }
    const contentEl = document.querySelector(".wikios-article-content");
    if (contentEl) {
      const text = contentEl.textContent || "";
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      setReadingTime(Math.max(1, Math.round(words / 200)));
    }
  }, [articleTitle]);

  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const activeEntry = visibleToc.find((e) => e.id === activeSectionId);
  const activeSectionTitle = activeEntry?.text ?? "";

  const isNarratorActive = !!(
    narratorState &&
    narratorState.totalBlocks > 0 &&
    (narratorState.isPlaying || narratorState.activeBlockIndex > 0)
  );

  const displayPercent = isNarratorActive
    ? (narratorState.activeBlockIndex / narratorState.totalBlocks) * 100
    : scrollPercent;

  // Drag / Click handlers for scrubbing
  const handleScrub = useCallback((pct: number) => {
    if (isNarratorActive && narratorActions) {
      const targetIdx = Math.min(
        narratorState.totalBlocks - 1,
        Math.max(0, Math.round((pct / 100) * (narratorState.totalBlocks - 1)))
      );
      narratorActions.jumpToBlock(targetIdx);
    } else {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        window.scrollTo({
          top: (pct / 100) * scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, [isNarratorActive, narratorActions, narratorState?.totalBlocks]);

  const updateScrollFromPointer = (e: React.PointerEvent, _smooth = false) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = (clickX / rect.width) * 100;
    const clampedPct = Math.min(100, Math.max(0, pct));

    if (isNarratorActive && narratorActions) {
      const targetIdx = Math.min(
        narratorState.totalBlocks - 1,
        Math.max(0, Math.round((clampedPct / 100) * (narratorState.totalBlocks - 1)))
      );
      narratorActions.jumpToBlock(targetIdx);
    } else {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        window.scrollTo({
          top: (clampedPct / 100) * scrollHeight,
          behavior: "auto",
        });
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateScrollFromPointer(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateScrollFromPointer(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-foreground flex min-w-0 items-center gap-2 text-lg font-bold">
          <PreText className="text-inherit" whiteSpace="nowrap">
            Wiki
          </PreText>
          {articleTitle && (
            <div className="flex min-w-0 items-center gap-1.5">
              <PreText
                className="text-muted-foreground ml-1 max-w-[120px] truncate text-sm font-normal sm:max-w-[160px]"
                whiteSpace="nowrap"
              >
                {`— ${articleTitle}`}
              </PreText>
              {readingTime > 0 && (
                <span className="shrink-0 rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-400">
                  {readingTime} min read
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {articleTitle && isSignedIn && (
            <button
              onClick={handleToggleStash}
              disabled={stashLoading}
              className={cn(
                "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-all active:scale-90",
                isStashed
                  ? "border border-amber-500/20 bg-amber-500/10 text-amber-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
              )}
              title={isStashed ? "Unstash Article" : "Save to Stash"}
              type="button"
            >
              {stashLoading ? (
                <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
              ) : (
                <Bookmark className={cn("h-4 w-4", isStashed && "fill-current")} />
              )}
            </button>
          )}

          {onSwitchMode && (
            <>
              <button
                onClick={() => onSwitchMode("search")}
                className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
                title="Global Search"
                type="button"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                onClick={() => onSwitchMode("notifications")}
                className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
                title="Notifications"
                type="button"
              >
                <Bell className="h-4 w-4" />
              </button>
              <button
                onClick={() => onSwitchMode("settings")}
                className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
                title="Settings"
                type="button"
              >
                <Settings className="h-4 w-4" />
              </button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-accent/10 px-2 py-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progressive Scrubbing Track */}
      {articleTitle && visibleToc.length > 0 && (
        <div className="mb-4 px-1">
          <div className="text-muted-foreground mb-1.5 flex items-center justify-between text-[10px] font-semibold select-none">
            <span className="max-w-[200px] truncate">
              {isNarratorActive
                ? `Narrating: ${narratorState.activeSectionTitle || "Overview"}`
                : activeSectionTitle
                  ? `Reading: ${activeSectionTitle}`
                  : "Overview"}
            </span>
            <span className="tabular-nums">{Math.round(displayPercent)}%</span>
          </div>

          <div
            ref={trackRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="group relative flex h-3 w-full cursor-pointer touch-none items-center select-none"
            style={{ touchAction: "none" }}
          >
            {/* Background Track Line */}
            <div className="absolute left-0 h-1 w-full rounded-full bg-white/10" />

            {/* Active Progress Fill Line */}
            <div
              className="absolute left-0 h-1 rounded-full bg-blue-500"
              style={{
                width: `${displayPercent}%`,
                backgroundColor: themeColors?.primary ?? undefined,
              }}
            />

            {/* Section Ticks (Dots) */}
            {visibleToc.map((entry) => {
              const offset = sectionOffsets[entry.id] ?? 0;
              const isActive = activeSectionId === entry.id;
              return (
                <div
                  key={entry.id}
                  className="group/tick absolute top-1/2 z-20 flex h-3 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                  style={{ left: `${offset}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isNarratorActive && narratorActions) {
                      narratorActions.jumpToSection(entry.id);
                    } else {
                      handleScrub(offset);
                    }
                  }}
                >
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full border transition-all duration-200",
                      isActive && !themeColors
                        ? "scale-125 border-blue-400 bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]"
                        : isActive
                          ? "scale-125"
                          : "border-white/20 bg-zinc-950 group-hover/tick:scale-110 group-hover/tick:border-white"
                    )}
                    style={
                      isActive && themeColors
                        ? {
                            borderColor: themeColors.secondary,
                            backgroundColor: themeColors.primary,
                            boxShadow: `0 0 8px ${themeColors.primary}`,
                          }
                        : undefined
                    }
                  />
                  {/* Tooltip */}
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 rounded border border-white/10 bg-zinc-950/95 px-2 py-1 text-[9px] font-bold whitespace-nowrap text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover/tick:opacity-100">
                    {entry.text}
                  </span>
                </div>
              );
            })}

            {/* Glowing Scrubber Playhead Handle */}
            <div
              className="absolute z-30 h-3 w-3 -translate-x-1/2 cursor-grab rounded-full border border-blue-500 bg-white shadow-[0_0_8px_rgba(59,130,246,0.6)] transition-transform hover:scale-115 active:cursor-grabbing"
              style={{
                left: `${displayPercent}%`,
                borderColor: themeColors?.primary ?? undefined,
                boxShadow: themeColors ? `0 0 8px ${themeColors.primary}` : undefined,
              }}
            />
          </div>
        </div>
      )}

      {/* Search */}
      {!articleTitle && (
        <div className="mb-3">
          <div className="border-border bg-accent/5 flex items-center gap-2 rounded-lg border px-3">
            <Search className="text-muted-foreground h-4 w-4 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search wiki articles..."
              className="text-foreground placeholder:text-muted-foreground w-full bg-transparent py-2 text-sm outline-none"
              data-command-palette-search="true"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search Results — full-text with snippets */}
      {!articleTitle && searchQuery.length >= 2 && (
        <div className="border-border mb-3 border-b pb-3">
          <div className="text-muted-foreground mb-1 flex items-center justify-between text-[10px] font-semibold tracking-wider uppercase">
            <PreText className="text-inherit" whiteSpace="nowrap">
              {`Results${searchData?.totalHits ? ` (${searchData.totalHits})` : ""}`}
            </PreText>
            {isSearching && (
              <PreText
                className="text-muted-foreground/80 animate-pulse text-[10px]"
                whiteSpace="nowrap"
              >
                searching...
              </PreText>
            )}
          </div>
          {searchResults.length > 0 ? (
            searchResults.map((result) => (
              <button
                key={result.title}
                onClick={() => handleNavigateToArticle(result.title)}
                className="text-foreground/70 hover:bg-accent/10 hover:text-foreground flex w-full flex-col rounded-md px-2 py-1.5 text-left transition-colors"
              >
                <span className="flex items-center gap-2 text-sm">
                  <PreText className="truncate font-medium text-inherit" whiteSpace="nowrap">
                    {result.title}
                  </PreText>
                </span>
                {result.snippet && (
                  <span
                    className="text-muted-foreground [&_.searchmatch]:text-foreground mt-0.5 line-clamp-1 pl-[22px] text-[11px] [&_.searchmatch]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: result.snippet }}
                  />
                )}
              </button>
            ))
          ) : !isSearching ? (
            <PreText className="text-muted-foreground/75 px-2 py-1 text-xs" whiteSpace="nowrap">
              No results
            </PreText>
          ) : null}
        </div>
      )}

      {!searchQuery && (
        <>
          {/* Local Drafts Section */}
          {localDrafts.length > 0 && (
            <CollapsibleSection
              label="Local Drafts"
              icon={<FileEdit className="h-3 w-3 text-blue-400" />}
              count={localDrafts.length}
              open={draftsOpen}
              onToggle={() => setDraftsOpen(!draftsOpen)}
            >
              <div className="max-h-[160px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent space-y-0.5 overflow-y-auto">
                {localDrafts.map((draft, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onClose();
                      navigateWithBasePath(
                        `/wiki/${encodeURIComponent(draft.title.replace(/ /g, "_"))}/edit`,
                        router
                      );
                    }}
                    className="text-foreground/60 hover:bg-accent/10 hover:text-foreground/90 flex w-full items-center justify-between rounded-md px-2 py-1 text-left transition-colors"
                  >
                    <div className="flex min-w-0 flex-1 flex-col pr-2">
                      <PreText
                        className="truncate text-[13px] font-medium text-inherit"
                        whiteSpace="nowrap"
                      >
                        {draft.title}
                      </PreText>
                      <PreText className="text-muted-foreground text-[9px]" whiteSpace="nowrap">
                        {draft.type === "visual"
                          ? "Visual Editor (Canvas) Draft"
                          : "Source Editor Draft"}
                      </PreText>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold text-blue-400">
                      Resume ›
                    </span>
                  </button>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Reading Progress / Paused Sessions Section */}
          {pausedSessions.length > 0 && (
            <CollapsibleSection
              label="Reading Progress"
              icon={<Clock className="h-3 w-3 text-emerald-400" />}
              count={pausedSessions.length}
              open={sessionsOpen}
              onToggle={() => setSessionsOpen(!sessionsOpen)}
            >
              <div className="max-h-[160px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent space-y-0.5 overflow-y-auto">
                {pausedSessions.map((session, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleNavigateToArticle(session.title)}
                    className="text-foreground/60 hover:bg-accent/10 hover:text-foreground/90 flex w-full items-center justify-between rounded-md px-2 py-1 text-left transition-colors"
                  >
                    <div className="flex min-w-0 flex-1 flex-col pr-2">
                      <PreText
                        className="truncate text-[13px] font-medium text-inherit"
                        whiteSpace="nowrap"
                      >
                        {session.title}
                      </PreText>
                      <PreText className="text-muted-foreground text-[9px]" whiteSpace="nowrap">
                        {`Last read ${formatTimeAgo(session.updatedAt)}`}
                      </PreText>
                    </div>
                    <span className="text-muted-foreground shrink-0 rounded border border-white/5 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                      {session.scrollPercent}%
                    </span>
                  </button>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Recent Activity — collapsible feed (removed on articles) */}
          {!articleTitle && (
            <CollapsibleSection
              label="Recent Activity"
              icon={<Clock className="h-3 w-3" />}
              open={recentOpen}
              onToggle={() => setRecentOpen(!recentOpen)}
            >
              {recentChanges && recentChanges.length > 0 ? (
                <div className="space-y-0.5">
                  {recentChanges.map((rc, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleNavigateToArticle(rc.title ?? "")}
                      className="text-foreground/60 hover:bg-accent/10 hover:text-foreground/90 flex w-full flex-col rounded-md px-2 py-1 text-left transition-colors"
                    >
                      <PreText className="truncate text-[13px] text-inherit" whiteSpace="nowrap">
                        {rc.title}
                      </PreText>
                      <PreText className="text-muted-foreground text-[10px]" whiteSpace="nowrap">
                        {`${rc.user} · ${formatMWTimeAgo(rc.timestamp)}`}
                      </PreText>
                    </button>
                  ))}
                </div>
              ) : (
                <PreText className="text-muted-foreground px-2 text-xs" whiteSpace="nowrap">
                  Loading...
                </PreText>
              )}
            </CollapsibleSection>
          )}

          {/* Narrator controls inside Dynamic Island */}
          {isNarratorActive && narratorActions && (
            <div className="border-border mb-3 border-b pb-3">
              <SectionHeader label="Audio Narrator" />
              <div className="flex items-center justify-between px-2 py-1.5 bg-white/5 rounded-md border border-white/5">
                <button
                  onClick={narratorActions.skipPrev}
                  className="text-zinc-400 hover:text-white p-1"
                  title="Previous block"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {narratorState.isPlaying ? (
                  <button
                    onClick={narratorActions.pause}
                    className="text-white hover:text-blue-400 p-1 flex items-center gap-1 text-[11px] font-bold"
                  >
                    <Pause className="h-3.5 w-3.5 fill-current" /> Pause
                  </button>
                ) : (
                  <button
                    onClick={narratorActions.play}
                    className="text-white hover:text-emerald-400 p-1 flex items-center gap-1 text-[11px] font-bold"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" /> Resume
                  </button>
                )}
                <button
                  onClick={narratorActions.skipNext}
                  className="text-zinc-400 hover:text-white p-1"
                  title="Next block"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Page Actions — contextual to current article */}
          {articleTitle && !isMainPage && (
            <div className="border-border mb-3 border-b pb-3">
              <SectionHeader label="This Page" />
              <div className="space-y-0.5">
                {isSignedIn && (
                  <QuickAction
                    icon={<FileEdit />}
                    label="Edit"
                    shortcut="Tab Tab"
                    onClick={() => {
                      onClose();
                      navigateWithBasePath(`/wiki/${slug}/edit`, router);
                    }}
                  />
                )}
                <QuickAction
                  icon={<History />}
                  label="History"
                  onClick={() => {
                    onClose();
                    navigateWithBasePath(`/wiki/history/${slug}`, router);
                  }}
                />
                <QuickAction
                  icon={<Link2 />}
                  label="What links here"
                  onClick={() => {
                    onClose();
                    navigateWithBasePath(`/wiki/whatlinkshere/${slug}`, router);
                  }}
                />
                <QuickAction
                  icon={<ExternalLink />}
                  label="View on Original Wiki"
                  onClick={() => {
                    onClose();
                    if (articleTitle) {
                      const mwBaseUrl =
                        process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com/";
                      const targetUrl = `${mwBaseUrl.replace(/\/$/, "")}/wiki/${encodeURIComponent(articleTitle.replace(/ /g, "_"))}`;
                      window.open(targetUrl, "_blank", "noopener,noreferrer");
                    }
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
      <PreText whiteSpace="nowrap">{label}</PreText>
    </div>
  );
}

function CollapsibleSection({
  label,
  icon,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border mb-3 border-b pb-3">
      <button
        onClick={onToggle}
        className="text-muted-foreground hover:text-foreground mb-1 flex w-full cursor-pointer items-center justify-between text-[10px] font-semibold tracking-wider uppercase"
      >
        <span className="flex items-center gap-1">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {icon}
          <PreText className="inline-block text-inherit" whiteSpace="nowrap">
            {label}
          </PreText>
        </span>
        {count !== undefined && (
          <PreText className="text-muted-foreground/75 inline-block shrink-0" whiteSpace="nowrap">
            {String(count)}
          </PreText>
        )}
      </button>
      {open && children}
    </div>
  );
}

function QuickAction({
  icon,
  label,
  shortcut,
  onClick,
}: {
  icon: React.ReactElement;
  label: string;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-foreground/60 hover:bg-accent/10 hover:text-foreground/90 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors"
    >
      <span className="flex items-center gap-2">
        <span className="text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        <PreText className="text-inherit" whiteSpace="nowrap">
          {label}
        </PreText>
      </span>
      {shortcut && (
        <PreText
          className="border-border bg-accent/10 text-muted-foreground shrink-0 rounded border px-1.5 py-0.5 text-[10px]"
          whiteSpace="nowrap"
        >
          {shortcut}
        </PreText>
      )}
    </button>
  );
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

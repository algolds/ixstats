// src/components/halo/views/WikiView.tsx
// Wiki mode for the Dynamic Island / Halo — search, collapsible TOC, narrator player, quick actions.

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X, Bell, Settings, Bookmark, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { useAuth } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { navigateWithBasePath } from "~/lib/base-path";
import { PreText } from "~/components/ui/pretext";
import { cn } from "~/lib/utils";
import type { DIViewProps } from "../types";
import {
  WikiNarratorPlayer,
  WikiWorkspaceTab,
  WikiSearchDropdown,
  type LocalDraft,
  type PausedSession,
} from "../wiki";
import { listDrafts } from "~/lib/wiki-os/draft-store";

export interface WikiViewProps extends DIViewProps {}

export function WikiView({ onClose, onSwitchMode }: WikiViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    articleTitle,
    tocEntries,
    themeColors,
    activeSectionId,
    narratorState,
    narratorActions,
  } = useWikiContext();

  const [searchQuery, setSearchQuery] = useState("");
  const [localDrafts, setLocalDrafts] = useState<LocalDraft[]>([]);
  const [pausedSessions, setPausedSessions] = useState<PausedSession[]>([]);
  const [wikiTab, setWikiTab] = useState<"workspace" | "nowplaying">("workspace");

  // Surface the player the moment narration starts
  useEffect(() => {
    if (narratorState?.isPlaying) setWikiTab("nowplaying");
  }, [narratorState?.isPlaying]);

  // Scan local drafts and paused reading sessions
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Scan local drafts
    try {
      const drafts = listDrafts().map((d) => ({
        title: d.title,
        type: d.mode as "visual" | "source",
      }));
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

  const visibleToc = useMemo(() => tocEntries.filter((e) => e.level <= 3), [tocEntries]);

  // Recent changes for the feed
  const { data: recentChanges } = api.wikios.getRecentChanges.useQuery(
    { limit: 5 },
    { staleTime: 60_000 }
  );

  const handleNavigateToArticle = useCallback(
    (title: string) => {
      onClose();
      navigateWithBasePath(`/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`, router);
    },
    [router, onClose]
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

  const showNowPlaying = !!articleTitle && wikiTab === "nowplaying";
  const showWorkspace = !articleTitle || wikiTab === "workspace";

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

      {/* Workspace / Now Playing tab switcher (articles only) */}
      {articleTitle && (
        <div className="mb-3 flex gap-1 rounded-lg border border-white/5 bg-white/5 p-0.5 select-none">
          {(["workspace", "nowplaying"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setWikiTab(t)}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all duration-200 active:scale-95",
                wikiTab === t
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              type="button"
            >
              {t === "workspace" ? "Workspace" : "Now Playing"}
            </button>
          ))}
        </div>
      )}

      {/* Now Playing: reading progress + narrator player */}
      {showNowPlaying && (
        <WikiNarratorPlayer
          visibleToc={visibleToc}
          activeSectionId={activeSectionId}
          themeColors={themeColors}
          scrollPercent={scrollPercent}
          sectionOffsets={sectionOffsets}
          narratorState={narratorState}
          narratorActions={narratorActions}
        />
      )}

      {/* Workspace: search, drafts, paused sessions, contextual actions */}
      {showWorkspace && (
        <>
          {!articleTitle && (
            <WikiSearchDropdown
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectArticle={handleNavigateToArticle}
            />
          )}

          {!searchQuery && (
            <WikiWorkspaceTab
              articleTitle={articleTitle}
              isMainPage={isMainPage}
              isSignedIn={isSignedIn}
              slug={slug}
              localDrafts={localDrafts}
              pausedSessions={pausedSessions}
              recentChanges={recentChanges}
              onClose={onClose}
              onNavigateToArticle={handleNavigateToArticle}
            />
          )}
        </>
      )}
    </div>
  );
}

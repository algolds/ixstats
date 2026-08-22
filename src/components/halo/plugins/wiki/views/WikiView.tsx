// src/components/halo/plugins/wiki/views/WikiView.tsx
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
import type { DIViewProps } from "~/components/halo/types";
import {
  WikiNarratorPlayer,
  WikiWorkspaceTab,
  WikiSearchDropdown,
} from "../components";
import { type LocalDraft, type PausedSession } from "../types";
import { listDrafts } from "~/lib/wiki-os/editor/draft-store";

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
  const [wikiTab, setWikiTab] = useState<"workspace" | "narrator">(
    narratorState?.isPlaying || (narratorState && narratorState.activeBlockIndex > 0)
      ? "narrator"
      : "workspace"
  );

  // Surface the player the moment narration starts or state updates
  useEffect(() => {
    if (narratorState?.isPlaying) setWikiTab("narrator");
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

  const handleNavigateToArticle = useCallback(
    (title: string) => {
      onClose();
      navigateWithBasePath(`/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`, router);
    },
    [router, onClose]
  );

  const slug = articleTitle ? encodeURIComponent(articleTitle.replace(/ /g, "_")) : null;
  const { isSignedIn } = useAuth();

  // Stash state
  const { data: stashStatus, refetch: refetchStash } = api.wikios.isStashed.useQuery(
    { pageTitle: articleTitle ?? "" },
    { enabled: !!articleTitle && !!isSignedIn }
  );
  const isStashed = stashStatus?.stashed ?? false;

  const stashMutation = api.wikios.stashPage.useMutation({
    onSuccess: () => refetchStash(),
  });
  const unstashMutation = api.wikios.unstashPage.useMutation({
    onSuccess: () => refetchStash(),
  });

  const isStashPending = stashMutation.isPending || unstashMutation.isPending;

  const handleToggleStash = async () => {
    if (!articleTitle) return;
    if (isStashed) {
      await unstashMutation.mutateAsync({ pageTitle: articleTitle });
    } else {
      await stashMutation.mutateAsync({ pageTitle: articleTitle });
    }
  };

  // Section scroll offsets
  const [sectionOffsets, setSectionOffsets] = useState<Record<string, number>>({});
  const [scrollPercent, setScrollPercent] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || visibleToc.length === 0) return;

    const computeOffsets = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;

      const offsets: Record<string, number> = {};
      visibleToc.forEach((entry) => {
        const el = document.getElementById(entry.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          const top = rect.top + window.scrollY;
          offsets[entry.id] = Math.min(100, Math.max(0, (top / scrollHeight) * 100));
        }
      });
      setSectionOffsets(offsets);
    };

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        setScrollPercent(Math.min(100, Math.max(0, (window.scrollY / scrollHeight) * 100)));
      }
    };

    computeOffsets();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", computeOffsets, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", computeOffsets);
    };
  }, [visibleToc]);

  return (
    <div className="p-4">
      {/* Top Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {themeColors && (
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: themeColors.primary }}
            />
          )}
          <PreText
            className="text-foreground max-w-[200px] truncate text-sm font-semibold"
            whiteSpace="nowrap"
          >
            {articleTitle || "IxWiki Workspace"}
          </PreText>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-1">
          {onSwitchMode && (
            <>
              <button
                type="button"
                onClick={() => onSwitchMode("search")}
                className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
                title="Global Search"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onSwitchMode("notifications")}
                className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
                title="Notifications"
              >
                <Bell className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onSwitchMode("settings")}
                className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
                title="Settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {articleTitle && !isMainPage && isSignedIn && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleToggleStash}
              disabled={isStashPending}
              className={cn(
                "h-7 w-7 rounded-full p-0 transition-colors",
                isStashed ? "text-amber-400 hover:text-amber-300" : "text-muted-foreground hover:text-foreground"
              )}
              title={isStashed ? "Remove from Stash" : "Save to Stash"}
            >
              {isStashPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Bookmark className={cn("h-3.5 w-3.5", isStashed && "fill-current")} />
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground h-7 w-7 rounded-full p-0"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Full-text Wiki Article Search Dropdown */}
      <WikiSearchDropdown
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectArticle={handleNavigateToArticle}
      />

      {/* Segmented Tab Switcher (Workspace vs Narrator) */}
      {narratorState && narratorState.totalBlocks > 0 && (
        <div className="bg-accent/15 mb-3 flex w-full rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setWikiTab("workspace")}
            className={cn(
              "flex-1 rounded-md py-1 text-center text-xs font-semibold transition-all cursor-pointer",
              wikiTab === "workspace"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-white/15 dark:text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Workspace
          </button>
          <button
            type="button"
            onClick={() => setWikiTab("narrator")}
            className={cn(
              "flex-1 rounded-md py-1 text-center text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5",
              wikiTab === "narrator"
                ? "bg-white text-blue-600 shadow-sm dark:bg-white/15 dark:text-blue-400"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>Narrator</span>
            <span
              className={cn(
                "px-1.5 py-0.2 rounded-full text-[8.5px] font-bold tracking-widest uppercase transition-colors",
                wikiTab === "narrator"
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "bg-white/10 text-zinc-400 border border-white/5"
              )}
            >
              BETA
            </span>
            {narratorState?.isPlaying && (
              <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse ml-0.5" />
            )}
          </button>
        </div>
      )}

      {/* Tab 1: Narrator Player Focus */}
      {wikiTab === "narrator" && (
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

      {/* Tab 2: Workspace View */}
      {wikiTab === "workspace" && (
        <WikiWorkspaceTab
          articleTitle={articleTitle}
          isMainPage={isMainPage}
          isSignedIn={isSignedIn}
          slug={slug}
          localDrafts={localDrafts}
          pausedSessions={pausedSessions}
          onClose={onClose}
          onNavigateToArticle={handleNavigateToArticle}
        />
      )}
    </div>
  );
}

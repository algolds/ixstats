"use client";

/**
 * WikiHalo — Apple Design Halo overlay plugin for wiki pages.
 *
 * Claims Halo's center capsule only while reading a specific article or actively narrating.
 * On non-article Wiki routes (/wiki, /util/*, /stashes, /blurbs), Halo's center keeps the
 * standard personal greeting -> AccountView and exposes Wiki workspace as a dedicated action.
 */

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { List, Page as FileText, SoundHigh } from "iconoir-react";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { useHasNarratorAccess } from "~/hooks/usePermissions";
import { useDIPlugin } from "~/components/halo/plugin-context";
import type { DIViewProps, PluginCommand } from "~/components/halo/types";
import { PlayPauseMorph } from "./components/PlayPauseMorph";
import { focusRing, hitSlop } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { accentMix, wikiAccent } from "./accent";

// The plugin's metadata (id, priority, breadcrumb, accent) is synchronous; its expanded views are not needed
// until the Halo opens, so each is its own chunk fetched then (plan 415, F19): the narrator player and the
// workspace view stay out of every article page's first load.
const WikiView = dynamic(() => import("./views/WikiView").then((m) => m.WikiView), { ssr: false });
const WikiProfileView = dynamic(
  () => import("./views/WikiProfileView").then((m) => m.WikiProfileView),
  { ssr: false }
);
const WikiNarratorView = dynamic(
  () => import("./views/WikiNarratorView").then((m) => m.WikiNarratorView),
  { ssr: false }
);

export function hasSpecificWikiArticleTitle(articleTitle: string | null | undefined): boolean {
  return Boolean(articleTitle && articleTitle !== "IxWiki" && articleTitle !== "Main Page");
}

function WikiBreadcrumb() {
  const { articleTitle, activeSectionId, tocEntries, narratorState } = useWikiContext();
  const hasNarratorAccess = useHasNarratorAccess();

  const isNarratorActive = !!(
    hasNarratorAccess &&
    narratorState &&
    narratorState.totalBlocks > 0 &&
    (narratorState.isPlaying || narratorState.activeBlockIndex > 0)
  );

  const hasSpecificTitle = hasSpecificWikiArticleTitle(articleTitle);

  const activeSectionName = activeSectionId
    ? (tocEntries.find((e) => e.id === activeSectionId)?.text ?? null)
    : null;

  // Narrator Active in Breadcrumb: label only (play/pause lives in WikiCenterActions)
  if (isNarratorActive) {
    return (
      <div className="flex max-w-[150px] min-w-0 items-center gap-2 select-none sm:max-w-[190px]">
        {/* The article colour has no contrast guarantee on chrome, so the title stays label ink. */}
        <span className="text-label text-caption truncate font-semibold">
          {hasSpecificTitle ? articleTitle : "Wiki narrator"}
        </span>

        {activeSectionName && (
          <span className="text-label-secondary text-footnote hidden truncate sm:inline">
            · {activeSectionName}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex max-w-[120px] min-w-0 items-center gap-2 sm:max-w-[150px]">
      <span className="text-label text-caption max-w-[90px] truncate font-semibold sm:max-w-[120px]">
        {articleTitle}
      </span>
    </div>
  );
}

function WikiCenterActions() {
  const {
    articleTitle,
    activeSectionId,
    tocEntries,
    navigateToSection,
    themeColors,
    narratorState,
    narratorActions,
  } = useWikiContext();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const hasNarratorAccess = useHasNarratorAccess();

  const isNarratorActive = !!(
    hasNarratorAccess &&
    narratorState &&
    narratorState.totalBlocks > 0 &&
    (narratorState.isPlaying || narratorState.activeBlockIndex > 0)
  );

  if (isNarratorActive && narratorActions) {
    return (
      <button
        type="button"
        onClick={() => {
          if (narratorState.isPlaying) {
            narratorActions.pause();
          } else {
            narratorActions.play();
          }
        }}
        aria-label={narratorState.isPlaying ? "Pause narration" : "Resume narration"}
        className={cn(
          "bg-tint text-on-tint relative flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full",
          focusRing,
          hitSlop
        )}
      >
        <PlayPauseMorph isPlaying={!!narratorState.isPlaying} size={10} className="fill-current" />
      </button>
    );
  }

  const hasSpecificTitle = hasSpecificWikiArticleTitle(articleTitle);
  const activeSectionName = activeSectionId
    ? (tocEntries.find((e) => e.id === activeSectionId)?.text ?? null)
    : null;

  if (!hasSpecificTitle || !activeSectionName) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <span className="text-label-secondary text-footnote shrink-0" aria-hidden="true">
        ›
      </span>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "hover:text-label text-label-secondary hover:bg-fill-3 text-caption rounded-control-sm duration-fast z-raised relative inline-flex max-w-[70px] cursor-pointer items-center px-1 py-0.5 text-left transition-colors",
              focusRing,
              hitSlop
            )}
          >
            <span className="truncate">{activeSectionName}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" sideOffset={8} className="w-56 p-2">
          <div className="max-h-[200px] scrollbar-thin space-y-0.5 overflow-y-auto select-none">
            {tocEntries
              .filter((e) => e.level <= 3)
              .map((entry) => {
                const isActive = activeSectionId === entry.id;
                return (
                  <button
                    key={entry.id}
                    onClick={() => {
                      navigateToSection(entry.id);
                      setPopoverOpen(false);
                    }}
                    className={cn(
                      "text-caption rounded-control-sm duration-fast flex w-full cursor-pointer items-center px-3 py-2 text-left transition-colors select-none",
                      focusRing,
                      isActive
                        ? "text-label"
                        : "text-label-secondary hover:text-label hover:bg-fill-3",
                      entry.level === 3 ? "pl-5" : ""
                    )}
                    style={
                      isActive
                        ? { backgroundColor: accentMix(wikiAccent(themeColors), 12) }
                        : undefined
                    }
                    type="button"
                  >
                    {entry.level === 3 && (
                      <span className="text-label-tertiary text-footnote mr-1">›</span>
                    )}
                    <span className="truncate">{entry.text}</span>
                  </button>
                );
              })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function wikiCommandsForArticle({
  articleTitle,
  toc,
  canNarrate,
  isPlaying,
  onJumpSection,
  onToggleNarrator,
}: {
  articleTitle: string | null;
  toc: ReadonlyArray<{ id: string; text: string }>;
  canNarrate: boolean;
  isPlaying: boolean;
  onJumpSection: (id: string) => void;
  onToggleNarrator: () => void;
}): PluginCommand[] {
  const commands: PluginCommand[] = [];
  if (canNarrate) {
    commands.push({
      key: "narrator-toggle",
      title: isPlaying ? "Pause article narration" : "Narrate article",
      description: articleTitle ? `Listen to ${articleTitle}` : "Read this article aloud",
      keywords: ["narrate", "narrator", "listen", "audio", isPlaying ? "pause" : "play"],
      icon: SoundHigh,
      run: onToggleNarrator,
    });
  }
  for (const entry of toc) {
    commands.push({
      key: `toc-${entry.id}`,
      title: `Jump to ${entry.text}`,
      description: articleTitle ? `Section in ${articleTitle}` : "Article section",
      keywords: ["section", "heading", "jump", entry.text.toLowerCase()],
      icon: List,
      run: () => onJumpSection(entry.id),
    });
  }
  commands.push({
    key: "wiki-workspace",
    title: "Open wiki workspace",
    description: "Scratchpad, paused sessions, and recent pages",
    keywords: ["workspace", "scratchpad", "notes", "sessions", "recent"],
    icon: FileText,
    pluginView: "profile",
  });
  return commands;
}

export function WikiHalo() {
  const {
    articleTitle,
    tocEntries,
    navigateToSection,
    narratorState,
    narratorActions,
    themeColors,
  } = useWikiContext();
  const hasNarratorAccess = useHasNarratorAccess();
  const isPlaying = hasNarratorAccess && !!narratorState?.isPlaying;
  const canNarrate = !!(hasNarratorAccess && narratorState && narratorState.totalBlocks > 0);
  const isNarrating = !!(
    canNarrate &&
    narratorState &&
    (narratorState.isPlaying || narratorState.activeBlockIndex > 0)
  );
  const ownsCenter = hasSpecificWikiArticleTitle(articleTitle) || isNarrating;

  const tocKey = JSON.stringify(
    (tocEntries ?? []).filter((e) => e.level <= 3).map((e) => ({ id: e.id, text: e.text }))
  );

  const accent = wikiAccent(themeColors);

  const plugin = useMemo(() => {
    const parsedToc = JSON.parse(tocKey) as Array<{ id: string; text: string }>;
    return {
      id: "wiki",
      // When narrating or playing audio, boost priority to 100 so it takes over Halo like a live activity
      priority: isPlaying ? 100 : isNarrating ? 50 : 10,
      center: ownsCenter ? <WikiBreadcrumb /> : undefined,
      centerActions: ownsCenter ? <WikiCenterActions /> : undefined,
      actions: ownsCenter
        ? undefined
        : [
            {
              id: "wiki-workspace",
              icon: FileText,
              label: "Wiki workspace",
              pluginView: "profile",
            },
          ],
      expandedViews: (ownsCenter
        ? {
            wiki: WikiView,
            profile: WikiProfileView,
            ...(hasNarratorAccess ? { narrator: WikiNarratorView } : {}),
          }
        : {
            profile: WikiProfileView,
            wiki: WikiView,
            ...(hasNarratorAccess ? { narrator: WikiNarratorView } : {}),
          }) as Record<string, React.ComponentType<DIViewProps>>,
      commands: wikiCommandsForArticle({
        articleTitle,
        toc: parsedToc,
        canNarrate,
        isPlaying,
        onJumpSection: navigateToSection,
        onToggleNarrator: () => {
          if (!narratorActions) return;
          if (isPlaying) narratorActions.pause();
          else narratorActions.play();
        },
      }),
      accentColor: accent,
    };
  }, [
    articleTitle,
    ownsCenter,
    hasNarratorAccess,
    canNarrate,
    isPlaying,
    isNarrating,
    accent,
    tocKey,
    navigateToSection,
    narratorActions,
  ]);

  useDIPlugin(plugin);
  return null;
}

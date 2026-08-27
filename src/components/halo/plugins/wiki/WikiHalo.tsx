"use client";

/**
 * WikiHalo — Apple Design Halo overlay plugin for wiki pages.
 *
 * Renders the wiki breadcrumb in the capsule center and exposes
 * WikiNarratorView, WikiView, and WikiProfileView as dedicated expanded views.
 */

import React, { useMemo, useState } from "react";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { useUser } from "~/context/auth-context";
import { useHasNarratorAccess } from "~/hooks/usePermissions";
import { useIxTimeStore } from "~/stores/ixtime-store";
import { useDIPlugin } from "~/components/halo/plugin-context";
import type { DIViewProps } from "~/components/halo/types";
import { WikiView, WikiProfileView, WikiNarratorView } from "./views";
import { PlayPauseMorph } from "./components/PlayPauseMorph";
import { PreText } from "~/components/ui/pretext";
import { cn } from "~/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";

function getGreeting(ixTime: number): string {
  const hour = new Date(ixTime).getUTCHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

function getRgbaColor(colorStr: string, opacity: number): string {
  if (colorStr.startsWith("#")) {
    const cleanHex = colorStr.replace("#", "");
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  if (colorStr.startsWith("hsl")) {
    return colorStr.replace("hsl(", "hsla(").replace(")", `, ${opacity})`);
  }
  return `rgba(59, 130, 246, ${opacity})`;
}

function WikiBreadcrumb() {
  const { user } = useUser();
  const ixTimeTimestamp = useIxTimeStore((s) => Math.floor(s.ixTimeTimestamp / 30000) * 30000);
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

  const greetingText = useMemo(() => {
    // oxlint-disable-next-line
    const timeGreeting = getGreeting(ixTimeTimestamp || Date.now());
    return `${timeGreeting}${user?.firstName ? `, ${user.firstName}` : ""}`;
  }, [ixTimeTimestamp, user?.firstName]);

  const hasNarratorAccess = useHasNarratorAccess();

  const isNarratorActive = !!(
    hasNarratorAccess &&
    narratorState &&
    narratorState.totalBlocks > 0 &&
    (narratorState.isPlaying || narratorState.activeBlockIndex > 0)
  );

  const hasSpecificTitle = Boolean(
    articleTitle && articleTitle !== "IxWiki" && articleTitle !== "Main Page"
  );

  const activeSectionName = activeSectionId
    ? (tocEntries.find((e) => e.id === activeSectionId)?.text ?? null)
    : null;

  const accentColor = themeColors?.primary || "#3b82f6";

  // ── Narrator Active in Breadcrumb: Clean, tactile, zero clutter ──
  if (isNarratorActive && narratorActions) {
    return (
      <div className="flex max-w-[170px] min-w-0 items-center gap-1.5 select-none sm:max-w-[220px]">
        {/* Leading: Tactile Apple Play/Pause Morph Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (narratorState.isPlaying) {
              narratorActions.pause();
            } else {
              narratorActions.play();
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-white shadow-xs transition-all duration-150 hover:scale-105 active:scale-88"
          style={{
            backgroundColor: accentColor,
            boxShadow: `0 1px 6px ${getRgbaColor(accentColor, 0.35)}`,
          }}
          title={narratorState.isPlaying ? "Pause narration" : "Resume narration"}
        >
          <PlayPauseMorph
            isPlaying={!!narratorState.isPlaying}
            size={10}
            className="fill-current text-white"
          />
        </button>

        {/* Title in theme color */}
        <span
          className="truncate text-xs font-semibold tracking-tight transition-colors"
          style={{ color: accentColor }}
        >
          {hasSpecificTitle ? articleTitle : "Wiki Narrator"}
        </span>

        {activeSectionName && (
          <span className="text-muted-foreground/75 hidden truncate text-[10px] sm:inline">
            · {activeSectionName}
          </span>
        )}
      </div>
    );
  }

  // ── Default Reading / Profile Breadcrumb ──
  return (
    <div className="flex max-w-[160px] min-w-0 items-center gap-1.5 sm:max-w-[200px]">
      {/* Title or Personalized Greeting */}
      {hasSpecificTitle ? (
        <span
          className="max-w-[90px] truncate text-xs font-semibold transition-colors sm:max-w-[120px]"
          style={themeColors?.primary ? { color: themeColors.primary } : undefined}
        >
          {articleTitle}
        </span>
      ) : (
        <span className="flex min-w-0 items-center gap-1.5">
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              className="h-4 w-4 shrink-0 rounded-full object-cover ring-1 ring-white/20"
            />
          ) : (
            <span className="text-muted-foreground h-3.5 w-3.5 shrink-0 text-xs">👤</span>
          )}
          <PreText
            className="text-foreground/90 max-w-[100px] truncate text-xs font-medium sm:max-w-[130px]"
            whiteSpace="nowrap"
          >
            {greetingText}
          </PreText>
        </span>
      )}

      {/* Section Popover Dropdown when not in narrator mode */}
      {hasSpecificTitle && activeSectionName && (
        <>
          <span className="text-foreground/25 shrink-0 text-[10px]">›</span>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <span
                className="hover:text-foreground text-foreground/50 relative z-[60] inline-block max-w-[70px] cursor-pointer truncate overflow-hidden rounded px-1 py-0.5 text-left text-[10px] font-medium transition-all duration-200 hover:bg-white/20 active:scale-95"
                onClick={(e) => {
                  e.stopPropagation();
                  setPopoverOpen((prev) => !prev);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                {activeSectionName}
              </span>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="start"
              sideOffset={8}
              className="w-56 rounded-xl border border-white/10 bg-zinc-950/95 p-1.5 backdrop-blur-xl dark:bg-black/90"
            >
              <div className="max-h-[200px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent space-y-0.5 overflow-y-auto select-none">
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
                          "flex w-full cursor-pointer items-center rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold transition-all duration-150 select-none",
                          isActive && !themeColors
                            ? "bg-white/15 text-white"
                            : isActive
                              ? ""
                              : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                          entry.level === 3 ? "pl-5" : ""
                        )}
                        style={
                          isActive && themeColors
                            ? {
                                color: themeColors.primary,
                                backgroundColor: getRgbaColor(themeColors.primary, 0.08),
                              }
                            : {}
                        }
                        type="button"
                      >
                        {entry.level === 3 && (
                          <span className="text-muted-foreground/60 mr-1 text-[9px]">›</span>
                        )}
                        <span className="truncate">{entry.text}</span>
                      </button>
                    );
                  })}
              </div>
            </PopoverContent>
          </Popover>
        </>
      )}
    </div>
  );
}

export function WikiHalo() {
  const { articleTitle, narratorState, themeColors } = useWikiContext();
  const hasNarratorAccess = useHasNarratorAccess();
  const isPlaying = hasNarratorAccess && !!narratorState?.isPlaying;
  const isNarrating = !!(
    hasNarratorAccess &&
    narratorState &&
    narratorState.totalBlocks > 0 &&
    (narratorState.isPlaying || narratorState.activeBlockIndex > 0)
  );

  const plugin = useMemo(
    () => ({
      id: "wiki",
      // When narrating or playing audio, boost priority to 100 so it takes over the Dynamic Island / Halo like a live activity
      priority: isPlaying ? 100 : isNarrating ? 50 : 10,
      center: <WikiBreadcrumb />,
      expandedViews: (articleTitle
        ? {
            wiki: WikiView,
            ...(hasNarratorAccess ? { narrator: WikiNarratorView } : {}),
          }
        : {
            profile: WikiProfileView,
            wiki: WikiView,
            ...(hasNarratorAccess ? { narrator: WikiNarratorView } : {}),
          }) as Record<string, React.ComponentType<DIViewProps>>,
      accentColor: themeColors?.primary || "#3b82f6",
      stickyLabel: isPlaying ? "Narrating" : "Wiki",
    }),
    [articleTitle, hasNarratorAccess, isPlaying, isNarrating, themeColors?.primary]
  );

  useDIPlugin(plugin);
  return null;
}

// Backwards compatibility alias
export const WikiDIPlugin = WikiHalo;

"use client";

/**
 * WikiHalo — Apple Design Halo overlay plugin for wiki pages.
 *
 * Renders the wiki breadcrumb in the capsule center and exposes
 * WikiNarratorView, WikiView, and WikiProfileView as dedicated expanded views.
 */

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ProfileCircle } from "iconoir-react";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { useUser } from "~/context/auth-context";
import { useHasNarratorAccess } from "~/hooks/usePermissions";
import { useContextHour } from "~/hooks/useContextHour";
import { greetingForHour } from "~/lib/time/greeting";
import { useDIPlugin } from "~/components/halo/plugin-context";
import type { DIViewProps } from "~/components/halo/types";
import { PlayPauseMorph } from "./components/PlayPauseMorph";
import { PreText } from "~/components/ui/pretext";
import { cn } from "~/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { assetUrl } from "~/lib/base-path";
import { accentMix, wikiAccent } from "./accent";

// The plugin's metadata (id, priority, breadcrumb, accent) is synchronous; its expanded views are not needed
// until the Halo opens, so each is its own chunk fetched then (plan 415, F19): the narrator player and the
// profile view stay out of every article page's first load.
const WikiView = dynamic(() => import("./views/WikiView").then((m) => m.WikiView), { ssr: false });
const WikiProfileView = dynamic(
  () => import("./views/WikiProfileView").then((m) => m.WikiProfileView),
  { ssr: false }
);
const WikiNarratorView = dynamic(
  () => import("./views/WikiNarratorView").then((m) => m.WikiNarratorView),
  { ssr: false }
);

function WikiBreadcrumb() {
  const { user } = useUser();
  const hour = useContextHour();
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
    const timeGreeting = hour === null ? "Welcome" : greetingForHour(hour);
    return `${timeGreeting}${user?.firstName ? `, ${user.firstName}` : ""}`;
  }, [hour, user?.firstName]);

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

  // Narrator Active in Breadcrumb: Clean, tactile, zero clutter
  if (isNarratorActive && narratorActions) {
    return (
      <div className="flex max-w-[170px] min-w-0 items-center gap-2 select-none sm:max-w-[220px]">
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
          className="bg-tint text-on-tint flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full"
          title={narratorState.isPlaying ? "Pause narration" : "Resume narration"}
        >
          <PlayPauseMorph
            isPlaying={!!narratorState.isPlaying}
            size={10}
            className="fill-current"
          />
        </button>

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

  // Default Reading / Profile Breadcrumb
  return (
    <div className="flex max-w-[160px] min-w-0 items-center gap-2 sm:max-w-[200px]">
      {/* Title or Personalized Greeting */}
      {hasSpecificTitle ? (
        <span className="text-label text-caption max-w-[90px] truncate font-semibold sm:max-w-[120px]">
          {articleTitle}
        </span>
      ) : (
        <span className="flex min-w-0 items-center gap-2">
          {user?.imageUrl ? (
            <img
              src={assetUrl(user.imageUrl) ?? undefined}
              alt=""
              className="ring-separator h-4 w-4 shrink-0 rounded-full object-cover ring-1"
            />
          ) : (
            <ProfileCircle aria-hidden className="text-label-secondary size-4 shrink-0" />
          )}
          <PreText
            className="text-label text-caption max-w-[100px] truncate sm:max-w-[130px]"
            whiteSpace="nowrap"
          >
            {greetingText}
          </PreText>
        </span>
      )}

      {/* Section Popover Dropdown when not in narrator mode */}
      {hasSpecificTitle && activeSectionName && (
        <>
          <span className="text-label-secondary text-footnote shrink-0">›</span>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <span
                className="hover:text-label text-label-secondary hover:bg-fill-3 text-caption rounded-control-sm duration-fast relative z-10 inline-block max-w-[70px] cursor-pointer truncate overflow-hidden px-1 py-0.5 text-left transition-colors"
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

  const accent = wikiAccent(themeColors);

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
      accentColor: accent,
      stickyLabel: isPlaying ? "Narrating" : "Wiki",
    }),
    [articleTitle, hasNarratorAccess, isPlaying, isNarrating, accent]
  );

  useDIPlugin(plugin);
  return null;
}

// Backwards compatibility alias

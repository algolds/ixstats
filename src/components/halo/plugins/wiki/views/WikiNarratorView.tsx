"use client";
// src/components/halo/plugins/wiki/views/WikiNarratorView.tsx
// Dedicated Now Playing Narrator expanded view for the Dynamic Island / Halo.
// Provides a focused, distraction-free audio player experience with Apple Design motion.

import React from "react";
import {
  Headset as Headphones,
  OpenBook as BookOpen,
  Xmark as X,
  ShieldAlert,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { useHasNarratorAccess } from "~/hooks/usePermissions";
import { WikiNarratorPlayer } from "../components";
import type { DIViewProps } from "~/components/halo/types";

export interface WikiNarratorViewProps extends DIViewProps {}

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

export function WikiNarratorView({ onClose, onSwitchMode }: WikiNarratorViewProps) {
  const hasNarratorAccess = useHasNarratorAccess();
  const { articleTitle, tocEntries, themeColors, activeSectionId, narratorState, narratorActions } =
    useWikiContext();

  const accentColor = themeColors?.primary || "#3b82f6";
  const visibleToc = React.useMemo(() => tocEntries.filter((e) => e.level <= 3), [tocEntries]);

  if (!hasNarratorAccess) {
    return (
      <div className="animate-in fade-in zoom-in-95 flex w-full flex-col gap-3 p-4 duration-150 select-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="text-yellow h-4 w-4" />
            <span className="text-label text-caption font-semibold">Early access feature</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-label-secondary hover:text-label size-7 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-label-secondary text-footnote">
          The WikiOS audio narrator is limited to system owners, administrators and beta testers.
        </p>
        {onSwitchMode && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSwitchMode("plugin:wiki")}
            className="border-separator w-full"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Go to Wiki Workspace
          </Button>
        )}
      </div>
    );
  }

  const displayPercent =
    narratorState && narratorState.totalBlocks > 0
      ? ((narratorState.activeBlockIndex + 1) / narratorState.totalBlocks) * 100
      : 0;

  return (
    <div className="animate-in fade-in zoom-in-95 flex w-full flex-col gap-2 p-3 duration-150 select-none">
      {/* ── Top Header with Quick Action to Switch to Wiki Workspace ── */}
      <div className="flex items-center justify-between gap-2 px-1 pb-1">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="rounded-control flex h-7 w-7 shrink-0 items-center justify-center border"
            style={{
              backgroundColor: getRgbaColor(accentColor, 0.12),
              borderColor: getRgbaColor(accentColor, 0.25),
              color: accentColor,
            }}
          >
            <Headphones className="h-3.5 w-3.5" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-label-secondary text-eyebrow">Now playing · Narrator</span>
            <span className="text-headline truncate" style={{ color: accentColor }}>
              {articleTitle || "Wiki article"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Progress Reading Pill */}
          {narratorState && narratorState.totalBlocks > 0 && (
            <div className="text-label-secondary bg-fill-4 border-separator rounded-control-sm text-footnote flex items-center gap-1 border px-2 py-0.5 tabular-nums">
              <span>
                {narratorState.activeBlockIndex + 1}/{narratorState.totalBlocks}
              </span>
              <span className="text-label font-semibold">({Math.round(displayPercent)}%)</span>
            </div>
          )}

          {/* Switch to Full Wiki Workspace */}
          {onSwitchMode && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSwitchMode("plugin:wiki")}
              className="border-separator hover:bg-fill-4"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Workspace</span>
            </Button>
          )}

          {/* Close */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-label-secondary hover:text-label size-7 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Seamless Full-Feature Audio-UI Player (No Inner Card) ── */}
      <div className="w-full">
        <WikiNarratorPlayer
          visibleToc={visibleToc}
          activeSectionId={activeSectionId}
          themeColors={themeColors}
          narratorState={narratorState}
          narratorActions={narratorActions}
          showHeader={false}
        />
      </div>
    </div>
  );
}

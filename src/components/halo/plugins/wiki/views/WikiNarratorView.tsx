// src/components/halo/plugins/wiki/views/WikiNarratorView.tsx
// Dedicated Now Playing Narrator expanded view for the Dynamic Island / Halo.
// Provides a focused, distraction-free audio player experience with Apple Design motion.

"use client";

import React from "react";
import { Headphones, BookOpen, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
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
  const {
    articleTitle,
    tocEntries,
    themeColors,
    activeSectionId,
    narratorState,
    narratorActions,
  } = useWikiContext();

  const accentColor = themeColors?.primary || "#3b82f6";
  const visibleToc = React.useMemo(() => tocEntries.filter((e) => e.level <= 3), [tocEntries]);

  const displayPercent =
    narratorState && narratorState.totalBlocks > 0
      ? ((narratorState.activeBlockIndex + 1) / narratorState.totalBlocks) * 100
      : 0;

  return (
    <div className="flex flex-col gap-2 p-3 select-none w-full animate-in fade-in zoom-in-95 duration-150">
      {/* ── Top Header with Quick Action to Switch to Wiki Workspace ── */}
      <div className="flex items-center justify-between gap-2 px-1 pb-1">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border shadow-2xs"
            style={{
              backgroundColor: getRgbaColor(accentColor, 0.12),
              borderColor: getRgbaColor(accentColor, 0.25),
              color: accentColor,
            }}
          >
            <Headphones className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">
              Now Playing · Narrator
            </span>
            <span
              className="truncate text-sm font-bold tracking-tight"
              style={{ color: accentColor }}
            >
              {articleTitle || "Wiki Article"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Progress Reading Pill */}
          {narratorState && narratorState.totalBlocks > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground tabular-nums px-1.5 py-0.5 rounded-md bg-muted/40 border border-border/30">
              <span>
                {narratorState.activeBlockIndex + 1}/{narratorState.totalBlocks}
              </span>
              <span className="font-bold text-foreground">({Math.round(displayPercent)}%)</span>
            </div>
          )}

          {/* Switch to Full Wiki Workspace */}
          {onSwitchMode && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSwitchMode("plugin:wiki")}
              className="h-7 px-2 text-xs font-semibold gap-1.5 rounded-lg border-border/50 hover:bg-muted/60 active:scale-95 cursor-pointer"
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
            className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground active:scale-95 cursor-pointer"
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

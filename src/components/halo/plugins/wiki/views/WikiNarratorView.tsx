// src/components/halo/plugins/wiki/views/WikiNarratorView.tsx
// Dedicated Now Playing Narrator expanded view for the Dynamic Island / Halo.
// Provides a focused, distraction-free audio player experience with Apple Design motion.

"use client";

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
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <span className="text-foreground text-xs font-bold">Early Access Feature</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground h-7 w-7 rounded-lg p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          WikiOS Audio Narrator is currently restricted to system owners, administrators, and beta
          testers.
        </p>
        {onSwitchMode && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSwitchMode("plugin:wiki")}
            className="border-border/50 w-full gap-1.5 rounded-lg text-xs font-semibold"
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
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border shadow-2xs"
            style={{
              backgroundColor: getRgbaColor(accentColor, 0.12),
              borderColor: getRgbaColor(accentColor, 0.25),
              color: accentColor,
            }}
          >
            <Headphones className="h-3.5 w-3.5" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-muted-foreground text-[9.5px] font-bold tracking-wider uppercase">
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

        <div className="flex shrink-0 items-center gap-1.5">
          {/* Progress Reading Pill */}
          {narratorState && narratorState.totalBlocks > 0 && (
            <div className="text-muted-foreground bg-muted/40 border-border/30 flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px] tabular-nums">
              <span>
                {narratorState.activeBlockIndex + 1}/{narratorState.totalBlocks}
              </span>
              <span className="text-foreground font-bold">({Math.round(displayPercent)}%)</span>
            </div>
          )}

          {/* Switch to Full Wiki Workspace */}
          {onSwitchMode && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSwitchMode("plugin:wiki")}
              className="border-border/50 hover:bg-muted/60 h-7 cursor-pointer gap-1.5 rounded-lg px-2 text-xs font-semibold active:scale-95"
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
            className="text-muted-foreground hover:text-foreground h-7 w-7 cursor-pointer rounded-lg p-0 active:scale-95"
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

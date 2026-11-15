"use client";
// src/components/halo/plugins/wiki/views/WikiNarratorView.tsx
// Dedicated Now Playing Narrator expanded view for the Dynamic Island / Halo.
// Provides a focused, distraction-free audio player experience with Apple Design motion.

import { Headset as Headphones, OpenBook as BookOpen, ShieldAlert } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { HaloViewHeader, HaloWell } from "~/components/halo/views/shared/HaloViewParts";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { useHasNarratorAccess } from "~/hooks/usePermissions";
import { WikiNarratorPlayer } from "../components";
import type { DIViewProps } from "~/components/halo/types";
import { accentMix, wikiAccent } from "../accent";

interface WikiNarratorViewProps extends DIViewProps {}

export function WikiNarratorView({ onClose, onSwitchMode }: WikiNarratorViewProps) {
  const hasNarratorAccess = useHasNarratorAccess();
  const { articleTitle, tocEntries, themeColors, activeSectionId, narratorState, narratorActions } =
    useWikiContext();

  const accentColor = wikiAccent(themeColors);
  const visibleToc = tocEntries.filter((e) => e.level <= 3);

  if (!hasNarratorAccess) {
    return (
      <div className="space-y-3 p-3 select-none">
        <HaloViewHeader
          leading={<ShieldAlert className="text-yellow h-4 w-4 shrink-0" />}
          title="Early access feature"
          onClose={onClose}
        />
        <HaloWell className="space-y-3">
          <p className="text-label-secondary text-footnote">
            The WikiOS audio narrator is limited to system owners, administrators and beta testers.
          </p>
          {onSwitchMode && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onSwitchMode("plugin:wiki")}
              className="w-full"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Go to wiki workspace
            </Button>
          )}
        </HaloWell>
      </div>
    );
  }

  const displayPercent =
    narratorState && narratorState.totalBlocks > 0
      ? ((narratorState.activeBlockIndex + 1) / narratorState.totalBlocks) * 100
      : 0;

  return (
    <div className="space-y-3 p-3 select-none">
      {/* Top Header with Quick Action to Switch to Wiki Workspace */}
      <HaloViewHeader
        leading={
          <div
            className="rounded-control flex h-7 w-7 shrink-0 items-center justify-center border"
            style={{
              backgroundColor: accentMix(accentColor, 12),
              borderColor: accentMix(accentColor, 25),
              color: accentColor,
            }}
          >
            <Headphones className="h-3.5 w-3.5" />
          </div>
        }
        title={
          <span className="flex min-w-0 flex-col">
            <span className="text-label-secondary text-footnote font-normal">Now playing</span>
            <span className="truncate">{articleTitle || "Wiki article"}</span>
          </span>
        }
        trailing={
          <>
            {narratorState && narratorState.totalBlocks > 0 && (
              <div className="text-label-secondary bg-fill-4 rounded-control-sm text-footnote flex items-center gap-1 px-2 py-0.5 tabular-nums">
                <span>
                  {narratorState.activeBlockIndex + 1}/{narratorState.totalBlocks}
                </span>
                <span className="text-label font-semibold">({Math.round(displayPercent)}%)</span>
              </div>
            )}
            {onSwitchMode && (
              <Button size="sm" variant="secondary" onClick={() => onSwitchMode("plugin:wiki")}>
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Workspace</span>
              </Button>
            )}
          </>
        }
        onClose={onClose}
      />

      <HaloWell>
        <WikiNarratorPlayer
          visibleToc={visibleToc}
          activeSectionId={activeSectionId}
          themeColors={themeColors}
          narratorState={narratorState}
          narratorActions={narratorActions}
          showHeader={false}
        />
      </HaloWell>
    </div>
  );
}

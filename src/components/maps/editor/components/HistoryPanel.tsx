"use client";

import React from "react";
import {
  ClockRotateRight as History,
  Undo,
  Redo,
  Map,
  MapPin,
  Hexagon,
  Bank as Landmark,
  ModernTv as Mountain,
  SeaWaves as Waves,
  Droplet,
  PathArrow as Route,
  KeyCommand,
} from "iconoir-react";
import type { EditorAction, EditorHistory } from "~/hooks/map-editor/useMapHistory";

interface HistoryPanelProps {
  history: EditorHistory;
  jumpToHistoryPosition: (pos: number) => Promise<void>;
  isMutating?: boolean;
}

function getFeatureIcon(type: string) {
  switch (type) {
    case "city":
      return MapPin;
    case "subdivision":
      return Hexagon;
    case "poi":
    case "storyPin":
      return Landmark;
    case "peak":
      return Mountain;
    case "river":
      return Waves;
    case "lake":
      return Droplet;
    case "route":
      return Route;
    default:
      return Map;
  }
}

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

export const HistoryPanel = React.memo(function HistoryPanel({
  history,
  jumpToHistoryPosition,
  isMutating = false,
}: HistoryPanelProps) {
  const { actions, position } = history;

  const handleItemClick = async (idx: number) => {
    if (isMutating || idx === position) return;
    await jumpToHistoryPosition(idx);
  };

  const getActionTitle = (action: EditorAction): string => {
    if (action.description) return action.description;
    const verb =
      action.type === "create" ? "Create" : action.type === "delete" ? "Delete" : "Update";
    let typeLabel: string = action.featureType;
    if (typeLabel === "mapLabel") typeLabel = "label";
    if (typeLabel === "storyPin") typeLabel = "story";
    typeLabel = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);

    const name = (action.newData?.name ||
      action.previousData?.name ||
      action.newData?.title ||
      action.previousData?.title ||
      "") as string;
    const nameStr = name ? ` "${name}"` : "";
    return `${verb} ${typeLabel}${nameStr}`;
  };

  return (
    <div className="bg-card text-foreground flex h-full flex-col select-none">
      {/* Header Info */}
      <div className="border-border/60 flex items-center justify-between border-b px-3 py-2 text-xs">
        <div className="text-muted-foreground flex items-center gap-1.5 font-medium">
          <History className="h-3.5 w-3.5" />
          <span>Timeline</span>
          <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.2 text-[10px] tabular-nums font-semibold">
            {actions.length}
          </span>
        </div>
        {isMutating && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <div className="border-muted-foreground/20 border-t-primary h-3 w-3 animate-spin rounded-full border-2" />
            <span>Syncing…</span>
          </div>
        )}
      </div>

      {/* Action list with connecting track */}
      <div className="relative min-h-0 flex-1 scrollbar-thin overflow-y-auto px-2 py-2">
        {/* Continuous vertical track */}
        {actions.length > 0 && (
          <div className="bg-border/60 absolute left-[21px] top-4 bottom-4 w-px pointer-events-none" />
        )}

        <div className="space-y-1">
          {/* Initial State item */}
          <button
            onClick={() => handleItemClick(-1)}
            disabled={isMutating}
            className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition-all active:scale-[0.98] ${
              position === -1
                ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/30"
                : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            }`}
          >
            <div
              className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] transition-colors ${
                position === -1
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground group-hover:bg-accent"
              }`}
            >
              <Map className="h-3 w-3" />
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-between">
              <span className="truncate">Initial State</span>
              {position === -1 && (
                <span className="bg-primary/20 text-primary rounded px-1 py-0.2 text-[9px] font-medium tracking-wide uppercase">
                  Current
                </span>
              )}
            </div>
          </button>

          {actions.map((action, idx) => {
            const isActive = idx <= position;
            const isCurrent = idx === position;
            const Icon = getFeatureIcon(action.featureType);
            const timeStr = formatRelativeTime(action.timestamp);

            return (
              <button
                key={`${action.featureId}-${idx}`}
                onClick={() => handleItemClick(idx)}
                disabled={isMutating}
                className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition-all active:scale-[0.98] ${
                  isCurrent
                    ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/30"
                    : isActive
                      ? "text-foreground hover:bg-accent/40"
                      : "text-muted-foreground/50 hover:bg-accent/20 hover:text-muted-foreground"
                }`}
              >
                <div
                  className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] transition-colors ${
                    isCurrent
                      ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30"
                      : isActive
                        ? "bg-primary/20 text-primary"
                        : "bg-muted/60 text-muted-foreground/50"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-[11px] leading-tight">
                      {getActionTitle(action)}
                    </span>
                    {isCurrent && (
                      <span className="bg-primary/20 text-primary shrink-0 rounded px-1 py-0.2 text-[9px] font-medium tracking-wide uppercase">
                        Current
                      </span>
                    )}
                  </div>
                  {timeStr && (
                    <span className="text-muted-foreground/60 text-[9px] font-mono tabular-nums">
                      {timeStr}
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {actions.length === 0 && (
            <div className="text-muted-foreground/60 flex h-40 flex-col items-center justify-center gap-2 text-center text-xs">
              <div className="bg-muted/40 rounded-full p-2.5">
                <History className="h-5 w-5 stroke-1" />
              </div>
              <div className="space-y-0.5">
                <p className="font-medium text-foreground/80">No actions recorded</p>
                <p className="text-[11px]">Creations, edits, and deletions will appear here</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer shortcut hints */}
      <div className="border-border/40 bg-muted/20 text-muted-foreground flex items-center justify-between border-t px-3 py-2 text-[10px]">
        <div className="flex items-center gap-1">
          <KeyCommand className="h-3 w-3 opacity-70" />
          <span>⌘Z to Undo</span>
        </div>
        <span>⇧⌘Z to Redo</span>
      </div>
    </div>
  );
});

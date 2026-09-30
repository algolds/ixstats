"use client";

import { Badge } from "~/components/ui/badge";
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
import { timeAgo } from "~/lib/format/compact";

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
          <span className="bg-muted text-muted-foreground py-0.2 rounded-full px-1.5 text-xs font-semibold tabular-nums">
            {actions.length}
          </span>
        </div>
        {isMutating && (
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            <div className="border-muted-foreground/20 border-t-primary h-3 w-3 animate-spin rounded-full border-2" />
            <span>Syncing…</span>
          </div>
        )}
      </div>

      {/* Action list with connecting track */}
      <div className="relative min-h-0 flex-1 scrollbar-thin overflow-y-auto px-2 py-2">
        {/* Continuous vertical track */}
        {actions.length > 0 && (
          <div className="bg-border/60 pointer-events-none absolute top-4 bottom-4 left-[21px] w-px" />
        )}

        <div className="space-y-1">
          {/* Initial State item */}
          <button
            onClick={() => handleItemClick(-1)}
            disabled={isMutating}
            className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98] ${
              position === -1
                ? "bg-primary/10 text-primary ring-primary/30 font-semibold ring-1"
                : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            }`}
          >
            <div
              className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs transition-colors ${
                position === -1
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground group-hover:bg-accent"
              }`}
            >
              <Map className="h-3 w-3" />
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-between">
              <span className="truncate">Initial State</span>
              {position === -1 && <Badge variant="secondary">Current</Badge>}
            </div>
          </button>

          {actions.map((action, idx) => {
            const isActive = idx <= position;
            const isCurrent = idx === position;
            const Icon = getFeatureIcon(action.featureType);
            const timeStr = timeAgo(action.timestamp);

            return (
              <button
                key={`${action.featureId}-${idx}`}
                onClick={() => handleItemClick(idx)}
                disabled={isMutating}
                className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98] ${
                  isCurrent
                    ? "bg-primary/10 text-primary ring-primary/30 font-semibold ring-1"
                    : isActive
                      ? "text-foreground hover:bg-accent/40"
                      : "text-muted-foreground/50 hover:bg-accent/20 hover:text-muted-foreground"
                }`}
              >
                <div
                  className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs transition-colors ${
                    isCurrent
                      ? "bg-primary text-primary-foreground ring-primary/30 shadow-sm ring-2"
                      : isActive
                        ? "bg-primary/20 text-primary"
                        : "bg-muted/60 text-muted-foreground/50"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-xs leading-tight">{getActionTitle(action)}</span>
                    {isCurrent && (
                      <Badge variant="secondary" className="shrink-0">
                        Current
                      </Badge>
                    )}
                  </div>
                  {timeStr && (
                    <span className="text-muted-foreground font-mono text-xs tabular-nums">
                      {timeStr}
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {actions.length === 0 && (
            <div className="text-muted-foreground flex h-40 flex-col items-center justify-center gap-2 text-center text-xs">
              <div className="bg-muted/40 rounded-full p-2.5">
                <History className="h-5 w-5 stroke-1" />
              </div>
              <div className="space-y-0.5">
                <p className="text-foreground/80 font-medium">No actions recorded</p>
                <p className="text-xs">Creations, edits, and deletions will appear here</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer shortcut hints */}
      <div className="border-border/40 bg-muted/20 text-muted-foreground flex items-center justify-between border-t px-3 py-2 text-xs">
        <div className="flex items-center gap-1">
          <KeyCommand className="h-3 w-3 opacity-70" />
          <span>⌘Z to Undo</span>
        </div>
        <span>⇧⌘Z to Redo</span>
      </div>
    </div>
  );
});

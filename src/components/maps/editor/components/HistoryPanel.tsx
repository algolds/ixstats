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
    <div className="bg-surface text-label flex h-full flex-col select-none">
      {/* Header Info */}
      <div className="border-separator text-footnote flex items-center justify-between border-b px-3 py-2">
        <div className="text-label-secondary flex items-center gap-2 font-medium">
          <History className="h-3.5 w-3.5" />
          <span>Timeline</span>
          <span className="bg-fill-3 text-label-secondary py-0.2 text-caption rounded-full px-2 font-semibold tabular-nums">
            {actions.length}
          </span>
        </div>
        {isMutating && (
          <div className="text-label-secondary text-footnote flex items-center gap-1">
            <div className="border-separator border-t-primary h-3 w-3 animate-spin rounded-full border-2" />
            <span>Syncing…</span>
          </div>
        )}
      </div>

      {/* Action list with connecting track */}
      <div className="relative min-h-0 flex-1 scrollbar-thin overflow-y-auto px-2 py-2">
        {/* Continuous vertical track */}
        {actions.length > 0 && (
          <div className="bg-separator pointer-events-none absolute top-4 bottom-4 left-[21px] w-px" />
        )}

        <div className="space-y-1">
          {/* Initial State item */}
          <button
            type="button"
            onClick={() => handleItemClick(-1)}
            disabled={isMutating}
            aria-current={position === -1 ? "step" : undefined}
            className={`group rounded-control text-caption relative flex w-full items-center gap-2 px-2 py-2 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98] ${
              position === -1
                ? "bg-tint-fill text-tint ring-tint/30 font-semibold ring-1"
                : "text-label-secondary hover:bg-fill-3 hover:text-label"
            }`}
          >
            <div
              className={`text-footnote relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                position === -1
                  ? "bg-tint text-on-tint shadow-card"
                  : "bg-fill-3 text-label-secondary group-hover:bg-fill-3"
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
                type="button"
                onClick={() => handleItemClick(idx)}
                disabled={isMutating}
                aria-current={isCurrent ? "step" : undefined}
                className={`group rounded-control text-caption relative flex w-full items-center gap-2 px-2 py-2 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98] ${
                  isCurrent
                    ? "bg-tint-fill text-tint ring-tint/30 font-semibold ring-1"
                    : isActive
                      ? "text-label hover:bg-fill-3"
                      : "text-label-tertiary hover:bg-fill-4 hover:text-label-secondary"
                }`}
              >
                <div
                  className={`text-footnote relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                    isCurrent
                      ? "bg-tint text-on-tint ring-tint/30 shadow-card ring-2"
                      : isActive
                        ? "bg-tint-fill text-tint"
                        : "bg-fill-3 text-label-tertiary"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-footnote truncate leading-tight">
                      {getActionTitle(action)}
                    </span>
                    {isCurrent && (
                      <Badge variant="secondary" className="shrink-0">
                        Current
                      </Badge>
                    )}
                  </div>
                  {timeStr && (
                    <span className="text-label-secondary text-footnote tabular-nums">
                      {timeStr}
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {actions.length === 0 && (
            <div className="text-label-secondary text-footnote flex h-40 flex-col items-center justify-center gap-2 text-center">
              <div className="bg-fill-3 rounded-full p-2">
                <History className="h-5 w-5 stroke-1" />
              </div>
              <div className="space-y-0.5">
                <p className="text-label-secondary font-medium">No actions recorded</p>
                <p className="text-footnote">Creations, edits, and deletions will appear here</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer shortcut hints */}
      <div className="border-separator bg-fill-4 text-label-secondary text-footnote flex items-center justify-between border-t px-3 py-2">
        <div className="flex items-center gap-1">
          <KeyCommand className="h-3 w-3 opacity-70" />
          <span>⌘Z to Undo</span>
        </div>
        <span>⇧⌘Z to Redo</span>
      </div>
    </div>
  );
});

"use client";

import React from "react";
import { ClockRotateRight as History, Undo, Redo, Map } from "iconoir-react";

interface EditorAction {
  type: "create" | "delete" | "update";
  featureType: string;
  featureId: string;
  previousData?: Record<string, any>;
  newData?: Record<string, any>;
}

interface HistoryPanelProps {
  history: {
    actions: EditorAction[];
    position: number;
  };
  jumpToHistoryPosition: (pos: number) => Promise<void>;
  isMutating?: boolean;
}

export function HistoryPanel({
  history,
  jumpToHistoryPosition,
  isMutating = false,
}: HistoryPanelProps) {
  const { actions, position } = history;

  const handleItemClick = async (idx: number) => {
    if (isMutating || idx === position) return;
    await jumpToHistoryPosition(idx);
  };

  const getActionDescription = (action: EditorAction): string => {
    const verb =
      action.type === "create" ? "Create" : action.type === "delete" ? "Delete" : "Update";
    let typeLabel = action.featureType;
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
    <div className="bg-card text-foreground flex h-full flex-col">
      {/* Header Info */}
      <div className="border-border flex items-center justify-between border-b px-3 py-2 text-xs">
        <div className="text-muted-foreground flex items-center gap-1.5 font-medium">
          <History className="h-3.5 w-3.5" />
          <span>Timeline ({actions.length} actions)</span>
        </div>
        {isMutating && (
          <div className="border-muted-foreground/20 border-t-primary h-3.5 w-3.5 animate-spin rounded-full border-2" />
        )}
      </div>

      {/* Action list */}
      <div className="min-h-0 flex-1 scrollbar-thin space-y-0.5 overflow-y-auto p-1.5">
        {/* Initial State item */}
        <button
          onClick={() => handleItemClick(-1)}
          disabled={isMutating}
          className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] transition-colors ${
            position === -1
              ? "bg-primary/10 text-primary border-primary border-l-2 font-semibold"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          }`}
        >
          <Map className="h-3.5 w-3.5 shrink-0" />
          <span>Initial State</span>
        </button>

        {actions.map((action, idx) => {
          const isActive = idx <= position;
          const isCurrent = idx === position;

          return (
            <button
              key={idx}
              onClick={() => handleItemClick(idx)}
              disabled={isMutating}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] transition-all ${
                isCurrent
                  ? "bg-primary/10 text-primary border-primary border-l-2 font-semibold"
                  : isActive
                    ? "text-foreground hover:bg-accent/50"
                    : "text-muted-foreground/50 hover:bg-accent/30 hover:text-muted-foreground"
              }`}
            >
              {isActive ? (
                <Undo className="text-primary/70 h-3.5 w-3.5 shrink-0" />
              ) : (
                <Redo className="text-muted-foreground/30 h-3.5 w-3.5 shrink-0" />
              )}
              <span className="truncate">{getActionDescription(action)}</span>
            </button>
          );
        })}

        {actions.length === 0 && (
          <div className="text-muted-foreground/60 flex h-32 flex-col items-center justify-center gap-1.5 text-center text-xs">
            <History className="h-6 w-6 stroke-1" />
            <span>No actions recorded yet</span>
          </div>
        )}
      </div>
    </div>
  );
}

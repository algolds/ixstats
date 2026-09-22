"use client";

import React, { useState } from "react";
import {
  Eye,
  Copy,
  Trash,
  Crown,
  SeaWaves as Waves,
  RefreshDouble as Reverse,
  Magnet,
  Maximize,
} from "iconoir-react";
import type { EditorFeature } from "~/hooks/useMapEditor";

interface GeometryActionsBarProps {
  feature: EditorFeature;
  onCenter?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onPromoteCapital?: () => void;
  onSnapCoastline?: () => void;
  onReverseRoute?: () => void;
  onPathfinderOperation?: (op: "union" | "subtract" | "intersect") => void;
  disabled?: boolean;
}

export const GeometryActionsBar = React.memo(function GeometryActionsBar({
  feature,
  onCenter,
  onDuplicate,
  onDelete,
  onPromoteCapital,
  onSnapCoastline,
  onReverseRoute,
  onPathfinderOperation,
  disabled = false,
}: GeometryActionsBarProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isCity = feature.type === "city";
  const isRegion = feature.type === "subdivision";
  const isRoute = feature.type === "route";
  const isCapital = isCity && (feature.properties?.isNationalCapital === true);

  return (
    <div className="space-y-2 select-none">
      <div className="grid grid-cols-2 gap-1.5">
        {/* Center on Map */}
        {onCenter && (
          <button
            type="button"
            onClick={onCenter}
            disabled={disabled}
            className="border-border/60 bg-card/60 hover:bg-accent/40 text-foreground flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Eye className="h-3.5 w-3.5 text-primary" />
            <span>Center on map</span>
          </button>
        )}

        {/* Duplicate Feature */}
        {onDuplicate && (
          <button
            type="button"
            onClick={onDuplicate}
            disabled={disabled}
            className="border-border/60 bg-card/60 hover:bg-accent/40 text-foreground flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5 opacity-70" />
            <span>Duplicate</span>
          </button>
        )}

        {/* City: Promote to Capital */}
        {isCity && onPromoteCapital && !isCapital && (
          <button
            type="button"
            onClick={onPromoteCapital}
            disabled={disabled}
            className="border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Crown className="h-3.5 w-3.5" />
            <span>Make Capital</span>
          </button>
        )}

        {/* City: Snap to Coastline */}
        {isCity && onSnapCoastline && (
          <button
            type="button"
            onClick={onSnapCoastline}
            disabled={disabled}
            className="border-border/60 bg-card/60 hover:bg-accent/40 text-foreground flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Waves className="h-3.5 w-3.5 text-cyan-500" />
            <span>Snap Coast</span>
          </button>
        )}

        {/* Route: Reverse Direction */}
        {isRoute && onReverseRoute && (
          <button
            type="button"
            onClick={onReverseRoute}
            disabled={disabled}
            className="border-border/60 bg-card/60 hover:bg-accent/40 text-foreground flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Reverse className="h-3.5 w-3.5 text-blue-500" />
            <span>Reverse</span>
          </button>
        )}

        {/* Delete button (with 2-click confirmation) */}
        {onDelete && (
          <div className={confirmDelete ? "col-span-2" : "col-span-1"}>
            {confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onDelete();
                    setConfirmDelete(false);
                  }}
                  disabled={disabled}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold shadow-sm transition-all active:scale-[0.98]"
                >
                  <Trash className="h-3.5 w-3.5" />
                  <span>Confirm Delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="border-border/60 bg-muted/40 hover:bg-muted text-foreground rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={disabled}
                className="border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive flex w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <Trash className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Region Pathfinder Operations */}
      {isRegion && onPathfinderOperation && (
        <div className="border-border/40 bg-muted/20 space-y-1.5 rounded-lg border p-2">
          <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
            Combine regions
          </span>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => onPathfinderOperation("union")}
              disabled={disabled}
              className="bg-card/60 hover:bg-accent/40 border-border/40 text-foreground rounded border py-1 text-center text-[11px] font-medium transition-all active:scale-[0.98]"
            >
              Union
            </button>
            <button
              type="button"
              onClick={() => onPathfinderOperation("subtract")}
              disabled={disabled}
              className="bg-card/60 hover:bg-accent/40 border-border/40 text-foreground rounded border py-1 text-center text-[11px] font-medium transition-all active:scale-[0.98]"
            >
              Subtract
            </button>
            <button
              type="button"
              onClick={() => onPathfinderOperation("intersect")}
              disabled={disabled}
              className="bg-card/60 hover:bg-accent/40 border-border/40 text-foreground rounded border py-1 text-center text-[11px] font-medium transition-all active:scale-[0.98]"
            >
              Intersect
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

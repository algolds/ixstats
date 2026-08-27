"use client";

import React, { memo } from "react";
import {
  Check,
  Undo as Undo2,
  Trash as Trash2,
  MapPin,
  SystemRestart as Loader2,
} from "iconoir-react";
import { ROUTE_STYLES, ROUTE_TYPE_KEYS } from "~/lib/maps/map-config";

interface RouteWaypointListProps {
  routeWaypoints: [number, number][];
  routeName: string;
  setRouteName: (name: string) => void;
  manualRouteType: string;
  setManualRouteType: (type: string) => void;
  isSavingManual: boolean;
  manualError: string | null;
  onFinishRoute?: (routeType?: string, name?: string) => Promise<void>;
  onUndoWaypoint?: () => void;
  onClearWaypoints?: () => void;
}

export const RouteWaypointList = memo(function RouteWaypointList({
  routeWaypoints,
  routeName,
  setRouteName,
  manualRouteType,
  setManualRouteType,
  isSavingManual,
  manualError,
  onFinishRoute,
  onUndoWaypoint,
  onClearWaypoints,
}: RouteWaypointListProps) {
  const waypointCount = routeWaypoints.length;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Route Name & Properties
        </label>
        <input
          type="text"
          placeholder="e.g. Trans-National Highway 1"
          value={routeName}
          onChange={(e) => setRouteName(e.target.value)}
          className="border-border/40 bg-background/50 text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-md border px-3 py-1.5 text-xs focus:outline-none"
        />

        <label className="text-muted-foreground block pt-1 text-[11px] font-semibold tracking-wider uppercase">
          Route Type
        </label>
        <select
          value={manualRouteType}
          onChange={(e) => setManualRouteType(e.target.value)}
          className="border-border/40 bg-background/50 text-foreground focus:border-primary w-full rounded-md border px-2 py-1.5 text-xs focus:outline-none"
        >
          {ROUTE_TYPE_KEYS.map((key) => (
            <option key={key} value={key}>
              {(ROUTE_STYLES as any)[key]?.label ?? key}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Waypoints ({waypointCount})
          </span>
          <div className="flex items-center gap-1.5">
            {onUndoWaypoint && waypointCount > 0 && (
              <button
                type="button"
                onClick={onUndoWaypoint}
                className="text-muted-foreground hover:bg-muted flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
                title="Undo last waypoint"
              >
                <Undo2 className="h-3 w-3" /> Undo
              </button>
            )}
            {onClearWaypoints && waypointCount > 0 && (
              <button
                type="button"
                onClick={onClearWaypoints}
                className="text-destructive hover:bg-destructive/10 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
                title="Clear all waypoints"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        </div>

        {waypointCount === 0 ? (
          <div className="border-border/60 text-muted-foreground rounded-md border border-dashed p-4 text-center text-xs">
            Click on the map or snap to settlements to place path nodes.
          </div>
        ) : (
          <div className="border-border/30 bg-muted/10 max-h-48 space-y-1 overflow-y-auto rounded-md border p-1.5">
            {routeWaypoints.map((pt, idx) => (
              <div
                key={idx}
                className="bg-background/40 flex items-center justify-between rounded px-2 py-1 text-[11px]"
              >
                <div className="flex items-center gap-1.5">
                  <MapPin className="text-primary h-3 w-3 shrink-0" />
                  <span className="text-muted-foreground font-mono">#{idx + 1}</span>
                </div>
                <span className="text-muted-foreground font-mono text-[10px]">
                  {pt[0].toFixed(4)}°, {pt[1].toFixed(4)}°
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {manualError && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-2 text-[11px]">
          {manualError}
        </div>
      )}

      {onFinishRoute && (
        <button
          type="button"
          disabled={waypointCount < 2 || isSavingManual}
          onClick={() => onFinishRoute(manualRouteType, routeName)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50"
        >
          {isSavingManual ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Saving Transit Corridor...</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Commit Route ({waypointCount} points)</span>
            </>
          )}
        </button>
      )}
    </div>
  );
});

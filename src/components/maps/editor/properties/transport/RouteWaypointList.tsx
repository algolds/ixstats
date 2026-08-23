"use client";

import React, { memo } from "react";
import { Check, Undo as Undo2, Trash as Trash2, MapPin, SystemRestart as Loader2 } from "iconoir-react";
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
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Route Name & Properties
        </label>
        <input
          type="text"
          placeholder="e.g. Trans-National Highway 1"
          value={routeName}
          onChange={(e) => setRouteName(e.target.value)}
          className="w-full rounded-md border border-border/40 bg-background/50 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />

        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block pt-1">
          Route Type
        </label>
        <select
          value={manualRouteType}
          onChange={(e) => setManualRouteType(e.target.value)}
          className="w-full rounded-md border border-border/40 bg-background/50 px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
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
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Waypoints ({waypointCount})
          </span>
          <div className="flex items-center gap-1.5">
            {onUndoWaypoint && waypointCount > 0 && (
              <button
                type="button"
                onClick={onUndoWaypoint}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                title="Undo last waypoint"
              >
                <Undo2 className="h-3 w-3" /> Undo
              </button>
            )}
            {onClearWaypoints && waypointCount > 0 && (
              <button
                type="button"
                onClick={onClearWaypoints}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-destructive hover:bg-destructive/10"
                title="Clear all waypoints"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        </div>

        {waypointCount === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
            Click on the map or snap to settlements to place path nodes.
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border border-border/30 p-1.5 bg-muted/10">
            {routeWaypoints.map((pt, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-background/40"
              >
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-primary shrink-0" />
                  <span className="font-mono text-muted-foreground">#{idx + 1}</span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {pt[0].toFixed(4)}°, {pt[1].toFixed(4)}°
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {manualError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">
          {manualError}
        </div>
      )}

      {onFinishRoute && (
        <button
          type="button"
          disabled={waypointCount < 2 || isSavingManual}
          onClick={() => onFinishRoute(manualRouteType, routeName)}
          className="w-full flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50"
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

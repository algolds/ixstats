"use client";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { memo, useMemo } from "react";
import {
  Check,
  Undo as Undo2,
  Trash as Trash2,
  MapPin,
  SystemRestart as Loader2,
} from "iconoir-react";
import { ROUTE_STYLES, ROUTE_TYPE_KEYS } from "~/lib/maps/map-config";
import { polylineLengthKm } from "~/lib/maps/geo-math";
import { calculateRouteTravelTime } from "~/lib/economy/travel-time";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { Card } from "~/components/ui/card";

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

  const liveLengthKm = useMemo(() => {
    if (routeWaypoints.length < 2) return 0;
    return polylineLengthKm(routeWaypoints);
  }, [routeWaypoints]);

  const liveDuration = useMemo(() => {
    if (liveLengthKm <= 0) return null;
    return calculateRouteTravelTime({
      lengthKm: liveLengthKm,
      routeType: manualRouteType,
      stopsCount: waypointCount,
    }).formattedTime;
  }, [liveLengthKm, manualRouteType, waypointCount]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Eyebrow className="block">Route Name & Properties</Eyebrow>
        <input
          type="text"
          placeholder="e.g. Trans-National Highway 1"
          value={routeName}
          onChange={(e) => setRouteName(e.target.value)}
          className="border-separator bg-surface text-label placeholder:text-label-secondary focus:border-tint rounded-control-sm text-footnote w-full border px-3 py-2 focus:outline-none"
        />

        <Eyebrow className="block pt-1">Route Type</Eyebrow>
        <OptionSelect
          aria-label="Route type"
          value={manualRouteType}
          onValueChange={(v) => setManualRouteType(v)}
          options={ROUTE_TYPE_KEYS.map((key) => ({
            value: key,
            label: ROUTE_STYLES[key]?.label ?? key,
          }))}
          size="sm"
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eyebrow>Waypoints ({waypointCount})</Eyebrow>
            {waypointCount >= 2 && (
              <div className="flex items-center gap-1">
                <span className="border-separator bg-fill-3 text-label text-footnote rounded-control-sm border px-2 py-0.5 tabular-nums">
                  {liveLengthKm.toFixed(1)} km
                </span>
                {liveDuration && (
                  <span className="border-tint/20 bg-tint-fill text-tint text-caption rounded-control-sm border px-2 py-0.5 tabular-nums">
                    ~{liveDuration}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onUndoWaypoint && waypointCount > 0 && (
              <Button
                variant="ghost"
                size="xs"
                className="text-label-secondary"
                type="button"
                onClick={onUndoWaypoint}
                title="Undo last waypoint"
              >
                <Undo2 className="h-3 w-3" /> Undo
              </Button>
            )}
            {onClearWaypoints && waypointCount > 0 && (
              <Button
                variant="ghost"
                size="xs"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                type="button"
                onClick={onClearWaypoints}
                title="Clear all waypoints"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </Button>
            )}
          </div>
        </div>

        {waypointCount === 0 ? (
          <div className="border-separator text-label-secondary rounded-control-sm text-footnote border border-dashed p-4 text-center">
            Click on the map or snap to settlements to place path nodes.
          </div>
        ) : (
          <Card className="max-h-48 space-y-1 overflow-y-auto p-2">
            {routeWaypoints.map((pt, idx) => (
              <div
                key={idx}
                className="bg-surface text-footnote rounded-control-sm flex items-center justify-between px-2 py-1"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="text-tint h-3 w-3 shrink-0" />
                  <span className="text-label-secondary font-mono tabular-nums">#{idx + 1}</span>
                </div>
                <span className="text-label-secondary text-footnote font-mono tabular-nums">
                  {pt[0].toFixed(4)}°, {pt[1].toFixed(4)}°
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>

      {manualError && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-control-sm text-footnote border p-2">
          {manualError}
        </div>
      )}

      {onFinishRoute && (
        <Button
          size="sm"
          className="w-full justify-center"
          type="button"
          disabled={waypointCount < 2 || isSavingManual}
          onClick={() => onFinishRoute(manualRouteType, routeName)}
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
        </Button>
      )}
    </div>
  );
});

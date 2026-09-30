import React, { useMemo } from "react";
import type { EditorMode, EditorFeature } from "~/hooks/useMapEditor";
import { calculateRouteTravelTime, type LngLat } from "~/lib/economy/travel-time";
import { polylineLengthKm } from "~/lib/maps/geo-math";

interface RouteEditingToolbarProps {
  mode: EditorMode;
  onRouteEditCommit?: () => void;
  onRouteEditCancel?: () => void;
  /** Waypoints of the route being drawn (add-route mode). */
  routeWaypoints?: LngLat[];
  /** Route type picked for the route being drawn. */
  drawRouteType?: string;
  /** Vertices of the route being edited (edit-route mode). */
  editingRouteVertices?: LngLat[];
  /** The route being edited; supplies its type and speed. */
  editingRoute?: EditorFeature | null;
}

interface RouteEstimate {
  time: string;
  detail: string;
}

function editingRouteType(route?: EditorFeature | null): string | null {
  const value = route?.properties.routeType;
  return typeof value === "string" ? value : null;
}

function editingRouteSpeed(route?: EditorFeature | null): number | null {
  const value = Number(route?.properties.speedKmh);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Live length and travel-time estimate; sea routes include currents and prevailing winds. */
function estimateRoute(
  vertices: LngLat[] | undefined,
  routeType: string | null | undefined,
  speedKmh: number | null
): RouteEstimate | null {
  if (!vertices || vertices.length < 2) return null;
  const lengthKm = polylineLengthKm(vertices);
  const result = calculateRouteTravelTime({ lengthKm, routeType, speedKmh, seaPath: vertices });
  const parts = [`${Math.round(lengthKm).toLocaleString()} km`];
  if (result.sea) parts.push(`${result.sea.averageSpeedKmh.toFixed(1)} km/h avg`);
  return { time: result.formattedTime, detail: parts.join(" · ") };
}

function EstimateText({ estimate }: { estimate: RouteEstimate }) {
  return (
    <span
      className="text-foreground px-2 font-mono text-xs whitespace-nowrap tabular-nums"
      aria-live="polite"
    >
      ≈ {estimate.time}
      <span className="text-muted-foreground hidden sm:inline"> · {estimate.detail}</span>
    </span>
  );
}

export function RouteEditingToolbar({
  mode,
  onRouteEditCommit,
  onRouteEditCancel,
  routeWaypoints,
  drawRouteType,
  editingRouteVertices,
  editingRoute,
}: RouteEditingToolbarProps) {
  const estimate = useMemo(() => {
    if (mode === "add-route") return estimateRoute(routeWaypoints, drawRouteType, null);
    if (mode === "edit-route") {
      return estimateRoute(
        editingRouteVertices,
        editingRouteType(editingRoute),
        editingRouteSpeed(editingRoute)
      );
    }
    return null;
  }, [mode, routeWaypoints, drawRouteType, editingRouteVertices, editingRoute]);

  if (mode === "add-route") {
    if (!estimate) return null;
    return (
      <div className="bg-card/95 ring-border absolute bottom-12 left-1/2 z-10 -translate-x-1/2 rounded-full py-1 shadow-md ring-1 backdrop-blur-sm">
        <EstimateText estimate={estimate} />
      </div>
    );
  }

  if (mode !== "edit-route") return null;

  return (
    <div className="border-border bg-card/90 ring-border/50 absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border p-1.5 shadow-xl ring-1 backdrop-blur-md transition-[color,background-color,border-color,box-shadow,opacity,transform]">
      <span className="text-muted-foreground hidden px-2.5 text-xs font-medium sm:inline">
        Drag route vertices · Midpoints to add · Right-click to remove
      </span>
      <div className="bg-border hidden h-4 w-px sm:block" />
      {estimate && (
        <>
          <EstimateText estimate={estimate} />
          <div className="bg-border h-4 w-px" />
        </>
      )}
      <button
        onClick={onRouteEditCommit}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
      >
        Save Route Path
      </button>
      <button
        onClick={onRouteEditCancel}
        className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-full px-3 py-1.5 text-xs font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
      >
        Cancel
      </button>
    </div>
  );
}

"use client";

import React, { memo, useState, useEffect, useMemo, useCallback } from "react";
import {
  NavArrowLeft as ArrowLeft,
  Check,
  Trash as Trash2,
  RefreshDouble as Reverse,
  Eye,
  SystemRestart as Loader2,
  MapPin,
  PathArrow as RouteIcon,
  Clock,
  Dashboard as Gauge,
} from "iconoir-react";
import { ROUTE_STYLES, ROUTE_TYPE_KEYS } from "~/lib/maps/map-config";
import { polylineLengthKm } from "~/lib/maps/geo-math";
import { api } from "~/trpc/react";
import { calculateRouteTravelTime, resolveRouteBaseSpeed } from "~/lib/economy/travel-time";

interface RouteNodeInspectorProps {
  routeId: string;
  countryId?: string;
  editingRouteVertices?: [number, number][];
  onRouteVerticesUpdate?: (vertices: [number, number][]) => void;
  onCommit?: () => Promise<void> | void;
  onCancel: () => void;
  onDeleteRoute?: (id: string) => void;
  onFlyToCoords?: (coord: [number, number]) => void;
}

export const RouteNodeInspector = memo(function RouteNodeInspector({
  routeId,
  countryId,
  editingRouteVertices,
  onRouteVerticesUpdate,
  onCommit,
  onCancel,
  onDeleteRoute,
  onFlyToCoords,
}: RouteNodeInspectorProps) {
  const utils = api.useUtils();

  const { data: route, isLoading } = api.transport.getRouteById.useQuery(
    { id: routeId },
    { staleTime: 30_000 }
  );

  const [name, setName] = useState("");
  const [routeType, setRouteType] = useState<string>("road");
  const [status, setStatus] = useState<"planned" | "under_construction" | "operational" | "abandoned">("operational");
  const [isInternational, setIsInternational] = useState(false);
  const [speedKmh, setSpeedKmh] = useState<number | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state with fetched route
  useEffect(() => {
    if (route) {
      setName(route.name ?? "");
      setRouteType(route.routeType ?? "road");
      setStatus((route.status as typeof status) ?? "operational");
      setIsInternational(Boolean(route.isInternational));
      const initSpeed =
        (route as { speedKmh?: number | null }).speedKmh ??
        (route.properties as { speed_kmh?: number } | null)?.speed_kmh;
      setSpeedKmh(typeof initSpeed === "number" ? initSpeed : undefined);
    }
  }, [route]);

  const updateRouteMutation = api.transport.updateRoute.useMutation({
    onSuccess: () => {
      void utils.transport.getRouteById.invalidate({ id: routeId });
      void utils.transport.getCountryRoutes.invalidate();
      void utils.transport.getAllRoutesGeoJSON.invalidate();
      void utils.transport.getTransportStats.invalidate();
    },
  });

  const updateRouteGeometryMutation = api.transport.updateRouteGeometry.useMutation({
    onSuccess: () => {
      void utils.transport.getRouteById.invalidate({ id: routeId });
      void utils.transport.getCountryRoutes.invalidate();
      void utils.transport.getAllRoutesGeoJSON.invalidate();
    },
  });

  // Resolve current active vertices
  const currentVertices: [number, number][] = useMemo(() => {
    if (editingRouteVertices && editingRouteVertices.length > 0) {
      return editingRouteVertices;
    }
    if (route?.geometry) {
      const geo = route.geometry as { type?: string; coordinates?: [number, number][] | [number, number][][] };
      if (geo.type === "LineString" && Array.isArray(geo.coordinates)) {
        return geo.coordinates as [number, number][];
      }
      if (geo.type === "MultiLineString" && Array.isArray(geo.coordinates)) {
        return (geo.coordinates as [number, number][][]).flat();
      }
    }
    return [];
  }, [editingRouteVertices, route?.geometry]);

  const liveLengthKm = useMemo(() => {
    if (currentVertices.length < 2) return 0;
    return polylineLengthKm(currentVertices);
  }, [currentVertices]);

  const baseSpeed = useMemo(() => {
    return resolveRouteBaseSpeed({
      speedKmh,
      properties: route?.properties as Record<string, unknown> | null,
      routeType,
    });
  }, [speedKmh, route?.properties, routeType]);

  const travelTime = useMemo(() => {
    return calculateRouteTravelTime({
      lengthKm: liveLengthKm,
      speedKmh: baseSpeed,
      routeType,
      terrainDifficulty: route?.terrainDifficulty,
      stopsCount: currentVertices.length,
    });
  }, [liveLengthKm, baseSpeed, routeType, route?.terrainDifficulty, currentVertices.length]);

  // Handle Save
  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);

      // Save geometry if edit hook provides commit
      if (onCommit) {
        await onCommit();
      }

      // Save metadata properties
      const targetCountryId = route?.countryId ?? countryId;
      if (targetCountryId) {
        await updateRouteMutation.mutateAsync({
          id: routeId,
          countryId: targetCountryId,
          name: name.trim() || undefined,
          routeType,
          status,
          isInternational,
          speedKmh: speedKmh != null && !isNaN(speedKmh) && speedKmh > 0 ? speedKmh : undefined,
        });
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save route");
    } finally {
      setIsSaving(false);
    }
  }, [onCommit, route?.countryId, countryId, updateRouteMutation, routeId, name, routeType, status, isInternational, speedKmh]);

  // Handle Reverse
  const handleReverse = useCallback(async () => {
    if (currentVertices.length < 2) return;
    const reversed = [...currentVertices].reverse();
    onRouteVerticesUpdate?.(reversed);
    const targetCountryId = route?.countryId ?? countryId;
    if (targetCountryId) {
      try {
        await updateRouteGeometryMutation.mutateAsync({
          id: routeId,
          countryId: targetCountryId,
          geometry: { type: "LineString", coordinates: reversed },
        });
      } catch {
        // Handled gracefully in local vertices
      }
    }
  }, [currentVertices, onRouteVerticesUpdate, route?.countryId, countryId, updateRouteGeometryMutation, routeId]);

  // Handle Delete Vertex
  const handleDeleteVertex = useCallback(
    (index: number) => {
      if (currentVertices.length <= 2) return;
      const next = currentVertices.filter((_, i) => i !== index);
      onRouteVerticesUpdate?.(next);
    },
    [currentVertices, onRouteVerticesUpdate]
  );

  if (isLoading && !route) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-xs text-muted-foreground">
        <Loader2 className="mb-2 h-5 w-5 animate-spin text-primary" />
        <span>Loading route details...</span>
      </div>
    );
  }

  const activeStyle = ROUTE_STYLES[routeType] ?? {
    label: routeType,
    color: "var(--color-slate-400)",
  };

  return (
    <div className="space-y-3.5 text-xs text-foreground">
      {/* Navigation Breadcrumb Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition active:scale-[0.98]"
        >
          <ArrowLeft className="h-3 w-3" />
          <span>All Routes</span>
        </button>
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          {currentVertices.length} Nodes
        </span>
      </div>

      {/* Route Metadata Section */}
      <div className="space-y-2">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Route Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Route Name"
            className="w-full rounded-md border border-border/40 bg-background/50 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Route Sub-Type
          </label>
          <div className="relative">
            <select
              value={routeType}
              onChange={(e) => setRouteType(e.target.value)}
              className="w-full rounded-md border border-border/40 bg-background/50 px-2.5 py-1.5 pl-6 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              {ROUTE_TYPE_KEYS.map((key) => {
                const s = ROUTE_STYLES[key];
                return (
                  <option key={key} value={key}>
                    {s?.label ?? key}
                  </option>
                );
              })}
            </select>
            <span
              className="pointer-events-none absolute left-2.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
              style={{ backgroundColor: activeStyle.color }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="w-full rounded-md border border-border/40 bg-background/50 px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none capitalize"
            >
              <option value="operational">Operational</option>
              <option value="under_construction">Under Construction</option>
              <option value="planned">Planned</option>
              <option value="abandoned">Abandoned</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Design Speed (km/h)
            </label>
            <input
              type="number"
              min={5}
              max={2000}
              value={speedKmh ?? ""}
              onChange={(e) => setSpeedKmh(e.target.value ? Number(e.target.value) : undefined)}
              placeholder={String(baseSpeed)}
              className="w-full rounded-md border border-border/40 bg-background/50 px-2 py-1.5 font-mono text-xs tabular-nums text-foreground focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-foreground">
            <input
              type="checkbox"
              checked={isInternational}
              onChange={(e) => setIsInternational(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border/60 text-primary focus:ring-primary/20"
            />
            <span>International Corridor</span>
          </label>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-card/60 px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5">
            <RouteIcon className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground text-[11px]">Distance</span>
          </div>
          <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
            {liveLengthKm.toFixed(1)} km
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-card/60 px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground text-[11px]">Est. Time</span>
          </div>
          <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
            {travelTime.formattedTime}
          </span>
        </div>
      </div>

      {/* Path Nodes List */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Path Vertices & Nodes
          </label>
          <span className="text-[10px] text-muted-foreground">
            {currentVertices.length} points
          </span>
        </div>

        {currentVertices.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
            No vertices recorded for this route.
          </div>
        ) : (
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border/30 bg-muted/10 p-1.5">
            {currentVertices.map((coord, idx) => {
              const isStart = idx === 0;
              const isEnd = idx === currentVertices.length - 1;

              return (
                <div
                  key={idx}
                  className="group flex items-center justify-between rounded bg-background/60 px-2 py-1 text-[11px] hover:bg-background transition"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin
                      className={`h-3 w-3 shrink-0 ${
                        isStart
                          ? "text-emerald-500"
                          : isEnd
                          ? "text-red-500"
                          : "text-primary"
                      }`}
                    />
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                      #{idx + 1}
                    </span>
                    {isStart && (
                      <span className="rounded bg-emerald-500/10 px-1 py-0.2 text-[9px] font-medium text-emerald-500">
                        Start
                      </span>
                    )}
                    {isEnd && (
                      <span className="rounded bg-red-500/10 px-1 py-0.2 text-[9px] font-medium text-red-500">
                        End
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {coord[0].toFixed(4)}°, {coord[1].toFixed(4)}°
                    </span>
                    {onFlyToCoords && (
                      <button
                        type="button"
                        onClick={() => onFlyToCoords(coord)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition active:scale-[0.98]"
                        title="Focus on map"
                      >
                        <Eye className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={currentVertices.length <= 2}
                      onClick={() => handleDeleteVertex(idx)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition active:scale-[0.98] disabled:opacity-30"
                      title="Remove vertex"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded bg-muted/20 px-2 py-1.5 text-[10px] text-muted-foreground leading-relaxed">
          Tip: Drag vertex pins on the map to reshape. Click midpoint pins to add nodes. Right-click vertex to delete.
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground shadow transition active:scale-[0.98] hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            <span>Save Route Path</span>
          </button>

          <button
            type="button"
            onClick={handleReverse}
            disabled={currentVertices.length < 2 || isSaving}
            className="flex items-center justify-center gap-1 rounded-md border border-border/60 bg-card/60 px-2.5 py-2 text-xs font-medium text-foreground transition active:scale-[0.98] hover:bg-muted/40 disabled:opacity-50"
            title="Reverse route direction"
          >
            <Reverse className="h-3.5 w-3.5" />
            <span>Reverse</span>
          </button>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="text-[11px] text-muted-foreground hover:text-foreground transition active:scale-[0.98]"
          >
            Cancel
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-destructive">Confirm?</span>
              <button
                type="button"
                onClick={() => onDeleteRoute?.(routeId)}
                className="rounded bg-destructive px-2 py-1 text-[10px] font-semibold text-destructive-foreground transition active:scale-[0.98] hover:bg-destructive/90"
              >
                Yes, Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded border border-border px-1.5 py-1 text-[10px] text-muted-foreground transition active:scale-[0.98] hover:bg-muted"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 text-[11px] text-destructive/80 hover:text-destructive transition active:scale-[0.98]"
            >
              <Trash2 className="h-3 w-3" />
              <span>Delete Route</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

"use client";

import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
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
import { Checkbox } from "~/components/ui/checkbox";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { Card } from "~/components/ui/card";

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
  const [status, setStatus] = useState<
    "planned" | "under_construction" | "operational" | "abandoned"
  >("operational");
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
      const geo = route.geometry as {
        type?: string;
        coordinates?: [number, number][] | [number, number][][];
      };
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
  }, [
    onCommit,
    route?.countryId,
    countryId,
    updateRouteMutation,
    routeId,
    name,
    routeType,
    status,
    isInternational,
    speedKmh,
  ]);

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
  }, [
    currentVertices,
    onRouteVerticesUpdate,
    route?.countryId,
    countryId,
    updateRouteGeometryMutation,
    routeId,
  ]);

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
      <div className="text-label-secondary text-footnote flex flex-col items-center justify-center py-12 text-center">
        <Loader2 className="text-tint mb-2 h-5 w-5 animate-spin" />
        <span>Loading route details...</span>
      </div>
    );
  }

  const activeStyle = ROUTE_STYLES[routeType] ?? {
    label: routeType,
    color: "var(--color-slate-400)",
  };

  return (
    <div className="text-label text-footnote space-y-4">
      {/* Navigation Breadcrumb Header */}
      <div className="border-separator flex items-center justify-between border-b pb-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-label-secondary"
          type="button"
          onClick={onCancel}
        >
          <ArrowLeft className="h-3 w-3" />
          <span>All Routes</span>
        </Button>
        <Eyebrow>{currentVertices.length} Nodes</Eyebrow>
      </div>

      {/* Route Metadata Section */}
      <div className="space-y-2">
        <div className="space-y-1">
          <Eyebrow className="block">Route Name</Eyebrow>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Route Name"
            className="border-separator bg-surface text-label placeholder:text-label-secondary focus:border-tint rounded-control-sm text-footnote w-full border px-3 py-2 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <Eyebrow className="block">Route Sub-Type</Eyebrow>
          <div className="relative">
            <OptionSelect
              aria-label="Route type"
              size="sm"
              className="w-full pl-6"
              value={routeType}
              onValueChange={setRouteType}
              options={ROUTE_TYPE_KEYS.map((key) => ({
                value: key,
                label: ROUTE_STYLES[key]?.label ?? key,
              }))}
            />
            <span
              className="pointer-events-none absolute top-1/2 left-3 h-2 w-2 -translate-y-1/2 rounded-full"
              style={{ backgroundColor: activeStyle.color }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Eyebrow className="block">Status</Eyebrow>
            <OptionSelect
              aria-label="Status"
              value={status}
              onValueChange={(v) => setStatus(v as typeof status)}
              options={[
                { value: "operational", label: "Operational" },
                { value: "under_construction", label: "Under Construction" },
                { value: "planned", label: "Planned" },
                { value: "abandoned", label: "Abandoned" },
              ]}
              size="sm"
              className="w-full"
            />
          </div>

          <div className="space-y-1">
            <Eyebrow className="block">Design Speed (km/h)</Eyebrow>
            <input
              type="number"
              min={5}
              max={2000}
              value={speedKmh ?? ""}
              onChange={(e) => setSpeedKmh(e.target.value ? Number(e.target.value) : undefined)}
              placeholder={String(baseSpeed)}
              className="border-separator bg-surface text-label focus:border-tint rounded-control-sm text-footnote w-full border px-2 py-2 tabular-nums focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <label className="text-label text-footnote flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={isInternational}
              onCheckedChange={(c) => setIsInternational(c === true)}
            />
            <span>International Corridor</span>
          </label>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="text-footnote flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <RouteIcon className="text-tint h-3.5 w-3.5" />
            <span className="text-label-secondary text-footnote">Distance</span>
          </div>
          <span className="text-label text-caption font-semibold tabular-nums">
            {liveLengthKm.toFixed(1)} km
          </span>
        </Card>
        <Card className="text-footnote flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <Clock className="text-tint h-3.5 w-3.5" />
            <span className="text-label-secondary text-footnote">Est. Time</span>
          </div>
          <span className="text-label text-caption font-semibold tabular-nums">
            {travelTime.formattedTime}
          </span>
        </Card>
      </div>

      {/* Path Nodes List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Eyebrow className="block">Path Vertices & Nodes</Eyebrow>
          <span className="text-label-secondary text-footnote">
            {currentVertices.length} points
          </span>
        </div>

        {currentVertices.length === 0 ? (
          <div className="border-separator text-label-secondary rounded-control-sm text-footnote border border-dashed p-4 text-center">
            No vertices recorded for this route.
          </div>
        ) : (
          <Card className="max-h-48 space-y-1 overflow-y-auto p-2">
            {currentVertices.map((coord, idx) => {
              const isStart = idx === 0;
              const isEnd = idx === currentVertices.length - 1;

              return (
                <div
                  key={idx}
                  className="group bg-surface hover:bg-surface text-footnote rounded-control-sm flex items-center justify-between px-2 py-1 transition"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <MapPin
                      className={`h-3 w-3 shrink-0 ${
                        isStart ? "text-green" : isEnd ? "text-red" : "text-tint"
                      }`}
                    />
                    <span className="text-label-secondary text-footnote tabular-nums">
                      #{idx + 1}
                    </span>
                    {isStart && <Badge variant="success">Start</Badge>}
                    {isEnd && <Badge variant="destructive">End</Badge>}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-label-secondary text-footnote font-mono tabular-nums">
                      {coord[0].toFixed(4)}°, {coord[1].toFixed(4)}°
                    </span>
                    {onFlyToCoords && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-label-secondary h-6 w-6"
                        type="button"
                        onClick={() => onFlyToCoords(coord)}
                        title="Focus on map"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive h-6 w-6"
                      type="button"
                      disabled={currentVertices.length <= 2}
                      onClick={() => handleDeleteVertex(idx)}
                      title="Remove vertex"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </Card>
        )}

        <div className="bg-fill-4 text-label-secondary text-footnote rounded-control-sm px-2 py-2 leading-relaxed">
          Tip: Drag vertex pins on the map to reshape. Click midpoint pins to add nodes. Right-click
          vertex to delete.
        </div>
      </div>

      {errorMessage && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-control-sm text-footnote border p-2">
          {errorMessage}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="flex-1 justify-center"
            type="button"
            disabled={isSaving}
            onClick={handleSave}
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            <span>Save Route Path</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="justify-center"
            type="button"
            onClick={handleReverse}
            disabled={currentVertices.length < 2 || isSaving}
            title="Reverse route direction"
          >
            <Reverse className="h-3.5 w-3.5" />
            <span>Reverse</span>
          </Button>
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-label-secondary"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </Button>

          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-destructive text-footnote">Confirm?</span>
              <Button
                variant="destructive"
                size="xs"
                type="button"
                onClick={() => onDeleteRoute?.(routeId)}
              >
                Yes, Delete
              </Button>
              <Button
                variant="outline"
                size="xs"
                type="button"
                onClick={() => setConfirmDelete(false)}
              >
                No
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              type="button"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3 w-3" />
              <span>Delete Route</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

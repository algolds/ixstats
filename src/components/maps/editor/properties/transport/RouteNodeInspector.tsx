"use client";

import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { memo, useState, useEffect, useMemo } from "react";
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
} from "iconoir-react";
import { ROUTE_STYLES, ROUTE_TYPE_KEYS } from "~/lib/maps/map-config";
import { polylineLengthKm } from "~/lib/maps/geo-math";
import { api, type RouterOutputs } from "~/trpc/react";
import { calculateRouteTravelTime, resolveRouteBaseSpeed } from "~/lib/economy/travel-time";
import { Checkbox } from "~/components/ui/checkbox";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { Card } from "~/components/ui/card";
import type { Geometry } from "geojson";
import { routeVertices } from "~/components/maps/editor/utils/map-helpers";

type Coord = [number, number];
type RouteStatus = "planned" | "under_construction" | "operational" | "abandoned";

const ROUTE_TYPE_OPTIONS = ROUTE_TYPE_KEYS.map((key) => ({
  value: key,
  label: ROUTE_STYLES[key]?.label ?? key,
}));

const STATUS_OPTIONS = [
  { value: "operational", label: "Operational" },
  { value: "under_construction", label: "Under construction" },
  { value: "planned", label: "Planned" },
  { value: "abandoned", label: "Abandoned" },
];

const INPUT_BASE =
  "border-separator bg-surface text-label focus:border-tint rounded-control-sm text-footnote w-full border focus:outline-none";

interface RouteForm {
  name: string;
  routeType: string;
  status: RouteStatus;
  isInternational: boolean;
  speedKmh: number | undefined;
}

type RouteRecord = NonNullable<RouterOutputs["transport"]["getRouteById"]>;

const DEFAULT_FORM: RouteForm = {
  name: "",
  routeType: "road",
  status: "operational",
  isInternational: false,
  speedKmh: undefined,
};

function toForm(route: RouteRecord): RouteForm {
  const speed =
    (route as { speedKmh?: number | null }).speedKmh ??
    (route.properties as { speed_kmh?: number } | null)?.speed_kmh;
  return {
    name: route.name ?? "",
    routeType: route.routeType ?? "road",
    status: (route.status as RouteStatus) ?? "operational",
    isInternational: Boolean(route.isInternational),
    speedKmh: typeof speed === "number" ? speed : undefined,
  };
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="text-footnote flex items-center justify-between px-3 py-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-label-secondary text-footnote">{label}</span>
      </div>
      <span className="text-label text-caption font-semibold tabular-nums">{value}</span>
    </Card>
  );
}

function VertexList({
  vertices,
  onFlyToCoords,
  onDeleteVertex,
}: {
  vertices: Coord[];
  onFlyToCoords?: (coord: Coord) => void;
  onDeleteVertex: (index: number) => void;
}) {
  if (vertices.length === 0) {
    return (
      <div className="border-separator text-label-secondary rounded-control-sm text-footnote border border-dashed p-4 text-center">
        No vertices recorded for this route.
      </div>
    );
  }

  return (
    <Card className="max-h-48 space-y-1 overflow-y-auto p-2">
      {vertices.map((coord, idx) => {
        const isStart = idx === 0;
        const isEnd = idx === vertices.length - 1;

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
              <span className="text-label-secondary text-footnote tabular-nums">#{idx + 1}</span>
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
                disabled={vertices.length <= 2}
                onClick={() => onDeleteVertex(idx)}
                title="Remove vertex"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function DeleteRouteControl({ onDelete }: { onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        type="button"
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="h-3 w-3" />
        <span>Delete route</span>
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <span className="text-destructive text-footnote">Confirm?</span>
      <Button variant="destructive" size="xs" type="button" onClick={onDelete}>
        Yes, Delete
      </Button>
      <Button variant="outline" size="xs" type="button" onClick={() => setConfirming(false)}>
        No
      </Button>
    </div>
  );
}

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

function RouteMetadataFields({
  form,
  onChange,
  baseSpeed,
}: {
  form: RouteForm;
  onChange: (changes: Partial<RouteForm>) => void;
  baseSpeed: number;
}) {
  const { name, routeType, status, isInternational, speedKmh } = form;
  const activeStyle = ROUTE_STYLES[routeType] ?? {
    label: routeType,
    color: "var(--color-slate-400)",
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Eyebrow className="block">Route name</Eyebrow>
        <input
          type="text"
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Route name"
          className={`${INPUT_BASE} placeholder:text-label-secondary px-3 py-2`}
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
            onValueChange={(type) => onChange({ routeType: type })}
            options={ROUTE_TYPE_OPTIONS}
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
            onValueChange={(v) => onChange({ status: v as RouteStatus })}
            options={STATUS_OPTIONS}
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
            onChange={(e) =>
              onChange({ speedKmh: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder={String(baseSpeed)}
            className={`${INPUT_BASE} px-2 py-2 tabular-nums`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-0.5">
        <label className="text-label text-footnote flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={isInternational}
            onCheckedChange={(c) => onChange({ isInternational: c === true })}
          />
          <span>International corridor</span>
        </label>
      </div>
    </div>
  );
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

  const [form, setForm] = useState<RouteForm>(DEFAULT_FORM);
  const patch = (changes: Partial<RouteForm>) => setForm((f) => ({ ...f, ...changes }));
  const { name, routeType, status, isInternational, speedKmh } = form;
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Re-seed the form whenever the fetched route changes
  useEffect(() => {
    if (route) setForm(toForm(route));
  }, [route]);

  const invalidateRoutes = (includeStats: boolean) => {
    void utils.transport.getRouteById.invalidate({ id: routeId });
    void utils.transport.getCountryRoutes.invalidate();
    void utils.transport.getAllRoutesGeoJSON.invalidate();
    if (includeStats) void utils.transport.getTransportStats.invalidate();
  };
  const updateRouteMutation = api.transport.updateRoute.useMutation({
    onSuccess: () => invalidateRoutes(true),
  });
  const updateRouteGeometryMutation = api.transport.updateRouteGeometry.useMutation({
    onSuccess: () => invalidateRoutes(false),
  });

  const currentVertices: Coord[] = useMemo(
    () =>
      editingRouteVertices && editingRouteVertices.length > 0
        ? editingRouteVertices
        : routeVertices(route?.geometry as unknown as Geometry | null | undefined),
    [editingRouteVertices, route?.geometry]
  );

  const liveLengthKm = useMemo(
    () => (currentVertices.length < 2 ? 0 : polylineLengthKm(currentVertices)),
    [currentVertices]
  );

  const baseSpeed = resolveRouteBaseSpeed({
    speedKmh,
    properties: route?.properties as Record<string, unknown> | null,
    routeType,
  });

  const travelTime = useMemo(
    () =>
      calculateRouteTravelTime({
        lengthKm: liveLengthKm,
        speedKmh: baseSpeed,
        routeType,
        terrainDifficulty: route?.terrainDifficulty,
        stopsCount: currentVertices.length,
      }),
    [liveLengthKm, baseSpeed, routeType, route?.terrainDifficulty, currentVertices.length]
  );

  const targetCountryId = route?.countryId ?? countryId;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      await onCommit?.();
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
  };

  const handleReverse = async () => {
    if (currentVertices.length < 2) return;
    const reversed = [...currentVertices].reverse();
    onRouteVerticesUpdate?.(reversed);
    if (!targetCountryId) return;
    try {
      await updateRouteGeometryMutation.mutateAsync({
        id: routeId,
        countryId: targetCountryId,
        geometry: { type: "LineString", coordinates: reversed },
      });
    } catch {
      // Handled gracefully in local vertices
    }
  };

  const handleDeleteVertex = (index: number) => {
    if (currentVertices.length > 2) {
      onRouteVerticesUpdate?.(currentVertices.filter((_, i) => i !== index));
    }
  };

  if (isLoading && !route) {
    return (
      <div className="text-label-secondary text-footnote flex flex-col items-center justify-center py-12 text-center">
        <Loader2 className="text-tint mb-2 h-5 w-5 animate-spin" />
        <span>Loading route details...</span>
      </div>
    );
  }

  return (
    <div className="text-label text-footnote space-y-4">
      <div className="border-separator flex items-center justify-between border-b pb-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-label-secondary"
          type="button"
          onClick={onCancel}
        >
          <ArrowLeft className="h-3 w-3" />
          <span>All routes</span>
        </Button>
        <Eyebrow>{currentVertices.length} Nodes</Eyebrow>
      </div>

      <RouteMetadataFields form={form} onChange={patch} baseSpeed={baseSpeed} />

      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          icon={<RouteIcon className="text-tint h-3.5 w-3.5" />}
          label="Distance"
          value={`${liveLengthKm.toFixed(1)} km`}
        />
        <MetricCard
          icon={<Clock className="text-tint h-3.5 w-3.5" />}
          label="Est. Time"
          value={travelTime.formattedTime}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Eyebrow className="block">Path vertices & nodes</Eyebrow>
          <span className="text-label-secondary text-footnote">
            {currentVertices.length} points
          </span>
        </div>

        <VertexList
          vertices={currentVertices}
          onFlyToCoords={onFlyToCoords}
          onDeleteVertex={handleDeleteVertex}
        />

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
            <span>Save route path</span>
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
          <DeleteRouteControl onDelete={() => onDeleteRoute?.(routeId)} />
        </div>
      </div>
    </div>
  );
});

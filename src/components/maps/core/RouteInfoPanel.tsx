"use client";

/**
 * RouteInfoPanel — Slide-in panel showing transport route details.
 *
 * Appears when a user clicks on a route line on the map.
 * Shows route metadata, stops, and actions (edit, delete, status change).
 */

import { useState, memo, useMemo } from "react";
import {
  Xmark as X,
  Train,
  Car,
  DeliveryTruck as Ship,
  Airplane as Plane,
  Droplet as Droplets,
  Flash,
  Shield,
  Wifi,
  MapPin,
  Dashboard as Gauge,
  Clock,
  ModernTv as Mountain,
  Calendar,
  SystemRestart as Loader2,
  Trash as Trash2,
  EditPencil as Pencil,
  Check,
  Coins,
  PathArrow as Route,
  Wind,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { FacetMaterial } from "~/components/ui/facet";
import { Skeleton } from "~/components/ui/skeleton";
import { getRouteFamily } from "~/lib/economy/transport-costs";
import {
  calculateRouteTravelTime,
  resolveRouteBaseSpeed,
  KMH_PER_KNOT,
  type LngLat,
} from "~/lib/economy/travel-time";
import { Card } from "~/components/ui/card";

interface RouteInfoPanelProps {
  routeId: string;
  onClose: () => void;
  /** Whether the current user can edit this route */
  canEdit?: boolean;
  /** Called when user clicks 'Edit Path' to enter vertex editing */
  onEditPath?: (routeId: string) => void;
}

interface RouteDisplayProperties {
  speed_kmh?: number | string;
  costBillion?: number | string;
  maintenanceCost?: number | string;
  [key: string]: string | number | boolean | null | undefined;
}

interface RouteGeometry {
  type?: string;
  coordinates?: LngLat[] | LngLat[][];
}

/** Route vertices for the sea current/wind model; null when the geometry is not a line. */
function routeGeometryPath(geometry: RouteGeometry | null | undefined): LngLat[] | null {
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  if (geometry.type === "LineString") return geometry.coordinates as LngLat[];
  if (geometry.type === "MultiLineString") return (geometry.coordinates as LngLat[][]).flat();
  return null;
}

function formatSignedSpeed(kmh: number): string {
  const sign = kmh >= 0 ? "+" : "−";
  const abs = Math.abs(kmh);
  return `${sign}${abs.toFixed(1)} km/h (${sign}${(abs / KMH_PER_KNOT).toFixed(1)} kn)`;
}

interface ResolvedStop {
  cityId?: string;
  cityName?: string;
  name?: string;
  cityPopulation?: number | null;
  coordinates?: [number, number];
  order?: number;
}

const TYPE_META: Record<string, { icon: typeof Train; label: string }> = {
  // Rail
  rail: { icon: Train, label: "Railway" },
  high_speed_rail: { icon: Train, label: "High-Speed Rail" },
  railway: { icon: Train, label: "Conventional Rail" },
  metro: { icon: Train, label: "Metro System" },
  light_rail: { icon: Train, label: "Light Rail" },
  monorail: { icon: Train, label: "Monorail" },

  // Road
  motorway: { icon: Car, label: "Motorway" },
  highway: { icon: Car, label: "Highway" },
  trunk: { icon: Car, label: "Trunk Road" },
  road: { icon: Car, label: "Road" },
  secondary: { icon: Car, label: "Secondary Road" },

  // Maritime
  shipping_lane: { icon: Ship, label: "Shipping Lane" },
  canal: { icon: Droplets, label: "Canal" },
  ferry: { icon: Ship, label: "Ferry" },

  // Air
  air_corridor: { icon: Plane, label: "Air Route" },

  // Utility
  pipeline: { icon: Droplets, label: "Pipeline" },
  power_grid: { icon: Flash, label: "Power Grid" },
  fiber: { icon: Wifi, label: "Fiber Optic" },

  // Military
  military_supply: { icon: Shield, label: "Mil. Supply" },
  military_naval: { icon: Shield, label: "Mil. Naval" },
};

/** Semantic status tint for the outline status badge. */
const STATUS_BADGE: Record<string, BadgeVariant> = {
  planned: "neutral",
  under_construction: "caution",
  operational: "success",
  abandoned: "destructive",
};

export const RouteInfoPanel = memo(function RouteInfoPanel({
  routeId,
  onClose,
  canEdit,
  onEditPath,
}: RouteInfoPanelProps) {
  const utils = api.useUtils();
  const { data: route, isLoading } = api.transport.getRouteById.useQuery(
    { id: routeId },
    { staleTime: 30_000 }
  );

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editSpeed, setEditSpeed] = useState<number | undefined>(undefined);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const updateRoute = api.transport.updateRoute.useMutation({
    onSuccess: () => {
      void utils.transport.getRouteById.invalidate({ id: routeId });
      void utils.transport.getAllRoutesGeoJSON.invalidate();
      void utils.transport.getCountryRoutes.invalidate();
      setEditing(false);
    },
  });

  const deleteRoute = api.transport.deleteRoute.useMutation({
    onSuccess: () => {
      void utils.transport.getAllRoutesGeoJSON.invalidate();
      void utils.transport.getCountryRoutes.invalidate();
      void utils.transport.getTransportStats.invalidate();
      onClose();
    },
  });

  const routeSpeedKmh = (route as { speedKmh?: number | null } | undefined)?.speedKmh;

  const baseSpeed = useMemo(() => {
    if (!route) return 0;
    return resolveRouteBaseSpeed({
      speedKmh: routeSpeedKmh,
      properties: route.properties as Record<string, unknown> | null,
      routeType: route.routeType,
    });
  }, [routeSpeedKmh, route?.properties, route?.routeType]);

  const seaPath = useMemo(
    () => routeGeometryPath(route?.geometry as RouteGeometry | null | undefined),
    [route?.geometry]
  );

  const travelTime = useMemo(() => {
    return calculateRouteTravelTime({
      lengthKm: route?.lengthKm ?? 0,
      speedKmh: baseSpeed,
      routeType: route?.routeType ?? "rail",
      terrainDifficulty: route?.terrainDifficulty,
      stopsCount: route?.stopsResolved?.length ?? 0,
      seaPath,
    });
  }, [
    route?.lengthKm,
    baseSpeed,
    route?.routeType,
    route?.terrainDifficulty,
    route?.stopsResolved?.length,
    seaPath,
  ]);

  if (isLoading) {
    return (
      <div className="absolute top-16 right-4 z-30 w-72">
        <FacetMaterial material="regular" className="rounded-card space-y-3 p-4" aria-busy="true">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </FacetMaterial>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="absolute top-16 right-4 z-30 w-72">
        <FacetMaterial material="regular" className="rounded-card p-4">
          <p className="text-label-secondary text-body">Route not found</p>
          <Button variant="link" size="xs" onClick={onClose} className="mt-1 px-0">
            Close
          </Button>
        </FacetMaterial>
      </div>
    );
  }

  const typeMeta = TYPE_META[route.routeType] ?? TYPE_META.road!;
  const TypeIcon = typeMeta.icon;
  const statusVariant = STATUS_BADGE[route.status] ?? STATUS_BADGE.operational!;
  const props = (route.properties as RouteDisplayProperties | null) ?? {};
  const modalFamily = getRouteFamily(route.routeType);
  const largestSeaEffect = travelTime.sea?.largestEffect ?? null;

  const intermodalBadge = (() => {
    if (modalFamily === "maritime") {
      return {
        title: "Deepwater Transshipment Corridor",
        detail: "Connects maritime sea lanes to on-dock rail & drayage trucking terminals.",
      };
    }
    if (route.routeType === "freight_rail") {
      return {
        title: "Intermodal Freight Rail Spine",
        detail: "Heavy-haul container rail linked to seaport terminals & classification yards.",
      };
    }
    if (modalFamily === "air") {
      return {
        title: "Air Freight Express Corridor",
        detail: "High-speed cargo link for courier dispatch & perishable airfreight.",
      };
    }
    if (
      modalFamily === "road" &&
      (route.routeType === "motorway" || route.routeType === "trunk" || route.isInternational)
    ) {
      return {
        title: "Arterial Highway Freight Route",
        detail: "Regional drayage corridor connecting production centers to logistics hubs.",
      };
    }
    return null;
  })();

  const handleStartEdit = () => {
    setEditName(route.name ?? "");
    setEditStatus(route.status);
    setEditSpeed(
      routeSpeedKmh ??
        (typeof props.speed_kmh === "number"
          ? props.speed_kmh
          : props.speed_kmh
            ? Number(props.speed_kmh)
            : baseSpeed)
    );
    setEditing(true);
  };

  const handleSaveEdit = () => {
    if (!route.countryId) return;
    updateRoute.mutate({
      id: route.id,
      countryId: route.countryId,
      name: editName || undefined,
      status: editStatus as "planned" | "under_construction" | "operational" | "abandoned",
      speedKmh: editSpeed != null && !isNaN(editSpeed) && editSpeed > 0 ? editSpeed : undefined,
    });
  };

  const diffBgClass =
    (route.terrainDifficulty ?? 0) > 0.7
      ? "bg-destructive"
      : (route.terrainDifficulty ?? 0) > 0.4
        ? "bg-yellow"
        : "bg-green";

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="animate-in slide-in-from-right-4 absolute top-16 right-4 z-30 w-72 duration-200"
    >
      <FacetMaterial
        material="regular"
        className="rounded-card max-h-[calc(100dvh-5rem)] overflow-y-auto"
      >
        {/* Header */}
        <div className="border-separator flex items-start gap-2 border-b px-4 py-3">
          <TypeIcon className="text-label-secondary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            {editing ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                aria-label="Route name"
                className="text-headline h-(--control-height-sm) px-2"
                placeholder="Route name"
                autoFocus
              />
            ) : (
              <h3 className="text-label text-headline truncate">
                {route.name ?? `${typeMeta.label} Route`}
              </h3>
            )}
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-label-secondary text-footnote">{typeMeta.label}</span>
              {editing ? (
                <OptionSelect
                  aria-label="Route status"
                  size="sm"
                  className="w-auto"
                  value={editStatus}
                  onValueChange={setEditStatus}
                  options={[
                    { value: "planned", label: "Planned" },
                    { value: "under_construction", label: "Under construction" },
                    { value: "operational", label: "Operational" },
                    { value: "abandoned", label: "Abandoned" },
                  ]}
                />
              ) : (
                <Badge variant={statusVariant} className="capitalize">
                  {route.status.replace("_", " ")}
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close route details"
            className="text-label-secondary -mt-1 -mr-2 h-8 w-8 shrink-0 rounded-full"
          >
            <X aria-hidden />
          </Button>
        </div>

        {/* Stats */}
        <div className="text-footnote space-y-2 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-label-secondary flex items-center gap-2">
              <Gauge className="h-3 w-3" /> Length
            </span>
            <span className="font-medium tabular-nums">
              {route.lengthKm?.toLocaleString() ?? "—"} km
            </span>
          </div>

          {route.terrainDifficulty != null && (
            <div className="flex items-center justify-between">
              <span className="text-label-secondary flex items-center gap-2">
                <Mountain className="h-3 w-3" /> Terrain
              </span>
              <div className="flex items-center gap-2">
                <div className="bg-fill-3 h-1.5 w-16 overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full ${diffBgClass}`}
                    style={{
                      width: `${Math.round(route.terrainDifficulty * 100)}%`,
                    }}
                  />
                </div>
                <span className="font-medium tabular-nums">
                  {Math.round(route.terrainDifficulty * 100)}%
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-label-secondary flex items-center gap-2">
              <Clock className="h-3 w-3" /> Est. Travel Time
            </span>
            <span className="text-label font-semibold tabular-nums">
              {travelTime.formattedTime}
            </span>
          </div>

          {editing ? (
            <div className="flex items-center justify-between">
              <span className="text-label-secondary flex items-center gap-2">
                <Gauge className="h-3 w-3" /> Speed
              </span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={5}
                  max={2000}
                  aria-label="Speed in km/h"
                  value={editSpeed ?? ""}
                  onChange={(e) =>
                    setEditSpeed(e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="text-footnote h-(--control-height-sm) w-20 px-2 text-right tabular-nums"
                  placeholder={String(baseSpeed)}
                />
                <span className="text-label-secondary text-footnote">km/h</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-label-secondary flex items-center gap-2">
                <Gauge className="h-3 w-3" /> Speed
              </span>
              <div className="flex items-center gap-2 tabular-nums">
                <span className="font-medium">{Math.round(travelTime.effectiveSpeedKmh)} km/h</span>
                {travelTime.terrainDragFactor < 1 && (
                  <span className="text-footnote text-yellow/80">
                    ({Math.round(baseSpeed)} base)
                  </span>
                )}
              </div>
            </div>
          )}

          {Boolean(route.builtYear) && (
            <div className="flex items-center justify-between">
              <span className="text-label-secondary flex items-center gap-2">
                <Calendar className="h-3 w-3" /> Built
              </span>
              <span className="font-medium tabular-nums">{route.builtYear}</span>
            </div>
          )}

          {Boolean(route.isInternational) && (
            <div className="flex items-center justify-between">
              <span className="text-label-secondary">International</span>
              <span className="text-tint font-medium">Yes</span>
            </div>
          )}

          {route.country && (
            <div className="flex items-center justify-between">
              <span className="text-label-secondary">Country</span>
              <span className="font-medium">{route.country.name}</span>
            </div>
          )}
        </div>

        {/* Transit details (sea routes: currents & prevailing winds) */}
        {travelTime.sea && (
          <div className="border-separator text-footnote space-y-2 border-t px-4 py-3">
            <Eyebrow className="mb-2 block">Transit details</Eyebrow>
            <div className="flex items-center justify-between">
              <span className="text-label-secondary flex items-center gap-2">
                <Clock className="h-3 w-3" /> Total time
              </span>
              <span className="text-label font-semibold tabular-nums">
                {travelTime.formattedTime}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-label-secondary flex items-center gap-2">
                <Gauge className="h-3 w-3" /> Avg. speed
              </span>
              <span className="font-medium tabular-nums">
                {`${travelTime.sea.averageSpeedKmh.toFixed(1)} km/h (${(travelTime.sea.averageSpeedKmh / KMH_PER_KNOT).toFixed(1)} kn)`}
              </span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-label-secondary flex shrink-0 items-center gap-2">
                <Wind className="h-3 w-3" /> Largest effect
              </span>
              {largestSeaEffect ? (
                <span className="min-w-0 text-right">
                  <span className="block truncate font-medium">{largestSeaEffect.name}</span>
                  <span
                    className={`block tabular-nums ${
                      largestSeaEffect.averageChangeKmh >= 0 ? "text-green" : "text-yellow"
                    }`}
                  >
                    {formatSignedSpeed(largestSeaEffect.averageChangeKmh)}
                  </span>
                  <span className="text-label-secondary block">
                    {largestSeaEffect.kind} · over{" "}
                    {Math.round(largestSeaEffect.distanceKm).toLocaleString()} km
                  </span>
                </span>
              ) : (
                <span className="text-label-secondary">None on this path</span>
              )}
            </div>
          </div>
        )}

        {/* Cost breakdown */}
        {Boolean(props.costBillion || props.maintenanceCost) && (
          <div className="border-separator text-footnote space-y-2 border-t px-4 py-3">
            {Boolean(props.costBillion) && (
              <div className="flex items-center justify-between">
                <span className="text-label-secondary flex items-center gap-2">
                  <Coins className="h-3 w-3" /> Build Cost
                </span>
                <span className="font-medium tabular-nums">
                  {Number(props.costBillion).toFixed(2)}B
                </span>
              </div>
            )}
            {Boolean(props.maintenanceCost) && (
              <div className="flex items-center justify-between">
                <span className="text-label-secondary">Annual Maint.</span>
                <span className="font-medium tabular-nums">
                  {Number(props.maintenanceCost).toFixed(3)}B/yr
                </span>
              </div>
            )}
          </div>
        )}

        {/* Intermodal Logistics */}
        <div className="border-separator text-footnote space-y-2 border-t px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-label-secondary">Modal Network</span>
            <span className="text-label font-medium capitalize">{modalFamily} Logistics</span>
          </div>
          {intermodalBadge && (
            <Card variant="inset" className="text-footnote px-3 py-2">
              <span className="text-label font-semibold">{intermodalBadge.title}</span>
              <p className="text-label-secondary text-footnote mt-0.5">{intermodalBadge.detail}</p>
            </Card>
          )}
        </div>

        {/* Stops */}
        {Boolean(route.stopsResolved && route.stopsResolved.length > 0) && (
          <div className="border-separator border-t px-4 py-3">
            <Eyebrow className="mb-2 block">Stops ({route.stopsResolved.length})</Eyebrow>
            <div className="space-y-1">
              {route.stopsResolved.map((stop: ResolvedStop, i: number) => (
                <div key={i} className="text-footnote flex items-center gap-2">
                  <MapPin className="text-label-secondary h-3 w-3 shrink-0" />
                  <span className="flex-1 truncate">
                    {stop.cityName ?? stop.name ?? `Stop ${i + 1}`}
                  </span>
                  {Boolean(stop.cityPopulation) && (
                    <span className="text-label-secondary text-footnote tabular-nums">
                      {Number(stop.cityPopulation).toLocaleString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {Boolean(canEdit && route.countryId) && (
          <div className="border-separator flex items-center justify-between gap-1 border-t px-4 py-2">
            {editing ? (
              <div className="flex w-full items-center gap-1">
                <Button
                  size="xs"
                  onClick={handleSaveEdit}
                  disabled={updateRoute.isPending}
                  className="flex-1"
                >
                  {updateRoute.isPending ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Check aria-hidden />
                  )}
                  Save
                </Button>
                <Button variant="outline" size="xs" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            ) : confirmingDelete ? (
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-destructive text-caption">Delete route?</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="destructive"
                    size="xs"
                    onClick={() => {
                      if (route.countryId) {
                        deleteRoute.mutate({ id: route.id, countryId: route.countryId });
                      }
                    }}
                    disabled={deleteRoute.isPending}
                  >
                    {deleteRoute.isPending ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      "Confirm"
                    )}
                  </Button>
                  <Button variant="outline" size="xs" onClick={() => setConfirmingDelete(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleStartEdit}
                  className="text-label-secondary"
                >
                  <Pencil aria-hidden /> Edit
                </Button>
                {onEditPath && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onEditPath(routeId)}
                    className="text-label-secondary"
                  >
                    <Route aria-hidden /> Edit path
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={deleteRoute.isPending}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 aria-hidden /> Delete
                </Button>
              </>
            )}
          </div>
        )}
      </FacetMaterial>
    </div>
  );
});

"use client";

import { useState, memo, useMemo, type ComponentType, type ReactNode } from "react";
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
import { api, type RouterOutputs } from "~/trpc/react";
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

const TYPE_META: Record<string, { icon: typeof Train; label: string }> = {
  rail: { icon: Train, label: "Railway" },
  high_speed_rail: { icon: Train, label: "High-Speed Rail" },
  railway: { icon: Train, label: "Conventional rail" },
  metro: { icon: Train, label: "Metro system" },
  light_rail: { icon: Train, label: "Light rail" },
  monorail: { icon: Train, label: "Monorail" },
  motorway: { icon: Car, label: "Motorway" },
  highway: { icon: Car, label: "Highway" },
  trunk: { icon: Car, label: "Trunk road" },
  road: { icon: Car, label: "Road" },
  secondary: { icon: Car, label: "Secondary road" },
  shipping_lane: { icon: Ship, label: "Shipping lane" },
  canal: { icon: Droplets, label: "Canal" },
  ferry: { icon: Ship, label: "Ferry" },
  air_corridor: { icon: Plane, label: "Air route" },
  pipeline: { icon: Droplets, label: "Pipeline" },
  power_grid: { icon: Flash, label: "Power grid" },
  fiber: { icon: Wifi, label: "Fiber optic" },
  military_supply: { icon: Shield, label: "Mil. Supply" },
  military_naval: { icon: Shield, label: "Mil. Naval" },
};

/** Route statuses with their label and the semantic tint of the outline status badge. */
const ROUTE_STATUSES = {
  planned: { label: "Planned", badge: "default" },
  under_construction: { label: "Under construction", badge: "warning" },
  operational: { label: "Operational", badge: "success" },
  abandoned: { label: "Abandoned", badge: "destructive" },
} satisfies Record<string, { label: string; badge: BadgeVariant }>;

type RouteStatus = keyof typeof ROUTE_STATUSES;

const ROUTE_STATUS_OPTIONS = Object.entries(ROUTE_STATUSES).map(([value, { label }]) => ({
  value,
  label,
}));

type RouteData = NonNullable<RouterOutputs["transport"]["getRouteById"]>;
type TravelTime = ReturnType<typeof calculateRouteTravelTime>;

const routeSpeedKmh = (route: RouteData) => (route as { speedKmh?: number | null }).speedKmh;

const routeBaseSpeed = (route: RouteData) =>
  resolveRouteBaseSpeed({
    speedKmh: routeSpeedKmh(route),
    properties: route.properties as Record<string, unknown> | null,
    routeType: route.routeType,
  });

/** The speed the edit field starts at: the route's own, else its stored property, else the type default. */
function initialEditSpeed(route: RouteData) {
  const stored = (route.properties as RouteDisplayProperties | null)?.speed_kmh;
  const fallback =
    typeof stored === "number" ? stored : stored ? Number(stored) : routeBaseSpeed(route);
  return routeSpeedKmh(route) ?? fallback;
}

const INTERMODAL_NOTES = {
  maritime: {
    title: "Deepwater Transshipment Corridor",
    detail: "Connects maritime sea lanes to on-dock rail & drayage trucking terminals.",
  },
  freightRail: {
    title: "Intermodal Freight Rail Spine",
    detail: "Heavy-haul container rail linked to seaport terminals & classification yards.",
  },
  air: {
    title: "Air Freight Express Corridor",
    detail: "High-speed cargo link for courier dispatch & perishable airfreight.",
  },
  road: {
    title: "Arterial Highway Freight Route",
    detail: "Regional drayage corridor connecting production centers to logistics hubs.",
  },
};

function intermodalNote(route: RouteData, family: string) {
  if (family === "maritime") return INTERMODAL_NOTES.maritime;
  if (route.routeType === "freight_rail") return INTERMODAL_NOTES.freightRail;
  if (family === "air") return INTERMODAL_NOTES.air;
  const arterial = route.routeType === "motorway" || route.routeType === "trunk";
  if (family === "road" && (arterial || route.isInternational)) return INTERMODAL_NOTES.road;
  return null;
}

/** Inline edit / delete-confirmation state and the update/delete mutations for one route. */
function useRouteEditor(routeId: string, onClose: () => void) {
  const utils = api.useUtils();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [speed, setSpeed] = useState<number | undefined>(undefined);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const invalidateRoutes = () => {
    void utils.transport.getAllRoutesGeoJSON.invalidate();
    void utils.transport.getCountryRoutes.invalidate();
  };

  const updateRoute = api.transport.updateRoute.useMutation({
    onSuccess: () => {
      void utils.transport.getRouteById.invalidate({ id: routeId });
      invalidateRoutes();
      setEditing(false);
    },
  });

  const deleteRoute = api.transport.deleteRoute.useMutation({
    onSuccess: () => {
      invalidateRoutes();
      void utils.transport.getTransportStats.invalidate();
      onClose();
    },
  });

  const start = (route: RouteData, initialSpeed: number) => {
    setName(route.name ?? "");
    setStatus(route.status);
    setSpeed(initialSpeed);
    setEditing(true);
  };

  const save = (route: RouteData) => {
    if (!route.countryId) return;
    updateRoute.mutate({
      id: route.id,
      countryId: route.countryId,
      name: name || undefined,
      status: status as RouteStatus,
      speedKmh: speed != null && !isNaN(speed) && speed > 0 ? speed : undefined,
    });
  };

  return {
    editing,
    setEditing,
    name,
    setName,
    status,
    setStatus,
    speed,
    setSpeed,
    confirmingDelete,
    setConfirmingDelete,
    start,
    save,
    updateRoute,
    deleteRoute,
  };
}

type RouteEditor = ReturnType<typeof useRouteEditor>;

function StatRow({
  icon: Icon,
  label,
  children,
}: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-label-secondary flex items-center gap-2">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </span>
      {children}
    </div>
  );
}

function RouteHeader({
  route,
  editor,
  onClose,
}: {
  route: RouteData;
  editor: RouteEditor;
  onClose: () => void;
}) {
  const typeMeta = TYPE_META[route.routeType] ?? TYPE_META.road!;
  const TypeIcon = typeMeta.icon;
  return (
    <div className="border-separator flex items-start gap-2 border-b px-4 py-3">
      <TypeIcon className="text-label-secondary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {editor.editing ? (
          <Input
            value={editor.name}
            onChange={(e) => editor.setName(e.target.value)}
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
          {editor.editing ? (
            <OptionSelect
              aria-label="Route status"
              size="sm"
              className="w-auto"
              value={editor.status}
              onValueChange={editor.setStatus}
              options={ROUTE_STATUS_OPTIONS}
            />
          ) : (
            <Badge
              variant={ROUTE_STATUSES[route.status as RouteStatus]?.badge ?? "success"}
              className="capitalize"
            >
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
  );
}

function RouteStats({
  route,
  travelTime,
  baseSpeed,
  editor,
}: {
  route: RouteData;
  travelTime: TravelTime;
  baseSpeed: number;
  editor: RouteEditor;
}) {
  const difficulty = route.terrainDifficulty;
  const diffPercent = Math.round((difficulty ?? 0) * 100);
  const diffBgClass =
    (difficulty ?? 0) > 0.7 ? "bg-destructive" : (difficulty ?? 0) > 0.4 ? "bg-yellow" : "bg-green";

  return (
    <div className="text-footnote space-y-2 px-4 py-3">
      <StatRow icon={Gauge} label="Length">
        <span className="font-medium tabular-nums">
          {route.lengthKm?.toLocaleString() ?? "—"} km
        </span>
      </StatRow>

      {difficulty != null && (
        <StatRow icon={Mountain} label="Terrain">
          <div className="flex items-center gap-2">
            <div className="bg-fill-3 h-1.5 w-16 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full ${diffBgClass}`}
                style={{ width: `${diffPercent}%` }}
              />
            </div>
            <span className="font-medium tabular-nums">{diffPercent}%</span>
          </div>
        </StatRow>
      )}

      <StatRow icon={Clock} label="Est. Travel Time">
        <span className="text-label font-semibold tabular-nums">{travelTime.formattedTime}</span>
      </StatRow>

      <StatRow icon={Gauge} label="Speed">
        {editor.editing ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={5}
              max={2000}
              aria-label="Speed in km/h"
              value={editor.speed ?? ""}
              onChange={(e) => editor.setSpeed(e.target.value ? Number(e.target.value) : undefined)}
              className="text-footnote h-(--control-height-sm) w-20 px-2 text-right tabular-nums"
              placeholder={String(baseSpeed)}
            />
            <span className="text-label-secondary text-footnote">km/h</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 tabular-nums">
            <span className="font-medium">{Math.round(travelTime.effectiveSpeedKmh)} km/h</span>
            {travelTime.terrainDragFactor < 1 && (
              <span className="text-footnote text-yellow/80">({Math.round(baseSpeed)} base)</span>
            )}
          </div>
        )}
      </StatRow>

      {Boolean(route.builtYear) && (
        <StatRow icon={Calendar} label="Built">
          <span className="font-medium tabular-nums">{route.builtYear}</span>
        </StatRow>
      )}

      {Boolean(route.isInternational) && (
        <StatRow label="International">
          <span className="text-tint font-medium">Yes</span>
        </StatRow>
      )}

      {route.country && (
        <StatRow label="Country">
          <span className="font-medium">{route.country.name}</span>
        </StatRow>
      )}
    </div>
  );
}

/** Sea routes: total time plus the current/wind system with the largest net effect. */
function SeaTransitDetails({
  sea,
  formattedTime,
}: {
  sea: NonNullable<TravelTime["sea"]>;
  formattedTime: string;
}) {
  const effect = sea.largestEffect;
  return (
    <div className="border-separator text-footnote space-y-2 border-t px-4 py-3">
      <Eyebrow className="mb-2 block">Transit details</Eyebrow>
      <StatRow icon={Clock} label="Total time">
        <span className="text-label font-semibold tabular-nums">{formattedTime}</span>
      </StatRow>
      <StatRow icon={Gauge} label="Avg. speed">
        <span className="font-medium tabular-nums">
          {`${sea.averageSpeedKmh.toFixed(1)} km/h (${(sea.averageSpeedKmh / KMH_PER_KNOT).toFixed(1)} kn)`}
        </span>
      </StatRow>
      <div className="flex items-start justify-between gap-2">
        <span className="text-label-secondary flex shrink-0 items-center gap-2">
          <Wind className="h-3 w-3" /> Largest effect
        </span>
        {effect ? (
          <span className="min-w-0 text-right">
            <span className="block truncate font-medium">{effect.name}</span>
            <span
              className={`block tabular-nums ${effect.averageChangeKmh >= 0 ? "text-green" : "text-yellow"}`}
            >
              {formatSignedSpeed(effect.averageChangeKmh)}
            </span>
            <span className="text-label-secondary block">
              {effect.kind} · over {Math.round(effect.distanceKm).toLocaleString()} km
            </span>
          </span>
        ) : (
          <span className="text-label-secondary">None on this path</span>
        )}
      </div>
    </div>
  );
}

function RouteActions({
  route,
  editor,
  onEditPath,
}: {
  route: RouteData;
  editor: RouteEditor;
  onEditPath?: () => void;
}) {
  const { updateRoute, deleteRoute } = editor;

  if (editor.editing) {
    return (
      <div className="flex w-full items-center gap-1">
        <Button
          size="xs"
          onClick={() => editor.save(route)}
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
        <Button variant="outline" size="xs" onClick={() => editor.setEditing(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  if (editor.confirmingDelete) {
    return (
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
            {deleteRoute.isPending ? <Loader2 className="animate-spin" aria-hidden /> : "Confirm"}
          </Button>
          <Button variant="outline" size="xs" onClick={() => editor.setConfirmingDelete(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => editor.start(route, initialEditSpeed(route))}
        className="text-label-secondary"
      >
        <Pencil aria-hidden /> Edit
      </Button>
      {onEditPath && (
        <Button variant="ghost" size="xs" onClick={onEditPath} className="text-label-secondary">
          <Route aria-hidden /> Edit path
        </Button>
      )}
      <Button
        variant="ghost"
        size="xs"
        onClick={() => editor.setConfirmingDelete(true)}
        disabled={deleteRoute.isPending}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 aria-hidden /> Delete
      </Button>
    </>
  );
}

export const RouteInfoPanel = memo(function RouteInfoPanel({
  routeId,
  onClose,
  canEdit,
  onEditPath,
}: RouteInfoPanelProps) {
  const { data: route, isLoading } = api.transport.getRouteById.useQuery(
    { id: routeId },
    { staleTime: 30_000 }
  );
  const editor = useRouteEditor(routeId, onClose);

  const baseSpeed = route ? routeBaseSpeed(route) : 0;

  const seaPath = useMemo(
    () => routeGeometryPath(route?.geometry as RouteGeometry | null | undefined),
    [route?.geometry]
  );

  const travelTime = useMemo(
    () =>
      calculateRouteTravelTime({
        lengthKm: route?.lengthKm ?? 0,
        speedKmh: baseSpeed,
        routeType: route?.routeType ?? "rail",
        terrainDifficulty: route?.terrainDifficulty,
        stopsCount: route?.stopsResolved?.length ?? 0,
        seaPath,
      }),
    [
      route?.lengthKm,
      baseSpeed,
      route?.routeType,
      route?.terrainDifficulty,
      route?.stopsResolved?.length,
      seaPath,
    ]
  );

  if (isLoading) {
    return (
      <div className="absolute top-16 right-4 z-30 w-72">
        <FacetMaterial layer="chrome" className="rounded-card space-y-3 p-4" aria-busy="true">
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
        <FacetMaterial layer="chrome" className="rounded-card p-4">
          <p className="text-label-secondary text-body">Route not found</p>
          <Button variant="link" size="xs" onClick={onClose} className="mt-1 px-0">
            Close
          </Button>
        </FacetMaterial>
      </div>
    );
  }

  const props = (route.properties as RouteDisplayProperties | null) ?? {};
  const modalFamily = getRouteFamily(route.routeType);
  const note = intermodalNote(route, modalFamily);

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="animate-in slide-in-from-right-4 absolute top-16 right-4 z-30 w-72 duration-200"
    >
      <FacetMaterial
        layer="chrome"
        className="rounded-card max-h-[calc(100dvh-5rem)] overflow-y-auto"
      >
        <RouteHeader route={route} editor={editor} onClose={onClose} />
        <RouteStats route={route} travelTime={travelTime} baseSpeed={baseSpeed} editor={editor} />

        {travelTime.sea && (
          <SeaTransitDetails sea={travelTime.sea} formattedTime={travelTime.formattedTime} />
        )}

        {Boolean(props.costBillion || props.maintenanceCost) && (
          <div className="border-separator text-footnote space-y-2 border-t px-4 py-3">
            {Boolean(props.costBillion) && (
              <StatRow icon={Coins} label="Build cost">
                <span className="font-medium tabular-nums">
                  {Number(props.costBillion).toFixed(2)}B
                </span>
              </StatRow>
            )}
            {Boolean(props.maintenanceCost) && (
              <StatRow label="Annual Maint.">
                <span className="font-medium tabular-nums">
                  {Number(props.maintenanceCost).toFixed(3)}B/yr
                </span>
              </StatRow>
            )}
          </div>
        )}

        <div className="border-separator text-footnote space-y-2 border-t px-4 py-2">
          <StatRow label="Modal network">
            <span className="text-label font-medium capitalize">{modalFamily} Logistics</span>
          </StatRow>
          {note && (
            <Card variant="well" className="text-footnote px-3 py-2">
              <span className="text-label font-semibold">{note.title}</span>
              <p className="text-label-secondary text-footnote mt-0.5">{note.detail}</p>
            </Card>
          )}
        </div>

        {Boolean(route.stopsResolved?.length) && (
          <div className="border-separator border-t px-4 py-3">
            <Eyebrow className="mb-2 block">Stops ({route.stopsResolved.length})</Eyebrow>
            <div className="space-y-1">
              {route.stopsResolved.map((stop, i) => (
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

        {Boolean(canEdit && route.countryId) && (
          <div className="border-separator flex items-center justify-between gap-1 border-t px-4 py-2">
            <RouteActions
              route={route}
              editor={editor}
              onEditPath={onEditPath && (() => onEditPath(routeId))}
            />
          </div>
        )}
      </FacetMaterial>
    </div>
  );
});

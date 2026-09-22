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
} from "iconoir-react";
import { api } from "~/trpc/react";
import { getRouteFamily } from "~/lib/economy/transport-costs";
import { calculateRouteTravelTime, resolveRouteBaseSpeed } from "~/lib/economy/travel-time";

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

interface ResolvedStop {
  cityId?: string;
  cityName?: string;
  name?: string;
  cityPopulation?: number | null;
  coordinates?: [number, number];
  order?: number;
}

const TYPE_META: Record<string, { icon: typeof Train; label: string; badgeClass: string }> = {
  // Rail
  rail: { icon: Train, label: "Railway", badgeClass: "bg-slate-500/15 text-slate-400" },
  high_speed_rail: { icon: Train, label: "High-Speed Rail", badgeClass: "bg-blue-500/15 text-blue-400" },
  railway: { icon: Train, label: "Conventional Rail", badgeClass: "bg-blue-600/15 text-blue-400" },
  metro: { icon: Train, label: "Metro System", badgeClass: "bg-indigo-600/15 text-indigo-400" },
  light_rail: { icon: Train, label: "Light Rail", badgeClass: "bg-cyan-500/15 text-cyan-400" },
  monorail: { icon: Train, label: "Monorail", badgeClass: "bg-indigo-500/15 text-indigo-400" },

  // Road
  motorway: { icon: Car, label: "Motorway", badgeClass: "bg-orange-600/15 text-orange-500" },
  highway: { icon: Car, label: "Highway", badgeClass: "bg-amber-500/15 text-amber-400" },
  trunk: { icon: Car, label: "Trunk Road", badgeClass: "bg-amber-600/15 text-amber-500" },
  road: { icon: Car, label: "Road", badgeClass: "bg-orange-500/15 text-orange-400" },
  secondary: { icon: Car, label: "Secondary Road", badgeClass: "bg-stone-500/15 text-stone-400" },

  // Maritime
  shipping_lane: { icon: Ship, label: "Shipping Lane", badgeClass: "bg-blue-500/15 text-blue-400" },
  canal: { icon: Droplets, label: "Canal", badgeClass: "bg-cyan-500/15 text-cyan-400" },
  ferry: { icon: Ship, label: "Ferry", badgeClass: "bg-cyan-600/15 text-cyan-400" },

  // Air
  air_corridor: { icon: Plane, label: "Air Route", badgeClass: "bg-indigo-500/15 text-indigo-400" },

  // Utility
  pipeline: { icon: Droplets, label: "Pipeline", badgeClass: "bg-yellow-500/15 text-yellow-400" },
  power_grid: { icon: Flash, label: "Power Grid", badgeClass: "bg-amber-500/15 text-amber-300" },
  fiber: { icon: Wifi, label: "Fiber Optic", badgeClass: "bg-emerald-500/15 text-emerald-400" },

  // Military
  military_supply: { icon: Shield, label: "Mil. Supply", badgeClass: "bg-red-500/15 text-red-400" },
  military_naval: { icon: Shield, label: "Mil. Naval", badgeClass: "bg-red-900/20 text-red-400" },
};

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  under_construction: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  operational: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  abandoned: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

export const RouteInfoPanel = memo(function RouteInfoPanel({ routeId, onClose, canEdit, onEditPath }: RouteInfoPanelProps) {
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

  const travelTime = useMemo(() => {
    return calculateRouteTravelTime({
      lengthKm: route?.lengthKm ?? 0,
      speedKmh: baseSpeed,
      routeType: route?.routeType ?? "rail",
      terrainDifficulty: route?.terrainDifficulty,
      stopsCount: route?.stopsResolved?.length ?? 0,
    });
  }, [route?.lengthKm, baseSpeed, route?.routeType, route?.terrainDifficulty, route?.stopsResolved?.length]);

  if (isLoading) {
    return (
      <div className="border-border bg-card absolute top-16 right-4 z-30 w-72 rounded-xl border p-4 shadow-xl">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="border-border bg-card absolute top-16 right-4 z-30 w-72 rounded-xl border p-4 shadow-xl">
        <p className="text-muted-foreground text-sm">Route not found</p>
        <button onClick={onClose} className="text-primary mt-2 text-xs hover:underline">
          Close
        </button>
      </div>
    );
  }

  const typeMeta = TYPE_META[route.routeType] ?? TYPE_META.road!;
  const TypeIcon = typeMeta.icon;
  const statusClass = STATUS_COLORS[route.status] ?? STATUS_COLORS.operational!;
  const props = (route.properties as RouteDisplayProperties | null) ?? {};
  const modalFamily = getRouteFamily(route.routeType);

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
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="border-border bg-card animate-in slide-in-from-right-4 absolute top-16 right-4 z-30 w-72 rounded-xl border shadow-xl duration-200"
    >
      {/* Header */}
      <div className="border-border flex items-start gap-2 border-b px-4 py-3">
        <div
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${typeMeta.badgeClass}`}
        >
          <TypeIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="border-border bg-background w-full rounded border px-1.5 py-0.5 text-sm font-semibold focus:outline-none"
              placeholder="Route name"
              autoFocus
            />
          ) : (
            <h3 className="text-foreground truncate text-sm font-semibold">
              {route.name ?? `${typeMeta.label} Route`}
            </h3>
          )}
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="text-muted-foreground text-[10px]">{typeMeta.label}</span>
            {editing ? (
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="border-border bg-background rounded border px-1 py-0.5 text-[10px] focus:outline-none"
              >
                <option value="planned">Planned</option>
                <option value="under_construction">Under Construction</option>
                <option value="operational">Operational</option>
                <option value="abandoned">Abandoned</option>
              </select>
            ) : (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusClass}`}>
                {route.status.replace("_", " ")}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-md p-1 transition-colors active:scale-[0.98]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Stats */}
      <div className="space-y-1.5 px-4 py-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Gauge className="h-3 w-3" /> Length
          </span>
          <span className="font-medium font-mono tabular-nums">
            {route.lengthKm?.toLocaleString() ?? "—"} km
          </span>
        </div>

        {route.terrainDifficulty != null && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Mountain className="h-3 w-3" /> Terrain
            </span>
            <div className="flex items-center gap-1.5">
              <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full ${diffBgClass}`}
                  style={{
                    width: `${Math.round(route.terrainDifficulty * 100)}%`,
                  }}
                />
              </div>
              <span className="font-medium font-mono tabular-nums">
                {Math.round(route.terrainDifficulty * 100)}%
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Est. Travel Time
          </span>
          <span className="font-semibold font-mono tabular-nums text-foreground">
            {travelTime.formattedTime}
          </span>
        </div>

        {editing ? (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Gauge className="h-3 w-3" /> Speed
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={5}
                max={2000}
                value={editSpeed ?? ""}
                onChange={(e) => setEditSpeed(e.target.value ? Number(e.target.value) : undefined)}
                className="border-border bg-background w-20 rounded border px-1.5 py-0.5 text-right font-mono text-xs tabular-nums focus:outline-none"
                placeholder={String(baseSpeed)}
              />
              <span className="text-muted-foreground text-[10px]">km/h</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Gauge className="h-3 w-3" /> Speed
            </span>
            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <span className="font-medium">{Math.round(travelTime.effectiveSpeedKmh)} km/h</span>
              {travelTime.terrainDragFactor < 1 && (
                <span className="text-[10px] text-amber-500/80">
                  ({Math.round(baseSpeed)} base)
                </span>
              )}
            </div>
          </div>
        )}

        {Boolean(route.builtYear) && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> Built
            </span>
            <span className="font-medium font-mono tabular-nums">{route.builtYear}</span>
          </div>
        )}

        {Boolean(route.isInternational) && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">International</span>
            <span className="text-primary font-medium">Yes</span>
          </div>
        )}

        {route.country && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Country</span>
            <span className="font-medium">{route.country.name}</span>
          </div>
        )}
      </div>

      {/* Cost breakdown */}
      {Boolean(props.costBillion || props.maintenanceCost) && (
        <div className="border-border space-y-1.5 border-t px-4 py-3 text-xs">
          {Boolean(props.costBillion) && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Coins className="h-3 w-3" /> Build Cost
              </span>
              <span className="font-medium font-mono tabular-nums">
                {Number(props.costBillion).toFixed(2)}B
              </span>
            </div>
          )}
          {Boolean(props.maintenanceCost) && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Annual Maint.</span>
              <span className="font-medium font-mono tabular-nums">
                {Number(props.maintenanceCost).toFixed(3)}B/yr
              </span>
            </div>
          )}
        </div>
      )}

      {/* Intermodal Logistics */}
      <div className="border-border space-y-1.5 border-t px-4 py-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Modal Network</span>
          <span className="font-medium capitalize text-foreground">{modalFamily} Logistics</span>
        </div>
        {intermodalBadge && (
          <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1.5 text-[11px] text-cyan-400">
            <span className="font-semibold">{intermodalBadge.title}</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">{intermodalBadge.detail}</p>
          </div>
        )}
      </div>

      {/* Stops */}
      {Boolean(route.stopsResolved && route.stopsResolved.length > 0) && (
        <div className="border-border border-t px-4 py-3">
          <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
            Stops ({route.stopsResolved.length})
          </div>
          <div className="space-y-1">
            {route.stopsResolved.map((stop: ResolvedStop, i: number) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <MapPin className="text-muted-foreground h-3 w-3 shrink-0" />
                <span className="flex-1 truncate">
                  {stop.cityName ?? stop.name ?? `Stop ${i + 1}`}
                </span>
                {Boolean(stop.cityPopulation) && (
                  <span className="text-muted-foreground text-[10px] font-mono tabular-nums">
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
        <div className="border-border flex items-center justify-between gap-1 border-t px-4 py-2">
          {editing ? (
            <div className="flex w-full items-center gap-1">
              <button
                onClick={handleSaveEdit}
                disabled={updateRoute.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition active:scale-[0.98] disabled:opacity-50"
              >
                {updateRoute.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="border-border text-foreground/80 hover:bg-accent rounded-md border px-2 py-1.5 text-xs transition active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          ) : confirmingDelete ? (
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-destructive">Delete route?</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (route.countryId) {
                      deleteRoute.mutate({ id: route.id, countryId: route.countryId });
                    }
                  }}
                  disabled={deleteRoute.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded px-2 py-1 text-xs font-medium transition active:scale-[0.98] disabled:opacity-50"
                >
                  {deleteRoute.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Confirm"
                  )}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="border-border hover:bg-accent rounded border px-2 py-1 text-xs text-muted-foreground transition active:scale-[0.98]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={handleStartEdit}
                className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1 rounded-md px-2 py-1.5 text-xs transition active:scale-[0.98]"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
              {onEditPath && (
                <button
                  onClick={() => onEditPath(routeId)}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1 rounded-md px-2 py-1.5 text-xs transition active:scale-[0.98]"
                >
                  <Route className="h-3 w-3" /> Edit Path
                </button>
              )}
              <button
                onClick={() => setConfirmingDelete(true)}
                disabled={deleteRoute.isPending}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition active:scale-[0.98] disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
});

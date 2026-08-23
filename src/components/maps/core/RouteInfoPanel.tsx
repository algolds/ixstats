"use client";

/**
 * RouteInfoPanel — Slide-in panel showing transport route details.
 *
 * Appears when a user clicks on a route line on the map.
 * Shows route metadata, stops, and actions (edit, delete, status change).
 */

import { useState } from "react";
import { Xmark as X, Train, Car, DeliveryTruck as Ship, Airplane as Plane, Droplet as Droplets, MapPin, Dashboard as Gauge, ModernTv as Mountain, Calendar, SystemRestart as Loader2, Trash as Trash2, EditPencil as Pencil, Check, Coins, Navigator as Route } from "iconoir-react";
import { api } from "~/trpc/react";

interface RouteInfoPanelProps {
  routeId: string;
  onClose: () => void;
  /** Whether the current user can edit this route */
  canEdit?: boolean;
  /** Called when user clicks 'Edit Path' to enter vertex editing */
  onEditPath?: (routeId: string) => void;
}

const TYPE_META: Record<string, { icon: typeof Train; label: string; color: string }> = {
  rail: { icon: Train, label: "Railway", color: "#374151" },
  highway: { icon: Car, label: "Highway", color: "#f97316" },
  road: { icon: Car, label: "Road", color: "#92400e" },
  shipping_lane: { icon: Ship, label: "Shipping Lane", color: "#3b82f6" },
  canal: { icon: Droplets, label: "Canal", color: "#06b6d4" },
  air_corridor: { icon: Plane, label: "Air Route", color: "#a855f7" },
  ferry: { icon: Ship, label: "Ferry", color: "#14b8a6" },
};

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  under_construction: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  operational: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  abandoned: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

export function RouteInfoPanel({ routeId, onClose, canEdit, onEditPath }: RouteInfoPanelProps) {
  const utils = api.useUtils();
  const { data: route, isLoading } = api.transport.getRouteById.useQuery(
    { id: routeId },
    { staleTime: 30_000 }
  );

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("");

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
  const props = (route.properties ?? {}) as Record<string, any>;

  const handleStartEdit = () => {
    setEditName(route.name ?? "");
    setEditStatus(route.status);
    setEditing(true);
  };

  const handleSaveEdit = () => {
    if (!route.countryId) return;
    updateRoute.mutate({
      id: route.id,
      countryId: route.countryId,
      name: editName || undefined,
      status: editStatus as "planned" | "under_construction" | "operational" | "abandoned",
    });
  };

  const handleDelete = () => {
    if (!route.countryId || !confirm("Delete this route?")) return;
    deleteRoute.mutate({ id: route.id, countryId: route.countryId });
  };

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
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: typeMeta.color + "20", color: typeMeta.color }}
        >
          <TypeIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="border-border bg-background w-full rounded border px-1.5 py-0.5 text-sm font-semibold"
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
                className="border-border bg-background rounded border px-1 py-0.5 text-[10px]"
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
          className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-md p-1"
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
          <span className="font-medium tabular-nums">
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
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(route.terrainDifficulty * 100)}%`,
                    backgroundColor:
                      route.terrainDifficulty > 0.7
                        ? "#ef4444"
                        : route.terrainDifficulty > 0.4
                          ? "#f59e0b"
                          : "#22c55e",
                  }}
                />
              </div>
              <span className="font-medium tabular-nums">
                {Math.round(route.terrainDifficulty * 100)}%
              </span>
            </div>
          </div>
        )}

        {Boolean(props.speed_kmh) && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Speed</span>
            <span className="font-medium tabular-nums">{String(props.speed_kmh)} km/h</span>
          </div>
        )}

        {Boolean(route.builtYear) && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> Built
            </span>
            <span className="font-medium tabular-nums">{route.builtYear}</span>
          </div>
        )}

        {Boolean(route.isInternational) && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">International</span>
            <span className="font-medium text-blue-500">Yes</span>
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
              <span className="font-medium tabular-nums">
                {Number(props.costBillion).toFixed(2)}B
              </span>
            </div>
          )}
          {Boolean(props.maintenanceCost) && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Annual Maint.</span>
              <span className="font-medium tabular-nums">
                {Number(props.maintenanceCost).toFixed(3)}B/yr
              </span>
            </div>
          )}
        </div>
      )}

      {/* Stops */}
      {Boolean(route.stopsResolved && route.stopsResolved.length > 0) && (
        <div className="border-border border-t px-4 py-3">
          <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
            Stops ({route.stopsResolved.length})
          </div>
          <div className="space-y-1">
            {route.stopsResolved.map((stop: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <MapPin className="text-muted-foreground h-3 w-3 shrink-0" />
                <span className="flex-1 truncate">
                  {stop.cityName ?? stop.name ?? `Stop ${i + 1}`}
                </span>
                {Boolean(stop.cityPopulation) && (
                  <span className="text-muted-foreground text-[10px] tabular-nums">
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
        <div className="border-border flex items-center gap-1 border-t px-4 py-2">
          {editing ? (
            <>
              <button
                onClick={handleSaveEdit}
                disabled={updateRoute.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium disabled:opacity-50"
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
                className="border-border text-foreground/80 hover:bg-accent rounded-md border px-2 py-1.5 text-xs"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleStartEdit}
                className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1 rounded-md px-2 py-1.5 text-xs"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
              {onEditPath && (
                <button
                  onClick={() => onEditPath(routeId)}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1 rounded-md px-2 py-1.5 text-xs"
                >
                  <Route className="h-3 w-3" /> Edit Path
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={deleteRoute.isPending}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

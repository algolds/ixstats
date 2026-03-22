"use client";

/**
 * RouteInfoPanel — Slide-in panel showing transport route details.
 *
 * Appears when a user clicks on a route line on the map.
 * Shows route metadata, stops, and actions (edit, delete, status change).
 */

import { useState } from "react";
import {
  X, Train, Car, Ship, Plane, Droplets,
  MapPin, Gauge, Mountain, Calendar, Loader2,
  Trash2, Pencil, Check,
} from "lucide-react";
import { api } from "~/trpc/react";

interface RouteInfoPanelProps {
  routeId: string;
  onClose: () => void;
  /** Whether the current user can edit this route */
  canEdit?: boolean;
}

const TYPE_META: Record<string, { icon: typeof Train; label: string; color: string }> = {
  rail: { icon: Train, label: "Railway", color: "#374151" },
  highway: { icon: Car, label: "Highway", color: "#f97316" },
  road: { icon: Car, label: "Road", color: "#92400e" },
  shipping_lane: { icon: Ship, label: "Shipping Lane", color: "#3b82f6" },
  canal: { icon: Droplets, label: "Canal", color: "#06b6d4" },
  air_corridor: { icon: Plane, label: "Air Route", color: "#a855f7" },
};

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  under_construction: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  operational: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  abandoned: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

export function RouteInfoPanel({ routeId, onClose, canEdit }: RouteInfoPanelProps) {
  const utils = api.useUtils();
  const { data: route, isLoading } = api.transport.getRouteById.useQuery(
    { id: routeId },
    { staleTime: 30_000 },
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
      <div className="absolute right-4 top-16 z-30 w-72 rounded-xl border border-border bg-card p-4 shadow-xl">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="absolute right-4 top-16 z-30 w-72 rounded-xl border border-border bg-card p-4 shadow-xl">
        <p className="text-sm text-muted-foreground">Route not found</p>
        <button onClick={onClose} className="mt-2 text-xs text-primary hover:underline">Close</button>
      </div>
    );
  }

  const typeMeta = TYPE_META[route.routeType] ?? TYPE_META.road!;
  const TypeIcon = typeMeta.icon;
  const statusClass = STATUS_COLORS[route.status] ?? STATUS_COLORS.operational!;
  const props = (route.properties ?? {}) as Record<string, unknown>;

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
    <div className="absolute right-4 top-16 z-30 w-72 rounded-xl border border-border bg-card shadow-xl animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="flex items-start gap-2 border-b border-border px-4 py-3">
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
              className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-sm font-semibold"
              placeholder="Route name"
              autoFocus
            />
          ) : (
            <h3 className="text-sm font-semibold text-foreground truncate">
              {route.name ?? `${typeMeta.label} Route`}
            </h3>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-muted-foreground">{typeMeta.label}</span>
            {editing ? (
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="rounded border border-border bg-background px-1 py-0.5 text-[10px]"
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
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Stats */}
      <div className="space-y-1.5 px-4 py-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Gauge className="h-3 w-3" /> Length
          </span>
          <span className="font-medium tabular-nums">{route.lengthKm?.toLocaleString() ?? "—"} km</span>
        </div>

        {route.terrainDifficulty != null && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Mountain className="h-3 w-3" /> Terrain
            </span>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(route.terrainDifficulty * 100)}%`,
                    backgroundColor: route.terrainDifficulty > 0.7 ? "#ef4444" : route.terrainDifficulty > 0.4 ? "#f59e0b" : "#22c55e",
                  }}
                />
              </div>
              <span className="font-medium tabular-nums">{Math.round(route.terrainDifficulty * 100)}%</span>
            </div>
          </div>
        )}

        {props.speed_kmh && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Speed</span>
            <span className="font-medium tabular-nums">{String(props.speed_kmh)} km/h</span>
          </div>
        )}

        {route.builtYear && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3 w-3" /> Built
            </span>
            <span className="font-medium tabular-nums">{route.builtYear}</span>
          </div>
        )}

        {route.isInternational && (
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

      {/* Stops */}
      {route.stopsResolved && route.stopsResolved.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Stops ({route.stopsResolved.length})
          </div>
          <div className="space-y-1">
            {route.stopsResolved.map((stop: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{stop.cityName ?? stop.name ?? `Stop ${i + 1}`}</span>
                {stop.cityPopulation && (
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {Number(stop.cityPopulation).toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {canEdit && route.countryId && (
        <div className="flex items-center gap-1 border-t border-border px-4 py-2">
          {editing ? (
            <>
              <button
                onClick={handleSaveEdit}
                disabled={updateRoute.isPending}
                className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {updateRoute.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-md border border-border px-2 py-1.5 text-xs text-foreground/80 hover:bg-accent"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteRoute.isPending}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
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

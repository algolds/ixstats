// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Loader2,
  CheckCircle2,
  Sparkles,
  Trash2,
  Pencil,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  X,
  Gauge,
  Mountain,
  Plus,
  GripVertical,
} from "lucide-react";
import { api } from "~/trpc/react";
import { ROUTE_STYLES, ROUTE_TYPE_KEYS } from "~/lib/map-config";

// Derive the UI type list from the single source of truth in map-config.
// Each entry carries value, label, and color for the filter chips and type pickers.
const ROUTE_TYPES = ROUTE_TYPE_KEYS.map((key) => ({
  value: key,
  label: ROUTE_STYLES[key]!.label,
  color: ROUTE_STYLES[key]!.color,
})) as ReadonlyArray<{ value: string; label: string; color: string }>;

// Route types the server can generate procedurally (must match the generateRoutes
// Zod enum in routeMutations.ts). All other ROUTE_TYPES are manual-draw only.
const GENERATABLE_ROUTE_TYPES = [
  "rail",
  "highway",
  "road",
  "shipping_lane",
  "canal",
  "air_corridor",
  "ferry",
  "pipeline",
  "power_grid",
  "fiber",
  "military_supply",
  "military_naval",
] as const;

type SortKey = "name" | "length" | "type" | "status";

interface TransportPropertyFormProps {
  countryId?: string;
  onCancel: () => void;
  routeWaypoints?: [number, number][];
  finishRoute?: (routeType?: string, name?: string) => Promise<void>;
  undoLastWaypoint?: () => void;
  clearRouteWaypoints?: () => void;
  selectedRouteId?: string | null;
  onSelectRouteId?: (id: string | null) => void;
  /** Called when user clicks a route to edit its path */
  onEditRoute?: (routeId: string) => void;
}

export const TransportPropertyForm = React.memo(function TransportPropertyForm({
  countryId,
  onCancel,
  routeWaypoints = [],
  finishRoute,
  undoLastWaypoint,
  clearRouteWaypoints,
  selectedRouteId,
  onSelectRouteId,
  onEditRoute,
}: TransportPropertyFormProps) {
  // ── Generate tab state ──
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["rail", "highway"]);
  const [clearExisting, setClearExisting] = useState(false);
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);

  // ── Tab state: routes / draw / generate ──
  const [tab, setTab] = useState<"routes" | "draw" | "generate">(
    routeWaypoints.length > 0 ? "draw" : "routes"
  );

  // ── Draw tab state ──
  const [routeName, setRouteName] = useState("");
  const [manualRouteType, setManualRouteType] = useState<string>("road");
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // ── Routes tab state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("type");
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);

  const utils = api.useUtils();

  const generateRoutes = api.transport.generateRoutes.useMutation({
    onSuccess: () => {
      void utils.transport.getCountryRoutes.invalidate();
      void utils.transport.getAllRoutesGeoJSON.invalidate();
      void utils.transport.getTransportStats.invalidate();
    },
  });

  const deleteRoute = api.transport.deleteRoute.useMutation({
    onSuccess: (_, variables) => {
      void utils.transport.getCountryRoutes.invalidate();
      void utils.transport.getAllRoutesGeoJSON.invalidate();
      void utils.transport.getTransportStats.invalidate();
      if (selectedRouteId === variables.id) {
        onSelectRouteId?.(null);
      }
    },
  });

  const updateRoute = api.transport.updateRoute.useMutation({
    onSuccess: () => {
      void utils.transport.getCountryRoutes.invalidate();
      void utils.transport.getAllRoutesGeoJSON.invalidate();
    },
  });

  const { data: routeData } = api.transport.getCountryRoutes.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId }
  );

  const { data: stats } = api.transport.getTransportStats.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId }
  );

  // Switch to draw tab when waypoints appear
  React.useEffect(() => {
    if (routeWaypoints.length > 0 && tab !== "draw") {
      setTab("draw");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeWaypoints.length]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const routes = routeData?.features ?? [];

  // ── Filter + sort routes ──
  const filteredRoutes = useMemo(() => {
    let result = [...routes];

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => {
        const props = r.properties as Record<string, unknown>;
        const name = ((props.name as string) ?? "").toLowerCase();
        const type = ((props.routeType as string) ?? "").toLowerCase();
        return name.includes(q) || type.includes(q);
      });
    }

    // Type filter
    if (filterTypes.size > 0) {
      result = result.filter((r) => {
        const props = r.properties as Record<string, unknown>;
        return filterTypes.has(props.routeType as string);
      });
    }

    // Sort
    result.sort((a, b) => {
      const pa = a.properties as Record<string, unknown>;
      const pb = b.properties as Record<string, unknown>;
      switch (sortBy) {
        case "name":
          return ((pa.name as string) ?? "").localeCompare((pb.name as string) ?? "");
        case "length":
          return ((pb.lengthKm as number) ?? 0) - ((pa.lengthKm as number) ?? 0);
        case "type":
          return ((pa.routeType as string) ?? "").localeCompare((pb.routeType as string) ?? "");
        case "status":
          return ((pa.status as string) ?? "").localeCompare((pb.status as string) ?? "");
        default:
          return 0;
      }
    });

    return result;
  }, [routes, searchQuery, filterTypes, sortBy]);

  const toggleFilterType = useCallback((type: string) => {
    setFilterTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  if (!countryId) {
    return (
      <div className="space-y-3">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Transport Routes
        </h3>
        <p className="text-muted-foreground text-xs">No country selected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
        Transport Network
      </h3>

      {/* Stats summary */}
      {stats && stats.totalRoutes > 0 && (
        <div className="flex gap-3 text-xs">
          <div className="text-center">
            <div className="text-foreground font-semibold tabular-nums">{stats.totalRoutes}</div>
            <div className="text-muted-foreground text-[10px]">Routes</div>
          </div>
          <div className="text-center">
            <div className="text-foreground font-semibold tabular-nums">
              {stats.totalKm.toLocaleString()}
            </div>
            <div className="text-muted-foreground text-[10px]">km</div>
          </div>
          <div className="text-center">
            <div className="text-foreground font-semibold tabular-nums">{stats.totalHubs}</div>
            <div className="text-muted-foreground text-[10px]">Hubs</div>
          </div>
          {stats.totalMaintenanceCost > 0 && (
            <div className="text-center">
              <div className="text-foreground font-semibold tabular-nums">
                {stats.totalMaintenanceCost.toFixed(2)}B
              </div>
              <div className="text-muted-foreground text-[10px]">Maint/yr</div>
            </div>
          )}
        </div>
      )}

      {/* 3-tab switcher */}
      <div className="bg-muted flex gap-0.5 rounded-lg p-0.5">
        {(
          [
            { key: "routes", label: `Routes (${routes.length})` },
            { key: "draw", label: "Draw" },
            { key: "generate", label: "Generate" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              tab === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          ROUTES TAB — Filterable, sortable route list
         ═══════════════════════════════════════════════════════════════ */}
      {tab === "routes" && (
        <div className="space-y-2">
          {/* Search + filter toggle */}
          <div className="flex gap-1.5">
            <div className="border-border bg-background relative flex-1 rounded-md border">
              <Search className="text-muted-foreground absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search routes..."
                className="w-full bg-transparent py-1 pr-2 pl-7 text-xs focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`border-border rounded-md border p-1.5 transition-colors ${
                showFilters || filterTypes.size > 0
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "text-muted-foreground hover:bg-accent"
              }`}
              title="Filter by type"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Filter chips */}
          {showFilters && (
            <div className="flex flex-wrap gap-1">
              {ROUTE_TYPES.map((rt) => {
                const isActive = filterTypes.has(rt.value);
                return (
                  <button
                    key={rt.value}
                    onClick={() => toggleFilterType(rt.value)}
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      isActive
                        ? "bg-primary/15 text-primary border-primary/30 border"
                        : "bg-muted text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: rt.color }}
                    />
                    {rt.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Sort selector */}
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-muted-foreground">Sort:</span>
            {(["type", "name", "length", "status"] as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`rounded px-1.5 py-0.5 capitalize transition-colors ${
                  sortBy === key
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {key}
              </button>
            ))}
          </div>

          {/* Route list */}
          {filteredRoutes.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-xs">
              {routes.length === 0
                ? "No routes yet. Draw one or use Generate."
                : "No routes match your filters."}
            </p>
          ) : (
            <div className="max-h-72 space-y-0.5 overflow-y-auto">
              {filteredRoutes.map((route) => {
                const props = route.properties as Record<string, unknown>;
                const routeType = ROUTE_TYPES.find((r) => r.value === props.routeType);
                const status = (props.status as string) ?? "operational";
                const isSelected = props.id === selectedRouteId;
                const isExpanded = props.id === expandedRouteId;

                return (
                  <div key={props.id as string}>
                    <div
                      onClick={() => {
                        if (onSelectRouteId) {
                          onSelectRouteId(isSelected ? null : (props.id as string));
                        }
                      }}
                      className={`group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
                        isSelected
                          ? "bg-primary/10 border-primary border-l-2 pl-1.5"
                          : "hover:bg-accent"
                      }`}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: routeType?.color ?? "#888" }}
                      />
                      <span className="text-foreground flex-1 truncate">
                        {(props.name as string) ?? `${routeType?.label ?? "Route"}`}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
                        {props.lengthKm ? `${Number(props.lengthKm).toLocaleString()}km` : ""}
                      </span>
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          status === "operational"
                            ? "bg-emerald-500"
                            : status === "planned"
                              ? "bg-slate-400"
                              : status === "under_construction"
                                ? "bg-amber-500"
                                : "bg-red-500"
                        }`}
                        title={status.replace("_", " ")}
                      />
                      {/* Expand toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedRouteId(isExpanded ? null : (props.id as string));
                        }}
                        className="text-muted-foreground shrink-0 rounded p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </button>
                      {/* Action buttons */}
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        {onEditRoute && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditRoute(props.id as string);
                            }}
                            className="text-muted-foreground rounded p-1 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-500/10"
                            title="Edit route path"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this route?")) {
                              deleteRoute.mutate({
                                id: props.id as string,
                                countryId,
                              });
                            }
                          }}
                          disabled={deleteRoute.isPending}
                          className="text-muted-foreground rounded p-1 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/10"
                          title="Delete route"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-border ml-4 space-y-1 border-l py-1.5 pl-3 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Gauge className="h-3 w-3" /> Length
                          </span>
                          <span className="font-medium tabular-nums">
                            {props.lengthKm ? `${Number(props.lengthKm).toLocaleString()} km` : "—"}
                          </span>
                        </div>
                        {props.terrainDifficulty != null && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Mountain className="h-3 w-3" /> Terrain
                            </span>
                            <div className="flex items-center gap-1">
                              <div className="bg-muted h-1 w-12 overflow-hidden rounded-full">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.round(Number(props.terrainDifficulty) * 100)}%`,
                                    backgroundColor:
                                      Number(props.terrainDifficulty) > 0.7
                                        ? "#ef4444"
                                        : Number(props.terrainDifficulty) > 0.4
                                          ? "#f59e0b"
                                          : "#22c55e",
                                  }}
                                />
                              </div>
                              <span className="tabular-nums">
                                {Math.round(Number(props.terrainDifficulty) * 100)}%
                              </span>
                            </div>
                          </div>
                        )}
                        {props.costBillion && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Cost</span>
                            <span className="font-medium tabular-nums">
                              {Number(props.costBillion).toFixed(2)}B
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Status</span>
                          <button
                            onClick={() => {
                              const newStatus =
                                status === "operational"
                                  ? "abandoned"
                                  : status === "abandoned"
                                    ? "planned"
                                    : status === "planned"
                                      ? "under_construction"
                                      : "operational";
                              updateRoute.mutate({
                                id: props.id as string,
                                countryId,
                                status: newStatus as any,
                              });
                            }}
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize hover:opacity-80"
                            style={{
                              backgroundColor:
                                status === "operational"
                                  ? "#dcfce7"
                                  : status === "planned"
                                    ? "#f1f5f9"
                                    : status === "under_construction"
                                      ? "#fef3c7"
                                      : "#fee2e2",
                              color:
                                status === "operational"
                                  ? "#166534"
                                  : status === "planned"
                                    ? "#475569"
                                    : status === "under_construction"
                                      ? "#92400e"
                                      : "#991b1b",
                            }}
                            title="Click to cycle status"
                          >
                            {status.replace("_", " ")}
                          </button>
                        </div>

                        {/* ── Stops Editor ── */}
                        <StopsEditor
                          routeId={props.id as string}
                          countryId={countryId}
                          stops={(props.stops as Array<{
                            cityId: string;
                            name: string;
                            coordinates: [number, number];
                            order: number;
                          }>) ?? []}
                          onSave={(stops) =>
                            updateRoute.mutate({ id: props.id as string, countryId, stops })
                          }
                          isSaving={updateRoute.isPending}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          DRAW TAB — Manual route drawing controls
         ═══════════════════════════════════════════════════════════════ */}
      {tab === "draw" && (
        <div className="space-y-3">
          {routeWaypoints.length > 0 ? (
            <div className="border-primary/20 bg-primary/5 space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <h4 className="text-primary text-xs font-semibold">Drawing Route</h4>
                <span className="text-muted-foreground bg-background border-border rounded border px-1.5 py-0.5 text-[10px]">
                  {routeWaypoints.length} points
                </span>
              </div>

              <div className="space-y-2">
                <label className="text-muted-foreground block text-[11px] font-medium">
                  Route Name
                </label>
                <input
                  type="text"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="e.g. Route 66, Trans-Valley..."
                  className="border-border bg-background text-foreground focus:border-primary w-full rounded border px-2 py-1 text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-muted-foreground block text-[11px] font-medium">
                  Route Type
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ROUTE_TYPES.map((rt) => {
                    const isSelected = manualRouteType === rt.value;
                    return (
                      <button
                        key={rt.value}
                        type="button"
                        onClick={() => setManualRouteType(rt.value)}
                        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: rt.color }}
                        />
                        {rt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {manualError && (
                <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-600">
                  {manualError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={undoLastWaypoint}
                  className="border-border bg-background text-foreground hover:bg-accent flex-1 rounded border py-1 text-xs"
                >
                  Undo Point
                </button>
                <button
                  type="button"
                  onClick={clearRouteWaypoints}
                  className="border-border bg-background hover:bg-red-55 flex-1 rounded border py-1 text-xs text-red-600"
                >
                  Clear
                </button>
              </div>

              <button
                type="button"
                disabled={routeWaypoints.length < 2 || isSavingManual}
                onClick={async () => {
                  if (routeWaypoints.length < 2 || !finishRoute) return;
                  setIsSavingManual(true);
                  setManualError(null);
                  try {
                    await finishRoute(manualRouteType, routeName.trim() || undefined);
                    setRouteName("");
                  } catch (e: any) {
                    setManualError(e.message || "Failed to save route");
                  } finally {
                    setIsSavingManual(false);
                  }
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {isSavingManual ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {isSavingManual
                  ? "Saving Route..."
                  : routeWaypoints.length < 2
                    ? "Click Map to Place Points"
                    : "Save Route"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-400">
                Click on the map to start placing route waypoints. Routes snap to nearby cities and
                hubs automatically.
              </div>
              <div className="space-y-2">
                <label className="text-muted-foreground block text-[11px] font-medium">
                  Route Type (pre-select)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ROUTE_TYPES.map((rt) => {
                    const isSelected = manualRouteType === rt.value;
                    return (
                      <button
                        key={rt.value}
                        type="button"
                        onClick={() => setManualRouteType(rt.value)}
                        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: rt.color }}
                        />
                        {rt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          GENERATE TAB — Procedural route generation
         ═══════════════════════════════════════════════════════════════ */}
      {tab === "generate" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            {ROUTE_TYPES.map((rt) => {
              const isGeneratable = (GENERATABLE_ROUTE_TYPES as readonly string[]).includes(
                rt.value
              );
              const isSelected = selectedTypes.includes(rt.value);
              return (
                <button
                  key={rt.value}
                  disabled={!isGeneratable}
                  onClick={() =>
                    setSelectedTypes((prev) =>
                      isSelected ? prev.filter((t) => t !== rt.value) : [...prev, rt.value]
                    )
                  }
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    !isGeneratable
                      ? "cursor-not-allowed border-dashed bg-slate-900/10 text-slate-500 opacity-40"
                      : isSelected
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: rt.color }} />
                  {rt.label}{" "}
                  {!isGeneratable && <span className="text-[9px] opacity-70">(Manual)</span>}
                </button>
              );
            })}
          </div>

          <label className="text-foreground/80 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={clearExisting}
              onChange={(e) => setClearExisting(e.target.checked)}
              className="border-border text-primary focus:ring-primary rounded"
            />
            Clear existing routes first
          </label>

          {generateRoutes.isSuccess && generateRoutes.data && (
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Generated {generateRoutes.data.routesCreated} routes (
              {generateRoutes.data.totalLengthKm} km)
            </div>
          )}

          {generateRoutes.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {generateRoutes.error.message}
            </div>
          )}

          {generateNotice && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {generateNotice}
            </div>
          )}

          <button
            onClick={async () => {
              if (!countryId || selectedTypes.length === 0) return;
              const generatable = selectedTypes.filter((t) =>
                (GENERATABLE_ROUTE_TYPES as readonly string[]).includes(t)
              );
              const manualOnly = selectedTypes.filter(
                (t) => !(GENERATABLE_ROUTE_TYPES as readonly string[]).includes(t)
              );
              if (generatable.length === 0) {
                setGenerateNotice(
                  "These route types must be drawn manually — only rail, highway, road, shipping, canal, air, and ferry can be generated."
                );
                return;
              }
              setGenerateNotice(
                manualOnly.length > 0
                  ? "Generating only the supported types; pipeline/power/fiber/military routes must be drawn manually."
                  : null
              );
              try {
                await generateRoutes.mutateAsync({
                  countryId,
                  routeTypes: generatable,
                  clearExisting,
                });
              } catch {
                /* shown via state */
              }
            }}
            disabled={selectedTypes.length === 0 || generateRoutes.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {generateRoutes.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {generateRoutes.isPending ? "Generating..." : "Generate Routes"}
          </button>
        </div>
      )}

      <button
        onClick={onCancel}
        className="border-border text-foreground/80 hover:bg-accent w-full rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
      >
        Done
      </button>
    </div>
  );
});

// ── Stops Editor ──────────────────────────────────────────────────────────────

interface Stop {
  cityId: string;
  name: string;
  coordinates: [number, number];
  order: number;
}

interface StopsEditorProps {
  routeId: string;
  countryId: string;
  stops: Stop[];
  onSave: (stops: Stop[]) => void;
  isSaving: boolean;
}

/**
 * Inline stop list editor: add free-text stop names, reorder via drag handles,
 * and remove individual stops. Persists via updateRoute mutation.
 */
function StopsEditor({ stops: initialStops, onSave, isSaving }: StopsEditorProps) {
  const [localStops, setLocalStops] = React.useState<Stop[]>(() => initialStops);
  const [newName, setNewName] = React.useState("");
  const [isDirty, setIsDirty] = React.useState(false);
  const dragIdx = React.useRef<number | null>(null);

  // Sync when external data updates (e.g. after save)
  React.useEffect(() => {
    setLocalStops(initialStops);
    setIsDirty(false);
  }, [initialStops]);

  const addStop = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const next: Stop[] = [
      ...localStops,
      {
        cityId: `manual-${Date.now()}`,
        name: trimmed,
        coordinates: [0, 0],
        order: localStops.length,
      },
    ];
    setLocalStops(next);
    setIsDirty(true);
    setNewName("");
  };

  const removeStop = (idx: number) => {
    const next = localStops
      .filter((_, i) => i !== idx)
      .map((s, i) => ({ ...s, order: i }));
    setLocalStops(next);
    setIsDirty(true);
  };

  const onDragStart = (idx: number) => {
    dragIdx.current = idx;
  };

  const onDragOver = (e: React.DragEvent, overIdx: number) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === overIdx) return;
    const next = [...localStops];
    const [moved] = next.splice(from, 1);
    next.splice(overIdx, 0, moved!);
    dragIdx.current = overIdx;
    setLocalStops(next.map((s, i) => ({ ...s, order: i })));
    setIsDirty(true);
  };

  if (localStops.length === 0 && !isDirty) {
    return (
      <div className="mt-1 pt-1">
        <div className="text-muted-foreground mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider">
          Stops
        </div>
        <div className="flex gap-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addStop()}
            placeholder="Add stop name..."
            className="border-border bg-background text-foreground min-w-0 flex-1 rounded border px-1.5 py-0.5 text-[11px] focus:outline-none"
          />
          <button
            onClick={addStop}
            className="border-border hover:bg-accent rounded border p-1"
            title="Add stop"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 pt-1">
      <div className="text-muted-foreground mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider">
        Stops ({localStops.length})
      </div>
      <div className="space-y-0.5">
        {localStops.map((stop, idx) => (
          <div
            key={`${stop.cityId}-${idx}`}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragOver={(e) => onDragOver(e, idx)}
            className="bg-muted flex cursor-grab items-center gap-1 rounded px-1.5 py-0.5 active:cursor-grabbing"
          >
            <GripVertical className="text-muted-foreground h-3 w-3 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-[11px]">{stop.name}</span>
            <button
              onClick={() => removeStop(idx)}
              className="text-muted-foreground hover:text-red-500 shrink-0"
              title="Remove stop"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addStop()}
          placeholder="Add stop..."
          className="border-border bg-background text-foreground min-w-0 flex-1 rounded border px-1.5 py-0.5 text-[11px] focus:outline-none"
        />
        <button
          onClick={addStop}
          className="border-border hover:bg-accent rounded border p-1"
          title="Add stop"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      {isDirty && (
        <button
          onClick={() => onSave(localStops)}
          disabled={isSaving}
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-1.5 w-full rounded py-0.5 text-[11px] font-medium disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save Stops"}
        </button>
      )}
    </div>
  );
}

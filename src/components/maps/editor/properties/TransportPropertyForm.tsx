// @ts-nocheck
"use client";

import React, { useState } from "react";
import { Loader2, CheckCircle2, Sparkles, Trash2, Pencil } from "lucide-react";
import { api } from "~/trpc/react";

const ROUTE_TYPES = [
  { value: "rail", label: "Rail", color: "#374151" },
  { value: "highway", label: "Highway", color: "#f97316" },
  { value: "road", label: "Road", color: "#92400e" },
  { value: "shipping_lane", label: "Shipping Lane", color: "#3b82f6" },
  { value: "canal", label: "Canal", color: "#06b6d4" },
] as const;

interface TransportPropertyFormProps {
  countryId?: string;
  onCancel: () => void;
  routeWaypoints?: [number, number][];
  finishRoute?: (routeType?: string, name?: string) => Promise<void>;
  undoLastWaypoint?: () => void;
  clearRouteWaypoints?: () => void;
  selectedRouteId?: string | null;
  onSelectRouteId?: (id: string | null) => void;
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
}: TransportPropertyFormProps) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["rail", "highway"]);
  const [clearExisting, setClearExisting] = useState(false);
  const [tab, setTab] = useState<"routes" | "generate">("routes");

  const [routeName, setRouteName] = useState("");
  const [manualRouteType, setManualRouteType] = useState<string>("road");
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

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

  const routes = routeData?.features ?? [];

  return (
    <div className="space-y-3">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
        Transport Network
      </h3>

      {routeWaypoints.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-primary">Drawing Manual Route</h4>
            <span className="text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">
              {routeWaypoints.length} points
            </span>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-medium text-muted-foreground">
              Route Name
            </label>
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="e.g. Route 66, Trans-Valley..."
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-medium text-muted-foreground">
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
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: rt.color }} />
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
              className="flex-1 rounded border border-border bg-background py-1 text-xs text-foreground hover:bg-accent"
            >
              Undo Point
            </button>
            <button
              type="button"
              onClick={clearRouteWaypoints}
              className="flex-1 rounded border border-border bg-background py-1 text-xs text-red-600 hover:bg-red-55"
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
            {isSavingManual ? "Saving Route..." : routeWaypoints.length < 2 ? "Draw on Map (Min 2 points)" : "Save Route"}
          </button>
        </div>
      ) : (
        <>
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
            </div>
          )}

          {/* Tab switcher */}
          <div className="bg-muted flex gap-1 rounded-lg p-0.5">
            <button
              onClick={() => setTab("routes")}
              className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                tab === "routes"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Routes ({routes.length})
            </button>
            <button
              onClick={() => setTab("generate")}
              className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                tab === "generate"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Generate
            </button>
          </div>

          {/* Routes tab */}
          {tab === "routes" && (
            <div className="space-y-1">
              {routes.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-xs">
                  No routes yet. Use the Generate tab to create routes.
                </p>
              ) : (
                <div className="max-h-60 space-y-0.5 overflow-y-auto">
                  {routes.map((route) => {
                    const props = route.properties as Record<string, unknown>;
                    const routeType = ROUTE_TYPES.find((r) => r.value === props.routeType);
                    const status = (props.status as string) ?? "operational";
                    const isSelected = props.id === selectedRouteId;

                    return (
                      <div
                        key={props.id as string}
                        onClick={() => {
                          if (onSelectRouteId) {
                            onSelectRouteId(isSelected ? null : (props.id as string));
                          }
                        }}
                        className={`group cursor-pointer flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
                          isSelected
                            ? "bg-primary/10 border-l-2 border-primary pl-1.5"
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
                        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
                                status: newStatus as
                                  | "planned"
                                  | "under_construction"
                                  | "operational"
                                  | "abandoned",
                              });
                            }}
                            className="text-muted-foreground rounded p-1 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-500/10"
                            title="Cycle status"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete this route?`)) {
                                deleteRoute.mutate({ id: props.id as string, countryId });
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
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Generate tab */}
          {tab === "generate" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1.5">
                {ROUTE_TYPES.map((rt) => {
                  const isSelected = selectedTypes.includes(rt.value);
                  return (
                    <button
                      key={rt.value}
                      onClick={() =>
                        setSelectedTypes((prev) =>
                          isSelected ? prev.filter((t) => t !== rt.value) : [...prev, rt.value]
                        )
                      }
                      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: rt.color }} />
                      {rt.label}
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

              <button
                onClick={async () => {
                  if (!countryId || selectedTypes.length === 0) return;
                  try {
                    await generateRoutes.mutateAsync({
                      countryId,
                      routeTypes: selectedTypes,
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
        </>
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

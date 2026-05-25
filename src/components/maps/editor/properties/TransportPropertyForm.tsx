"use client";

import React, { useState } from "react";
import { Loader2, CheckCircle2, Sparkles, Trash2, Pencil } from "lucide-react";
import { api } from "~/trpc/react";

const ROUTE_TYPES = [
  { value: "rail", label: "Rail", color: "#6366f1" },
  { value: "highway", label: "Highway", color: "#f59e0b" },
  { value: "shipping", label: "Shipping Lane", color: "#06b6d4" },
  { value: "air", label: "Air Route", color: "#a855f7" },
] as const;

interface TransportPropertyFormProps {
  countryId?: string;
  onCancel: () => void;
}

export const TransportPropertyForm = React.memo(function TransportPropertyForm({
  countryId,
  onCancel,
}: TransportPropertyFormProps) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["rail", "highway"]);
  const [clearExisting, setClearExisting] = useState(false);
  const [tab, setTab] = useState<"routes" | "generate">("routes");

  const utils = api.useUtils();

  const generateRoutes = api.transport.generateRoutes.useMutation({
    onSuccess: () => {
      void utils.transport.getCountryRoutes.invalidate();
      void utils.transport.getAllRoutesGeoJSON.invalidate();
      void utils.transport.getTransportStats.invalidate();
    },
  });

  const deleteRoute = api.transport.deleteRoute.useMutation({
    onSuccess: () => {
      void utils.transport.getCountryRoutes.invalidate();
      void utils.transport.getAllRoutesGeoJSON.invalidate();
      void utils.transport.getTransportStats.invalidate();
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

                return (
                  <div
                    key={props.id as string}
                    className="group hover:bg-accent flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs"
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

      <button
        onClick={onCancel}
        className="border-border text-foreground/80 hover:bg-accent w-full rounded-lg border px-3 py-1.5 text-sm"
      >
        Done
      </button>
    </div>
  );
});

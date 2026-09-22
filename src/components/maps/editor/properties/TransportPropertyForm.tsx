"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Sparks as Sparkles, PathArrow as RouteIcon, MapPin, Xmark as X } from "iconoir-react";
import { api } from "~/trpc/react";
import { RouteFilterList } from "./transport/RouteFilterList";
import { RouteWaypointList } from "./transport/RouteWaypointList";
import { ProceduralRouteGenerator, type GeneratableRouteType } from "./transport/ProceduralRouteGenerator";
import { RouteNodeInspector } from "./transport/RouteNodeInspector";

interface TransportPropertyFormProps {
  countryId?: string;
  onCancel: () => void;
  routeWaypoints?: [number, number][];
  finishRoute?: (routeType?: string, name?: string) => Promise<void>;
  undoLastWaypoint?: () => void;
  clearRouteWaypoints?: () => void;
  selectedRouteId?: string | null;
  onSelectRouteId?: (id: string | null) => void;
  onEditRoute?: (routeId: string) => void;
  editingRouteId?: string | null;
  editingRouteVertices?: [number, number][];
  onRouteVerticesUpdate?: (vertices: [number, number][]) => void;
  onRouteEditCommit?: () => Promise<void> | void;
  onRouteEditCancel?: () => void;
  onFlyToCoords?: (coord: [number, number]) => void;
}

export type RouteType =
  | "rail"
  | "highway"
  | "road"
  | "shipping_lane"
  | "canal"
  | "air_corridor"
  | "ferry"
  | "pipeline"
  | "power_grid";

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
  editingRouteId,
  editingRouteVertices,
  onRouteVerticesUpdate,
  onRouteEditCommit,
  onRouteEditCancel,
  onFlyToCoords,
}: TransportPropertyFormProps) {
  const [userTab, setUserTab] = useState<"routes" | "draw" | "generate" | null>(null);
  const tab = userTab ?? (routeWaypoints.length > 0 ? "draw" : "routes");

  // Generate state
  const [selectedTypes, setSelectedTypes] = useState<GeneratableRouteType[]>(["rail", "highway"]);
  const [clearExisting, setClearExisting] = useState(false);
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);

  // Draw state
  const [routeName, setRouteName] = useState("");
  const [manualRouteType, setManualRouteType] = useState<string>("road");
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Routes filter state
  const [searchQuery, setSearchQuery] = useState("");

  const utils = api.useUtils();

  const generateRoutes = api.transport.generateRoutes.useMutation({
    onSuccess: () => {
      void utils.transport.getCountryRoutes.invalidate();
      void utils.transport.getAllRoutesGeoJSON.invalidate();
      void utils.transport.getTransportStats.invalidate();
      setGenerateNotice("Routes generated successfully!");
      setUserTab("routes");
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

  const { data: countryRouteData, isLoading: countryLoading } =
    api.transport.getCountryRoutes.useQuery(
      { countryId: countryId! },
      { enabled: !!countryId }
    );

  const { data: worldRouteData, isLoading: worldLoading } =
    api.transport.getAllRoutesGeoJSON.useQuery({}, { enabled: !countryId });

  const routeData = countryId ? countryRouteData : worldRouteData;
  const routesLoading = countryId ? countryLoading : worldLoading;

  const routes = useMemo(() => {
    return (routeData?.features ?? []).map((f) => {
      const props = (f.properties ?? {}) as Record<string, unknown>;
      return {
        id: String(props.id ?? ""),
        name: String(props.name || "Unnamed Route"),
        type: String(props.routeType || "road"),
        status: String(props.status || "active"),
        lengthKm: typeof props.lengthKm === "number" ? props.lengthKm : undefined,
        speedKmh: typeof props.speedKmh === "number" ? props.speedKmh : undefined,
        properties: props,
        countryId: (typeof props.countryId === "string" ? props.countryId : undefined) ?? countryId,
      };
    });
  }, [routeData, countryId]);

  const handleFinishRoute = useCallback(
    async (type?: string, name?: string) => {
      if (!finishRoute) return;
      try {
        setIsSavingManual(true);
        setManualError(null);
        await finishRoute(type, name);
        setRouteName("");
        setUserTab("routes");
      } catch (err) {
        setManualError(err instanceof Error ? err.message : "Failed to commit route");
      } finally {
        setIsSavingManual(false);
      }
    },
    [finishRoute]
  );

  const handleGenerate = useCallback(() => {
    if (!countryId) return;
    generateRoutes.mutate({
      countryId,
      routeTypes: selectedTypes,
      clearExisting,
    });
  }, [countryId, selectedTypes, clearExisting, generateRoutes]);

  const activeRouteId = editingRouteId || selectedRouteId;

  if (activeRouteId) {
    return (
      <div className="bg-background text-foreground flex h-full flex-col">
        {/* Header */}
        <div className="border-border/40 flex items-center justify-between border-b px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <RouteIcon className="text-primary h-4 w-4" />
            <span>Edit Route Path</span>
          </div>
          <button
            onClick={() => {
              onRouteEditCancel?.();
              onSelectRouteId?.(null);
            }}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1 transition active:scale-[0.98]"
            title="Close edit mode"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <RouteNodeInspector
            routeId={activeRouteId}
            countryId={countryId}
            editingRouteVertices={editingRouteVertices}
            onRouteVerticesUpdate={onRouteVerticesUpdate}
            onCommit={onRouteEditCommit}
            onCancel={() => {
              onRouteEditCancel?.();
              onSelectRouteId?.(null);
            }}
            onDeleteRoute={(id) => {
              const targetCountryId = routes.find((r) => r.id === id)?.countryId ?? countryId;
              if (targetCountryId) {
                deleteRoute.mutate({ id, countryId: targetCountryId });
              }
            }}
            onFlyToCoords={onFlyToCoords}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground flex h-full flex-col">
      {/* Header */}
      <div className="border-border/40 flex items-center justify-between border-b px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <RouteIcon className="text-primary h-4 w-4" />
          <span>Transport Network</span>
        </div>
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="border-border/40 bg-muted/20 flex border-b p-1">
        <button
          onClick={() => setUserTab("routes")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition ${
            tab === "routes"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <RouteIcon className="h-3.5 w-3.5" />
          <span>Routes ({routes.length})</span>
        </button>
        <button
          onClick={() => setUserTab("draw")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition ${
            tab === "draw"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MapPin className="h-3.5 w-3.5" />
          <span>Draw ({routeWaypoints.length})</span>
        </button>
        <button
          onClick={() => setUserTab("generate")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition ${
            tab === "generate"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Generate</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {tab === "routes" && (
          <RouteFilterList
            routes={routes}
            isLoading={routesLoading}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedRouteId={selectedRouteId}
            onSelectRouteId={onSelectRouteId}
            onEditRoute={onEditRoute}
            onDeleteRoute={(id) => {
              const targetCountryId = routes.find((r) => r.id === id)?.countryId ?? countryId;
              if (targetCountryId) {
                deleteRoute.mutate({ id, countryId: targetCountryId });
              }
            }}
          />
        )}
        {tab === "draw" && (
          <RouteWaypointList
            routeWaypoints={routeWaypoints}
            routeName={routeName}
            setRouteName={setRouteName}
            manualRouteType={manualRouteType}
            setManualRouteType={setManualRouteType}
            isSavingManual={isSavingManual}
            manualError={manualError}
            onFinishRoute={handleFinishRoute}
            onUndoWaypoint={undoLastWaypoint}
            onClearWaypoints={clearRouteWaypoints}
          />
        )}
        {tab === "generate" && (
          <ProceduralRouteGenerator
            countryId={countryId}
            selectedTypes={selectedTypes}
            setSelectedTypes={setSelectedTypes}
            clearExisting={clearExisting}
            setClearExisting={setClearExisting}
            generateNotice={generateNotice}
            setGenerateNotice={setGenerateNotice}
            isGenerating={generateRoutes.isPending}
            onGenerate={handleGenerate}
          />
        )}
      </div>
    </div>
  );
});

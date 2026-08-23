"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Sparks as Sparkles, Navigator as RouteIcon, MapPin, Xmark as X } from "iconoir-react";
import { api } from "~/trpc/react";
import { RouteFilterList } from "./transport/RouteFilterList";
import { RouteWaypointList } from "./transport/RouteWaypointList";
import { ProceduralRouteGenerator } from "./transport/ProceduralRouteGenerator";

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
  const [tab, setTab] = useState<"routes" | "draw" | "generate">(
    routeWaypoints.length > 0 ? "draw" : "routes"
  );

  // Generate state
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["rail", "highway"]);
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
      setTab("routes");
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

  const { data: routeData, isLoading: routesLoading } = api.transport.getCountryRoutes.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId }
  );

  React.useEffect(() => {
    if (routeWaypoints.length > 0 && tab !== "draw") {
      setTab("draw");
    }
  }, [routeWaypoints.length, tab]);

  const routes = useMemo(() => {
    return (routeData?.features ?? []).map((f: any) => ({
      id: f.id,
      name: f.properties?.name || "Unnamed Route",
      type: f.properties?.routeType || "road",
      status: f.properties?.status || "active",
      lengthKm: f.properties?.lengthKm,
      elevationGainM: f.properties?.elevationGainM,
    }));
  }, [routeData]);

  const handleFinishRoute = useCallback(
    async (type?: string, name?: string) => {
      if (!finishRoute) return;
      try {
        setIsSavingManual(true);
        setManualError(null);
        await finishRoute(type, name);
        setRouteName("");
        setTab("routes");
      } catch (err: any) {
        setManualError(err?.message || "Failed to commit route");
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
      routeTypes: selectedTypes as any,
      clearExisting,
    });
  }, [countryId, selectedTypes, clearExisting, generateRoutes]);

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2.5">
        <div className="flex items-center gap-1.5 font-semibold text-xs">
          <RouteIcon className="h-4 w-4 text-primary" />
          <span>Transport Network</span>
        </div>
        <button
          onClick={onCancel}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/40 bg-muted/20 p-1">
        <button
          onClick={() => setTab("routes")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition ${
            tab === "routes"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <RouteIcon className="h-3.5 w-3.5" />
          <span>Routes ({routes.length})</span>
        </button>
        <button
          onClick={() => setTab("draw")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition ${
            tab === "draw"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MapPin className="h-3.5 w-3.5" />
          <span>Draw ({routeWaypoints.length})</span>
        </button>
        <button
          onClick={() => setTab("generate")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition ${
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
            onDeleteRoute={(id) => countryId && deleteRoute.mutate({ id, countryId })}
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

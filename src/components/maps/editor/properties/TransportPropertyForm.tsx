"use client";

import React, { useState, useMemo } from "react";
import { NetworkLeft, PathArrow as RouteIcon, MapPin, Xmark as X } from "iconoir-react";
import { api } from "~/trpc/react";
import { RouteFilterList } from "./transport/RouteFilterList";
import { RouteWaypointList } from "./transport/RouteWaypointList";
import {
  ProceduralRouteGenerator,
  type GeneratableRouteType,
} from "./transport/ProceduralRouteGenerator";
import { RouteNodeInspector } from "./transport/RouteNodeInspector";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";

export interface TransportPropertyFormProps {
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

function PanelHeader({
  title,
  closeLabel,
  closeTitle,
  onClose,
  closeClassName,
  iconClassName,
}: {
  title: string;
  closeLabel: string;
  closeTitle?: string;
  onClose: () => void;
  closeClassName: string;
  iconClassName: string;
}) {
  return (
    <div className="border-separator flex items-center justify-between border-b px-3 py-2">
      <div className="text-caption flex items-center gap-2 font-semibold">
        <RouteIcon className="text-tint h-4 w-4" />
        <span>{title}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        title={closeTitle}
        aria-label={closeLabel}
        className={closeClassName}
      >
        <X className={iconClassName} />
      </Button>
    </div>
  );
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
  editingRouteId,
  editingRouteVertices,
  onRouteVerticesUpdate,
  onRouteEditCommit,
  onRouteEditCancel,
  onFlyToCoords,
}: TransportPropertyFormProps) {
  const [userTab, setUserTab] = useState<"routes" | "draw" | "generate" | null>(null);
  const tab = userTab ?? (routeWaypoints.length > 0 ? "draw" : "routes");

  const [selectedTypes, setSelectedTypes] = useState<GeneratableRouteType[]>(["rail", "highway"]);
  const [clearExisting, setClearExisting] = useState(false);
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);

  const [routeName, setRouteName] = useState("");
  const [manualRouteType, setManualRouteType] = useState<string>("road");
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");

  const utils = api.useUtils();

  const invalidateRoutes = () => {
    void utils.transport.getCountryRoutes.invalidate();
    void utils.transport.getAllRoutesGeoJSON.invalidate();
    void utils.transport.getTransportStats.invalidate();
  };

  const generateRoutes = api.transport.generateRoutes.useMutation({
    onSuccess: () => {
      invalidateRoutes();
      setGenerateNotice("Routes generated successfully!");
      setUserTab("routes");
    },
  });

  const deleteRoute = api.transport.deleteRoute.useMutation({
    onSuccess: (_, variables) => {
      invalidateRoutes();
      if (selectedRouteId === variables.id) onSelectRouteId?.(null);
    },
  });

  const { data: countryRouteData, isLoading: countryLoading } =
    api.transport.getCountryRoutes.useQuery({ countryId: countryId! }, { enabled: !!countryId });

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

  const handleFinishRoute = async (type?: string, name?: string) => {
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
  };

  const handleGenerate = () => {
    if (countryId) generateRoutes.mutate({ countryId, routeTypes: selectedTypes, clearExisting });
  };

  const handleDeleteRoute = (id: string) => {
    const targetCountryId = routes.find((r) => r.id === id)?.countryId ?? countryId;
    if (targetCountryId) deleteRoute.mutate({ id, countryId: targetCountryId });
  };

  const activeRouteId = editingRouteId || selectedRouteId;
  const closeEdit = () => {
    onRouteEditCancel?.();
    onSelectRouteId?.(null);
  };

  if (activeRouteId) {
    return (
      <div className="bg-surface text-label flex h-full flex-col">
        <PanelHeader
          title="Edit route path"
          closeLabel="Close edit mode"
          onClose={closeEdit}
          closeTitle="Close edit mode"
          closeClassName="text-label-secondary hover:bg-fill-3 hover:text-label rounded-control-sm size-6"
          iconClassName="h-3.5 w-3.5"
        />

        <div className="flex-1 overflow-y-auto p-3">
          <RouteNodeInspector
            routeId={activeRouteId}
            countryId={countryId}
            editingRouteVertices={editingRouteVertices}
            onRouteVerticesUpdate={onRouteVerticesUpdate}
            onCommit={onRouteEditCommit}
            onCancel={closeEdit}
            onDeleteRoute={handleDeleteRoute}
            onFlyToCoords={onFlyToCoords}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface text-label flex h-full flex-col">
      <PanelHeader
        title="Transport network"
        closeLabel="Close transport network"
        onClose={onCancel}
        closeClassName="text-label-secondary"
        iconClassName="size-3.5"
      />

      <div className="border-separator border-b p-2">
        <SegmentedControl
          aria-label="Transport network"
          asTabs
          fullWidth
          size="sm"
          value={tab}
          onValueChange={(v) => setUserTab(v as "routes" | "draw" | "generate")}
          options={[
            {
              value: "routes",
              label: `Routes (${routes.length})`,
              icon: <RouteIcon aria-hidden />,
            },
            {
              value: "draw",
              label: `Draw (${routeWaypoints.length})`,
              icon: <MapPin aria-hidden />,
            },
            { value: "generate", label: "Generate", icon: <NetworkLeft aria-hidden /> },
          ]}
        />
      </div>

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
            onDeleteRoute={handleDeleteRoute}
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

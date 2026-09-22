"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  MapPin,
  Hexagon,
  PathArrow as Route,
  Bank as Landmark,
  ModernTv as Mountain,
  SeaWaves as Waves,
  Droplet,
  NavArrowDown as ChevronDown,
  NavArrowUp as ChevronUp,
  Xmark as Close,
  Check,
  OpenNewWindow as ExternalLink,
  Dashboard as Gauge,
  Clock,
} from "iconoir-react";
import type { EditorFeature } from "~/hooks/useMapEditor";
import { ScrubbableCoordinateInput } from "./ScrubbableCoordinateInput";
import { GeometryActionsBar } from "./GeometryActionsBar";
import { WikiLinkWizard } from "../../WikiLinkWizard";
import { RiverHydrologySection } from "./RiverHydrologySection";
import { LakeHydrologySection } from "./LakeHydrologySection";
import { ROUTE_STYLES, ROUTE_TYPE_KEYS } from "~/lib/maps/map-config";
import {
  calculateRouteTravelTime,
  getSpeedPresets,
  resolveRouteBaseSpeed,
} from "~/lib/economy/travel-time";
import { api } from "~/trpc/react";

export interface FeaturePropertyUpdates {
  name?: string;
  wikiPageTitle?: string | null;
  cityType?: string;
  population?: number;
  isNationalCapital?: boolean;
  isSubdivisionCapital?: boolean;
  subdivisionId?: string | null;
  type?: string;
  level?: number;
  capital?: string;
  category?: string;
  description?: string;
  elevationMeters?: number;
  routeType?: string;
  status?: "planned" | "under_construction" | "operational" | "abandoned";
  isInternational?: boolean;
  speedKmh?: number;
  speed_kmh?: number;
  [key: string]: string | number | boolean | object | null | undefined;
}

interface FeatureInspectorProps {
  feature: EditorFeature;
  countryId?: string;
  allFeatures?: EditorFeature[];
  countries?: Array<{ id: string; name: string }>;
  onClose?: () => void;
  onUpdateFeature: (updates: FeaturePropertyUpdates) => Promise<void> | void;
  onUpdateCoordinates?: (coords: [number, number]) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onCenter?: () => void;
  onPromoteCapital?: () => void;
  onSnapCoastline?: () => void;
  onReverseRoute?: () => void;
  onEditRoute?: (routeId: string) => void;
  onPathfinderOperation?: (op: "union" | "subtract" | "intersect") => void;
  isPickingLocation?: boolean;
  onTogglePickLocation?: () => void;
  isMutating?: boolean;
}

function getFeatureIcon(type: string) {
  switch (type) {
    case "city":
      return MapPin;
    case "subdivision":
      return Hexagon;
    case "poi":
    case "storyPin":
      return Landmark;
    case "peak":
      return Mountain;
    case "river":
      return Waves;
    case "lake":
      return Droplet;
    case "route":
      return Route;
    default:
      return MapPin;
  }
}

const CITY_TYPES = ["capital", "city", "town", "village", "hamlet", "port", "fortress"];
const SUBDIVISION_LEVELS = [
  { level: 1, label: "Province / State (Tier 1)" },
  { level: 2, label: "Prefecture / District (Tier 2)" },
  { level: 3, label: "County / Municipality (Tier 3)" },
];

export const FeatureInspector = React.memo(function FeatureInspector({
  feature,
  countryId,
  allFeatures = [],
  countries = [],
  onClose,
  onUpdateFeature,
  onUpdateCoordinates,
  onDelete,
  onDuplicate,
  onCenter,
  onPromoteCapital,
  onSnapCoastline,
  onReverseRoute,
  onEditRoute,
  onPathfinderOperation,
  isPickingLocation = false,
  onTogglePickLocation,
  isMutating = false,
}: FeatureInspectorProps) {
  const Icon = getFeatureIcon(feature.type);

  // Form field state
  const [name, setName] = useState(feature.name || "");
  const [wikiPageTitle, setWikiPageTitle] = useState<string | undefined>(
    (feature.properties?.wikiPageTitle as string) || undefined
  );
  const [subdivisionId, setSubdivisionId] = useState<string>(
    (feature.properties?.subdivisionId as string) || ""
  );
  const [cityType, setCityType] = useState<string>(
    (feature.properties?.cityType as string) || "city"
  );
  const [routeType, setRouteType] = useState<string>(
    (feature.properties?.routeType as string) || "road"
  );
  const [routeStatus, setRouteStatus] = useState<string>(
    (feature.properties?.status as string) || "operational"
  );
  const [isInternational, setIsInternational] = useState<boolean>(
    Boolean(feature.properties?.isInternational)
  );
  const [routeSpeed, setRouteSpeed] = useState<number>(() => {
    return resolveRouteBaseSpeed(
      (feature.properties?.routeType as string) || "road",
      feature.properties?.speedKmh as number | undefined,
      feature.properties
    );
  });
  const [subdivisionLevel, setSubdivisionLevel] = useState<number>(
    typeof feature.properties?.level === "number" ? feature.properties.level : 1
  );

  // Accordion card expansion state
  const [openIdentity, setOpenIdentity] = useState(true);
  const [openSpatial, setOpenSpatial] = useState(true);
  const [openWiki, setOpenWiki] = useState(true);
  const [openActions, setOpenActions] = useState(true);

  const routeVertices: [number, number][] = useMemo(() => {
    if (feature.type !== "route" || !feature.geometry) return [];
    const geo = feature.geometry as { type?: string; coordinates?: [number, number][] | [number, number][][] };
    if (geo.type === "LineString" && Array.isArray(geo.coordinates)) {
      return geo.coordinates as [number, number][];
    }
    if (geo.type === "MultiLineString" && Array.isArray(geo.coordinates)) {
      return (geo.coordinates as [number, number][][]).flat();
    }
    return [];
  }, [feature.type, feature.geometry]);

  // Synchronize with external selection updates
  useEffect(() => {
    setName(feature.name || "");
    setWikiPageTitle((feature.properties?.wikiPageTitle as string) || undefined);
    setSubdivisionId((feature.properties?.subdivisionId as string) || "");
    setCityType((feature.properties?.cityType as string) || "city");
    setRouteType((feature.properties?.routeType as string) || "road");
    setRouteStatus((feature.properties?.status as string) || "operational");
    setIsInternational(Boolean(feature.properties?.isInternational));
    setRouteSpeed(
      resolveRouteBaseSpeed(
        (feature.properties?.routeType as string) || "road",
        feature.properties?.speedKmh as number | undefined,
        feature.properties
      )
    );
    setSubdivisionLevel(typeof feature.properties?.level === "number" ? feature.properties.level : 1);
  }, [feature]);

  // Compute live travel time estimation
  const travelTime = useMemo(() => {
    if (feature.type !== "route") return null;
    const lengthKm = typeof feature.properties?.lengthKm === "number" ? feature.properties.lengthKm : 0;
    const terrainDifficulty =
      typeof feature.properties?.terrainDifficulty === "number"
        ? feature.properties.terrainDifficulty
        : 0;
    const stopsCount = Array.isArray(feature.properties?.stops) ? feature.properties.stops.length : 2;

    return calculateRouteTravelTime({
      lengthKm,
      speedKmh: routeSpeed,
      routeType,
      terrainDifficulty,
      stopsCount,
      properties: feature.properties,
    });
  }, [feature.type, feature.properties, routeSpeed, routeType]);

  // Sample elevation and terrain at coordinates
  const coords = feature.coordinates;
  const sampleTerrain = api.countryGeo.sampleTerrainAt.useQuery(
    { lng: coords?.[0] ?? 0, lat: coords?.[1] ?? 0 },
    { enabled: !!coords && coords[0] !== 0 && coords[1] !== 0 }
  );

  // Auto-commit field changes
  const handleNameBlur = useCallback(() => {
    if (name.trim() !== (feature.name || "").trim()) {
      void onUpdateFeature({ name: name.trim() });
    }
  }, [name, feature.name, onUpdateFeature]);

  const handleCityTypeChange = useCallback(
    (newType: string) => {
      setCityType(newType);
      void onUpdateFeature({ cityType: newType, isNationalCapital: newType === "capital" });
    },
    [onUpdateFeature]
  );

  const handleRouteTypeChange = useCallback(
    (newType: string) => {
      setRouteType(newType);
      const newBaseSpeed = resolveRouteBaseSpeed(newType);
      setRouteSpeed(newBaseSpeed);
      void onUpdateFeature({
        routeType: newType,
        speedKmh: newBaseSpeed,
        speed_kmh: newBaseSpeed,
      });
    },
    [onUpdateFeature]
  );

  const handleSpeedChange = useCallback(
    (newSpeed: number) => {
      const clamped = Math.max(5, Math.min(2000, newSpeed));
      setRouteSpeed(clamped);
      void onUpdateFeature({
        speedKmh: clamped,
        speed_kmh: clamped,
      });
    },
    [onUpdateFeature]
  );

  const handleRouteStatusChange = useCallback(
    (newStatus: string) => {
      setRouteStatus(newStatus);
      void onUpdateFeature({ status: newStatus as FeaturePropertyUpdates["status"] });
    },
    [onUpdateFeature]
  );

  const handleInternationalChange = useCallback(
    (val: boolean) => {
      setIsInternational(val);
      void onUpdateFeature({ isInternational: val });
    },
    [onUpdateFeature]
  );

  const handleSubdivisionChange = useCallback(
    (newSubId: string) => {
      setSubdivisionId(newSubId);
      void onUpdateFeature({ subdivisionId: newSubId || null });
    },
    [onUpdateFeature]
  );

  const handleWikiChange = useCallback(
    (newTitle: string | undefined) => {
      setWikiPageTitle(newTitle);
      void onUpdateFeature({ wikiPageTitle: newTitle || null });
    },
    [onUpdateFeature]
  );

  const subdivisions = useMemo(
    () => allFeatures.filter((f) => f.type === "subdivision"),
    [allFeatures]
  );

  return (
    <div className="space-y-3 select-none text-xs">
      {/* Top Header Bar */}
      <div className="border-border/60 bg-muted/20 flex items-center justify-between rounded-xl border p-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-primary/20">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-foreground truncate text-sm font-semibold leading-tight">
                {name || "Untitled Feature"}
              </h3>
            </div>
            <p className="text-muted-foreground/70 truncate text-[11px] capitalize">
              {feature.type === "subdivision" ? "Region" : feature.type}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isMutating ? (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground pr-1">
              <div className="border-muted-foreground/20 border-t-primary h-3 w-3 animate-spin rounded-full border-2" />
              <span>Saving…</span>
            </div>
          ) : (
            <span className="text-muted-foreground/60 flex items-center gap-1 text-[10px] pr-1">
              <Check className="h-3 w-3 text-emerald-500" />
              <span>Saved</span>
            </span>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md p-1 transition-colors"
              title="Deselect"
            >
              <Close className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Accordion Card 1: Details */}
      <div className="border-border/60 bg-muted/10 overflow-hidden rounded-xl border">
        <button
          type="button"
          onClick={() => setOpenIdentity((v) => !v)}
          className="hover:bg-muted/20 flex w-full items-center justify-between px-3 py-2 text-left font-medium transition-colors"
        >
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Details
          </span>
          {openIdentity ? <ChevronUp className="h-3.5 w-3.5 opacity-60" /> : <ChevronDown className="h-3.5 w-3.5 opacity-60" />}
        </button>

        {openIdentity && (
          <div className="border-border/40 space-y-2.5 border-t p-3">
            {/* Feature Name */}
            <div className="space-y-1">
              <span className="text-muted-foreground text-[10px] font-medium">Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameBlur}
                placeholder="e.g. Caphiria"
                className="border-border/60 bg-background text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none"
              />
            </div>

            {/* City: Type selector */}
            {feature.type === "city" && (
              <div className="space-y-1">
                <span className="text-muted-foreground text-[10px] font-medium">Type</span>
                <div className="flex flex-wrap gap-1">
                  {CITY_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleCityTypeChange(t)}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-all active:scale-[0.98] ${
                        cityType === t
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "border-border/60 bg-card/60 text-muted-foreground hover:bg-accent/40 hover:text-foreground border"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Route Settings */}
            {feature.type === "route" && (
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <span className="text-muted-foreground text-[10px] font-medium">Route sub-type</span>
                  <select
                    value={routeType}
                    onChange={(e) => handleRouteTypeChange(e.target.value)}
                    className="border-border/60 bg-background text-foreground focus:border-primary w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none"
                  >
                    {ROUTE_TYPE_KEYS.map((key) => {
                      const style = ROUTE_STYLES[key];
                      return (
                        <option key={key} value={key}>
                          {style?.label ?? key}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground text-[10px] font-medium">Operational status</span>
                  <select
                    value={routeStatus}
                    onChange={(e) => handleRouteStatusChange(e.target.value)}
                    className="border-border/60 bg-background text-foreground focus:border-primary w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none capitalize"
                  >
                    <option value="operational">Operational</option>
                    <option value="under_construction">Under Construction</option>
                    <option value="planned">Planned</option>
                    <option value="abandoned">Abandoned</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={isInternational}
                    onChange={(e) => handleInternationalChange(e.target.checked)}
                    className="border-border/60 h-3.5 w-3.5 rounded text-primary focus:ring-primary/20"
                  />
                  <span className="text-foreground text-xs font-medium">International Corridor</span>
                </label>

                {/* Velocity & Transit Telemetry Card */}
                <div className="space-y-2 rounded-lg border border-border/40 bg-muted/15 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                      <Gauge className="h-3 w-3 text-primary" /> Velocity & Transit
                    </span>
                    {travelTime?.isInstantaneous ? (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                        Light Speed
                      </span>
                    ) : (
                      <span className="text-foreground font-mono text-xs font-bold tabular-nums flex items-center gap-1">
                        <Clock className="h-3 w-3 text-primary opacity-80" />
                        {travelTime?.formattedTime ?? "—"}
                      </span>
                    )}
                  </div>

                  {!travelTime?.isInstantaneous && (
                    <>
                      {/* Speed custom input */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>Design Speed</span>
                          <span className="font-mono tabular-nums font-medium text-foreground">
                            {routeSpeed} km/h
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={5}
                            max={1200}
                            step={5}
                            value={routeSpeed}
                            onChange={(e) => handleSpeedChange(parseInt(e.target.value, 10) || 5)}
                            className="w-24 rounded border border-border/60 bg-background px-2 py-1 text-xs font-mono tabular-nums text-foreground focus:border-primary focus:outline-none"
                          />
                          <span className="text-xs text-muted-foreground">km/h</span>
                        </div>

                        {/* Presets */}
                        {getSpeedPresets(routeType).length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {getSpeedPresets(routeType).map((preset) => (
                              <button
                                key={preset.speed}
                                type="button"
                                onClick={() => handleSpeedChange(preset.speed)}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition active:scale-[0.98] ${
                                  routeSpeed === preset.speed
                                    ? "bg-primary text-primary-foreground shadow-2xs"
                                    : "border border-border/40 bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground"
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Travel summary stats */}
                      <div className="grid grid-cols-2 gap-2 border-t border-border/30 pt-2 text-[10px]">
                        <div>
                          <span className="text-muted-foreground block">Effective Speed</span>
                          <span className="font-mono font-medium text-foreground tabular-nums">
                            {travelTime?.effectiveSpeedKmh} km/h
                          </span>
                          {Boolean(travelTime && travelTime.terrainPenaltyPercent > 0) && (
                            <span className="text-amber-500 block text-[9px] font-medium">
                              -{travelTime?.terrainPenaltyPercent}% terrain drag
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Dwell Overhead</span>
                          <span className="font-mono font-medium text-foreground tabular-nums">
                            {travelTime?.dwellTimeMinutes ? `+${travelTime.dwellTimeMinutes}m stops` : "Continuous"}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {typeof feature.properties?.lengthKm === "number" && (
                  <div className="border-border/40 bg-muted/20 flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs">
                    <span className="text-muted-foreground">Route Length</span>
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {(feature.properties.lengthKm as number).toFixed(1)} km
                    </span>
                  </div>
                )}

                {/* Route Nodes Summary & Direct Map Edit Trigger */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[10px] font-medium">
                      Path Nodes ({routeVertices.length})
                    </span>
                    {onEditRoute && (
                      <button
                        type="button"
                        onClick={() => onEditRoute(feature.id)}
                        className="flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary transition active:scale-[0.98] hover:bg-primary/20"
                      >
                        <Route className="h-3 w-3" />
                        <span>Edit Path on Map</span>
                      </button>
                    )}
                  </div>

                  {routeVertices.length > 0 && (
                    <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border border-border/40 bg-muted/10 p-1.5">
                      {routeVertices.slice(0, 10).map((pt, i) => (
                        <div key={i} className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                          <span>#{i + 1} {i === 0 ? "(Start)" : i === routeVertices.length - 1 ? "(End)" : ""}</span>
                          <span>{pt[0].toFixed(4)}°, {pt[1].toFixed(4)}°</span>
                        </div>
                      ))}
                      {routeVertices.length > 10 && (
                        <div className="text-center text-[9px] text-muted-foreground pt-0.5">
                          + {routeVertices.length - 10} more nodes
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Region: Level */}
            {feature.type === "subdivision" && (
              <div className="space-y-1">
                <span className="text-muted-foreground text-[10px] font-medium">Level</span>
                <select
                  value={subdivisionLevel}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setSubdivisionLevel(val);
                    void onUpdateFeature({ level: val });
                  }}
                  className="border-border/60 bg-background text-foreground focus:border-primary w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none"
                >
                  {SUBDIVISION_LEVELS.map((item) => (
                    <option key={item.level} value={item.level}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Region assignment (for non-subdivisions) */}
            {feature.type !== "subdivision" && subdivisions.length > 0 && (
              <div className="space-y-1">
                <span className="text-muted-foreground text-[10px] font-medium">Region</span>
                <select
                  value={subdivisionId}
                  onChange={(e) => handleSubdivisionChange(e.target.value)}
                  className="border-border/60 bg-background text-foreground focus:border-primary w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none"
                >
                  <option value="">None</option>
                  {subdivisions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.id}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Accordion Card 2: Location & Hydrology */}
      <div className="border-border/60 bg-muted/10 overflow-hidden rounded-xl border">
        <button
          type="button"
          onClick={() => setOpenSpatial((v) => !v)}
          className="hover:bg-muted/20 flex w-full items-center justify-between px-3 py-2 text-left font-medium transition-colors"
        >
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            {feature.type === "river"
              ? "Hydrology & Course"
              : feature.type === "lake"
              ? "Hydrology & Limnology"
              : "Location"}
          </span>
          {openSpatial ? <ChevronUp className="h-3.5 w-3.5 opacity-60" /> : <ChevronDown className="h-3.5 w-3.5 opacity-60" />}
        </button>

        {openSpatial && (
          <div className="border-border/40 space-y-2.5 border-t p-3">
            {feature.type === "river" ? (
              <RiverHydrologySection feature={feature} />
            ) : feature.type === "lake" ? (
              <LakeHydrologySection feature={feature} onUpdateFeature={onUpdateFeature} />
            ) : (
              <>
                {/* Direct Coordinates (for Point features) */}
                {coords && onUpdateCoordinates && (
                  <ScrubbableCoordinateInput
                    coordinates={coords}
                    onChange={onUpdateCoordinates}
                    isPickingLocation={isPickingLocation}
                    onTogglePickLocation={onTogglePickLocation}
                    disabled={isMutating}
                  />
                )}

                {/* Live Elevation & Terrain */}
                {coords && (
                  <div className="border-border/40 bg-card/40 space-y-2 rounded-lg border p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground/70 text-[9px] uppercase tracking-wider">
                        Elevation & Terrain
                      </span>
                      {sampleTerrain.isLoading && (
                        <div className="border-muted-foreground/20 border-t-primary h-2.5 w-2.5 animate-spin rounded-full border-2" />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="border-border/30 bg-muted/20 rounded p-1.5">
                        <span className="text-muted-foreground/70 text-[9px]">Elevation</span>
                        <p className="text-foreground font-mono text-xs font-semibold tabular-nums">
                          {sampleTerrain.data?.midpoint != null
                            ? `${sampleTerrain.data.midpoint.toLocaleString()} m`
                            : "—"}
                        </p>
                      </div>

                      <div className="border-border/30 bg-muted/20 rounded p-1.5">
                        <span className="text-muted-foreground/70 text-[9px]">Terrain zone</span>
                        <p className="text-foreground font-mono text-xs font-semibold">
                          {sampleTerrain.data?.zoneName || "Lowland"}
                        </p>
                      </div>
                    </div>

                    {sampleTerrain.data?.elevationMin != null && sampleTerrain.data?.elevationMax != null && (
                      <div className="border-border/30 bg-muted/20 flex items-center justify-between rounded px-2 py-1 text-[10px]">
                        <span className="text-muted-foreground">Zone range</span>
                        <span className="text-foreground font-mono font-medium">
                          {sampleTerrain.data.elevationMin}m to {sampleTerrain.data.elevationMax}m
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Accordion Card 3: Wiki */}
      <div className="border-border/60 bg-muted/10 overflow-hidden rounded-xl border">
        <button
          type="button"
          onClick={() => setOpenWiki((v) => !v)}
          className="hover:bg-muted/20 flex w-full items-center justify-between px-3 py-2 text-left font-medium transition-colors"
        >
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Wiki article
          </span>
          {openWiki ? <ChevronUp className="h-3.5 w-3.5 opacity-60" /> : <ChevronDown className="h-3.5 w-3.5 opacity-60" />}
        </button>

        {openWiki && (
          <div className="border-border/40 space-y-2.5 border-t p-3">
            <div className="space-y-1">
              <span className="text-muted-foreground text-[10px] font-medium">Article title</span>
              <WikiLinkWizard
                value={wikiPageTitle}
                onChange={handleWikiChange}
                currentCoords={coords}
                placeholder="Search wiki articles…"
              />
            </div>

            {wikiPageTitle && (
              <a
                href={`/wiki/${encodeURIComponent(wikiPageTitle)}`}
                target="_blank"
                rel="noreferrer"
                className="border-border/60 bg-card/60 hover:bg-accent/40 text-foreground flex items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium transition-all active:scale-[0.98]"
              >
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                <span>Open in Wiki</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Accordion Card 4: Actions */}
      <div className="border-border/60 bg-muted/10 overflow-hidden rounded-xl border">
        <button
          type="button"
          onClick={() => setOpenActions((v) => !v)}
          className="hover:bg-muted/20 flex w-full items-center justify-between px-3 py-2 text-left font-medium transition-colors"
        >
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Actions
          </span>
          {openActions ? <ChevronUp className="h-3.5 w-3.5 opacity-60" /> : <ChevronDown className="h-3.5 w-3.5 opacity-60" />}
        </button>

        {openActions && (
          <div className="border-border/40 border-t p-3">
            <GeometryActionsBar
              feature={feature}
              onCenter={onCenter}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onPromoteCapital={onPromoteCapital}
              onSnapCoastline={onSnapCoastline}
              onReverseRoute={onReverseRoute}
              onPathfinderOperation={onPathfinderOperation}
              disabled={isMutating}
            />
          </div>
        )}
      </div>
    </div>
  );
});

"use client";

import { FacetCard } from "~/components/ui/facet-container";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
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
import { Checkbox } from "~/components/ui/checkbox";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";

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
    const geo = feature.geometry as {
      type?: string;
      coordinates?: [number, number][] | [number, number][][];
    };
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
    setSubdivisionLevel(
      typeof feature.properties?.level === "number" ? feature.properties.level : 1
    );
  }, [feature]);

  // Compute live travel time estimation
  const travelTime = useMemo(() => {
    if (feature.type !== "route") return null;
    const lengthKm =
      typeof feature.properties?.lengthKm === "number" ? feature.properties.lengthKm : 0;
    const terrainDifficulty =
      typeof feature.properties?.terrainDifficulty === "number"
        ? feature.properties.terrainDifficulty
        : 0;
    const stopsCount = Array.isArray(feature.properties?.stops)
      ? feature.properties.stops.length
      : 2;

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
    <div className="text-footnote space-y-3 select-none">
      {/* Top Header Bar */}
      <FacetCard className="flex items-center justify-between p-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="bg-tint-fill text-tint ring-tint/20 rounded-control flex h-8 w-8 shrink-0 items-center justify-center ring-1">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-label text-headline truncate leading-tight">
                {name || "Untitled Feature"}
              </h3>
            </div>
            <p className="text-label-secondary text-footnote truncate capitalize">
              {feature.type === "subdivision" ? "Region" : feature.type}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isMutating ? (
            <div className="text-label-secondary text-footnote flex items-center gap-1 pr-1">
              <div className="border-separator border-t-primary h-3 w-3 animate-spin rounded-full border-2" />
              <span>Saving…</span>
            </div>
          ) : (
            <span className="text-label-secondary text-footnote flex items-center gap-1 pr-1">
              <Check className="text-green h-3 w-3" />
              <span>Saved</span>
            </span>
          )}

          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="text-label-secondary h-6 w-6"
              onClick={onClose}
              title="Deselect"
            >
              <Close className="h-4 w-4" />
            </Button>
          )}
        </div>
      </FacetCard>

      {/* Accordion Card 1: Details */}
      <FacetCard className="overflow-hidden">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpenIdentity((v) => !v)}
          aria-expanded={openIdentity}
          className="h-auto min-h-(--control-height-sm) w-full justify-between justify-start py-2 text-left whitespace-normal"
        >
          <Eyebrow>Details</Eyebrow>
          {openIdentity ? (
            <ChevronUp className="h-3.5 w-3.5 opacity-60" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          )}
        </Button>

        {openIdentity && (
          <div className="border-separator space-y-2 border-t p-3">
            {/* Feature Name */}
            <div className="space-y-1">
              <span className="text-label-secondary text-caption">Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameBlur}
                placeholder="e.g. Caphiria"
                className="border-separator bg-surface text-label placeholder:text-label-tertiary focus:border-tint focus:ring-tint rounded-control text-caption w-full border px-3 py-2 transition-colors focus:ring-1 focus:outline-none"
              />
            </div>

            {/* City: Type selector */}
            {feature.type === "city" && (
              <div className="space-y-1">
                <span id="inspector-city-type" className="text-label-secondary text-caption">
                  Type
                </span>
                <ToggleGroup
                  type="single"
                  disallowEmpty
                  variant="outline"
                  size="sm"
                  aria-labelledby="inspector-city-type"
                  value={cityType}
                  onValueChange={(t) => t && handleCityTypeChange(t)}
                >
                  {CITY_TYPES.map((t) => (
                    <ToggleGroupItem key={t} value={t} className="capitalize">
                      {t}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            )}

            {/* Route Settings */}
            {feature.type === "route" && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <span className="text-label-secondary text-caption">Route sub-type</span>
                  <OptionSelect
                    aria-label="Route type"
                    size="sm"
                    value={routeType}
                    onValueChange={(v) => handleRouteTypeChange(v)}
                    options={ROUTE_TYPE_KEYS.map((key) => ({
                      value: key,
                      label: ROUTE_STYLES[key]?.label ?? key,
                    }))}
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-label-secondary text-caption">Operational status</span>
                  <OptionSelect
                    aria-label="Operational status"
                    value={routeStatus}
                    onValueChange={(v) => handleRouteStatusChange(v)}
                    options={[
                      { value: "operational", label: "Operational" },
                      { value: "under_construction", label: "Under Construction" },
                      { value: "planned", label: "Planned" },
                      { value: "abandoned", label: "Abandoned" },
                    ]}
                    size="sm"
                    className="w-full"
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-2 pt-0.5">
                  <Checkbox
                    checked={isInternational}
                    onCheckedChange={(c) => handleInternationalChange(c === true)}
                  />
                  <span className="text-label text-caption">International Corridor</span>
                </label>

                {/* Velocity & Transit Telemetry Card */}
                <div className="border-separator rounded-control space-y-2 border p-2">
                  <div className="flex items-center justify-between">
                    <Eyebrow className="flex items-center gap-2">
                      <Gauge className="text-tint h-3 w-3" /> Velocity & Transit
                    </Eyebrow>
                    {travelTime?.isInstantaneous ? (
                      <span className="bg-tint-fill text-tint text-caption rounded-control-sm px-2 py-0.5">
                        Light Speed
                      </span>
                    ) : (
                      <span className="text-label text-caption flex items-center gap-1 font-semibold tabular-nums">
                        <Clock className="text-tint h-3 w-3 opacity-80" />
                        {travelTime?.formattedTime ?? "—"}
                      </span>
                    )}
                  </div>

                  {!travelTime?.isInstantaneous && (
                    <>
                      {/* Speed custom input */}
                      <div className="space-y-1">
                        <div className="text-label-secondary text-footnote flex items-center justify-between">
                          <span>Design Speed</span>
                          <span className="text-label font-medium tabular-nums">
                            {routeSpeed} km/h
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={5}
                            max={1200}
                            step={5}
                            value={routeSpeed}
                            onChange={(e) => handleSpeedChange(parseInt(e.target.value, 10) || 5)}
                            className="border-separator bg-surface text-label focus:border-tint text-footnote rounded-control-sm w-24 border px-2 py-1 tabular-nums focus:outline-none"
                          />
                          <span className="text-label-secondary text-footnote">km/h</span>
                        </div>

                        {/* Presets */}
                        {getSpeedPresets(routeType).length > 0 && (
                          <ToggleGroup
                            type="single"
                            disallowEmpty
                            variant="outline"
                            size="sm"
                            aria-label="Speed presets"
                            className="pt-1"
                            value={String(routeSpeed)}
                            onValueChange={(v) => v && handleSpeedChange(Number(v))}
                          >
                            {getSpeedPresets(routeType).map((preset) => (
                              <ToggleGroupItem key={preset.speed} value={String(preset.speed)}>
                                {preset.label}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        )}
                      </div>

                      {/* Travel summary stats */}
                      <div className="border-separator text-footnote grid grid-cols-2 gap-2 border-t pt-2">
                        <div>
                          <span className="text-label-secondary block">Effective Speed</span>
                          <span className="text-label font-medium tabular-nums">
                            {travelTime?.effectiveSpeedKmh} km/h
                          </span>
                          {Boolean(travelTime && travelTime.terrainPenaltyPercent > 0) && (
                            <span className="text-caption text-yellow block">
                              -{travelTime?.terrainPenaltyPercent}% terrain drag
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-label-secondary block">Dwell Overhead</span>
                          <span className="text-label font-medium tabular-nums">
                            {travelTime?.dwellTimeMinutes
                              ? `+${travelTime.dwellTimeMinutes}m stops`
                              : "Continuous"}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {typeof feature.properties?.lengthKm === "number" && (
                  <div className="border-separator rounded-control text-footnote flex items-center justify-between border px-3 py-2">
                    <span className="text-label-secondary">Route Length</span>
                    <span className="text-label font-medium tabular-nums">
                      {(feature.properties.lengthKm as number).toFixed(1)} km
                    </span>
                  </div>
                )}

                {/* Route Nodes Summary & Direct Map Edit Trigger */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-label-secondary text-caption">
                      Path Nodes ({routeVertices.length})
                    </span>
                    {onEditRoute && (
                      <Button
                        variant="secondary"
                        size="xs"
                        type="button"
                        onClick={() => onEditRoute(feature.id)}
                      >
                        <Route className="h-3 w-3" />
                        <span>Edit Path on Map</span>
                      </Button>
                    )}
                  </div>

                  {routeVertices.length > 0 && (
                    <div className="border-separator rounded-control-sm max-h-28 space-y-1 overflow-y-auto border p-2">
                      {routeVertices.slice(0, 10).map((pt, i) => (
                        <div
                          key={i}
                          className="text-label-secondary text-footnote flex items-center justify-between tabular-nums"
                        >
                          <span>
                            #{i + 1}{" "}
                            {i === 0 ? "(Start)" : i === routeVertices.length - 1 ? "(End)" : ""}
                          </span>
                          <span>
                            {pt[0].toFixed(4)}°, {pt[1].toFixed(4)}°
                          </span>
                        </div>
                      ))}
                      {routeVertices.length > 10 && (
                        <div className="text-label-secondary text-footnote pt-0.5 text-center">
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
                <span className="text-label-secondary text-caption">Level</span>
                <OptionSelect
                  aria-label="Level"
                  value={String(subdivisionLevel)}
                  onValueChange={(v) => {
                    const val = parseInt(v, 10);
                    setSubdivisionLevel(val);
                    void onUpdateFeature({ level: val });
                  }}
                  options={SUBDIVISION_LEVELS.map((item) => ({
                    value: String(item.level),
                    label: item.label,
                  }))}
                  size="sm"
                  className="w-full"
                />
              </div>
            )}

            {/* Region assignment (for non-subdivisions) */}
            {feature.type !== "subdivision" && subdivisions.length > 0 && (
              <div className="space-y-1">
                <span className="text-label-secondary text-caption">Region</span>
                <OptionSelect
                  aria-label="Region"
                  value={subdivisionId}
                  onValueChange={(v) => handleSubdivisionChange(v)}
                  options={[
                    { value: "", label: "None" },
                    ...subdivisions.map((s) => ({ value: s.id, label: s.name || s.id })),
                  ]}
                  size="sm"
                  className="w-full"
                />
              </div>
            )}
          </div>
        )}
      </FacetCard>

      {/* Accordion Card 2: Location & Hydrology */}
      <FacetCard className="overflow-hidden">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpenSpatial((v) => !v)}
          aria-expanded={openSpatial}
          className="h-auto min-h-(--control-height-sm) w-full justify-between justify-start py-2 text-left whitespace-normal"
        >
          <Eyebrow>
            {feature.type === "river"
              ? "Hydrology & Course"
              : feature.type === "lake"
                ? "Hydrology & Limnology"
                : "Location"}
          </Eyebrow>
          {openSpatial ? (
            <ChevronUp className="h-3.5 w-3.5 opacity-60" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          )}
        </Button>

        {openSpatial && (
          <div className="border-separator space-y-2 border-t p-3">
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
                  <div className="border-separator rounded-control space-y-2 border p-2">
                    <div className="flex items-center justify-between">
                      <Eyebrow>Elevation & Terrain</Eyebrow>
                      {sampleTerrain.isLoading && (
                        <div className="border-separator border-t-primary h-2.5 w-2.5 animate-spin rounded-full border-2" />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="border-separator bg-fill-4 rounded-control-sm p-2">
                        <span className="text-label-secondary text-footnote">Elevation</span>
                        <p className="text-label text-caption font-semibold tabular-nums">
                          {sampleTerrain.data?.midpoint != null
                            ? `${sampleTerrain.data.midpoint.toLocaleString()} m`
                            : "—"}
                        </p>
                      </div>

                      <div className="border-separator bg-fill-4 rounded-control-sm p-2">
                        <span className="text-label-secondary text-footnote">Terrain zone</span>
                        <p className="text-label text-caption font-semibold tabular-nums">
                          {sampleTerrain.data?.zoneName || "Lowland"}
                        </p>
                      </div>
                    </div>

                    {sampleTerrain.data?.elevationMin != null &&
                      sampleTerrain.data?.elevationMax != null && (
                        <div className="border-separator bg-fill-4 text-footnote rounded-control-sm flex items-center justify-between px-2 py-1">
                          <span className="text-label-secondary">Zone range</span>
                          <span className="text-label font-medium tabular-nums">
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
      </FacetCard>

      {/* Accordion Card 3: Wiki */}
      <FacetCard className="overflow-hidden">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpenWiki((v) => !v)}
          aria-expanded={openWiki}
          className="h-auto min-h-(--control-height-sm) w-full justify-between justify-start py-2 text-left whitespace-normal"
        >
          <Eyebrow>Wiki article</Eyebrow>
          {openWiki ? (
            <ChevronUp className="h-3.5 w-3.5 opacity-60" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          )}
        </Button>

        {openWiki && (
          <div className="border-separator space-y-2 border-t p-3">
            <div className="space-y-1">
              <span className="text-label-secondary text-caption">Article title</span>
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
                className="border-separator bg-surface hover:bg-fill-3 text-label rounded-control text-caption flex items-center justify-center gap-2 border py-2 transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
              >
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                <span>Open in Wiki</span>
              </a>
            )}
          </div>
        )}
      </FacetCard>

      {/* Accordion Card 4: Actions */}
      <FacetCard className="overflow-hidden">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpenActions((v) => !v)}
          aria-expanded={openActions}
          className="h-auto min-h-(--control-height-sm) w-full justify-between justify-start py-2 text-left whitespace-normal"
        >
          <Eyebrow>Actions</Eyebrow>
          {openActions ? (
            <ChevronUp className="h-3.5 w-3.5 opacity-60" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          )}
        </Button>

        {openActions && (
          <div className="border-separator border-t p-3">
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
      </FacetCard>
    </div>
  );
});

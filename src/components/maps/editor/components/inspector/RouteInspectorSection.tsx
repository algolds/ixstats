"use client";
import React, { useMemo } from "react";
import { Dashboard as Gauge, Clock, PathArrow as Route } from "iconoir-react";
import type { EditorFeature } from "~/hooks/useMapEditor";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Eyebrow } from "~/components/ui/eyebrow";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { ROUTE_STYLES, ROUTE_TYPE_KEYS } from "~/lib/maps/map-config";
import { calculateRouteTravelTime, getSpeedPresets } from "~/lib/economy/travel-time";
import { ReadoutRow } from "./InspectorPrimitives";
import type { Geometry } from "geojson";
import { routeVertices } from "~/components/maps/editor/utils/map-helpers";

const ROUTE_TYPE_OPTIONS = ROUTE_TYPE_KEYS.map((key) => ({
  value: key,
  label: ROUTE_STYLES[key]?.label ?? key,
}));

const ROUTE_STATUS_OPTIONS = [
  { value: "operational", label: "Operational" },
  { value: "under_construction", label: "Under construction" },
  { value: "planned", label: "Planned" },
  { value: "abandoned", label: "Abandoned" },
];

const MAX_LISTED_NODES = 10;

function nodeSuffix(index: number, count: number) {
  if (index === 0) return "(Start)";
  return index === count - 1 ? "(End)" : "";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-label-secondary text-caption">{label}</span>
      {children}
    </div>
  );
}

function TravelTelemetry({
  feature,
  routeType,
  routeSpeed,
  onSpeedChange,
}: {
  feature: EditorFeature;
  routeType: string;
  routeSpeed: number;
  onSpeedChange: (speed: number) => void;
}) {
  const props = feature.properties;
  const travelTime = useMemo(() => {
    const lengthKm = typeof props?.lengthKm === "number" ? props.lengthKm : 0;
    const terrainDifficulty =
      typeof props?.terrainDifficulty === "number" ? props.terrainDifficulty : 0;
    const stopsCount = Array.isArray(props?.stops) ? props.stops.length : 2;
    return calculateRouteTravelTime({
      lengthKm,
      speedKmh: routeSpeed,
      routeType,
      terrainDifficulty,
      stopsCount,
      properties: props,
    });
  }, [props, routeSpeed, routeType]);
  const presets = getSpeedPresets(routeType);

  return (
    <div className="border-separator rounded-control space-y-2 border p-2">
      <div className="flex items-center justify-between">
        <Eyebrow className="flex items-center gap-2">
          <Gauge className="text-tint h-3 w-3" /> Velocity & transit
        </Eyebrow>
        {travelTime.isInstantaneous ? (
          <span className="bg-tint-fill text-tint text-caption rounded-control-sm px-2 py-0.5">
            Light speed
          </span>
        ) : (
          <span className="text-label text-caption flex items-center gap-1 font-semibold tabular-nums">
            <Clock className="text-tint h-3 w-3 opacity-80" />
            {travelTime.formattedTime ?? "—"}
          </span>
        )}
      </div>

      {!travelTime.isInstantaneous && (
        <>
          <div className="space-y-1">
            <ReadoutRow
              label="Design speed"
              value={`${routeSpeed} km/h`}
              valueClassName="text-label font-medium tabular-nums"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={5}
                max={1200}
                step={5}
                value={routeSpeed}
                onChange={(e) => onSpeedChange(parseInt(e.target.value, 10) || 5)}
                className="border-separator bg-surface text-label focus:border-tint text-footnote rounded-control-sm w-24 border px-2 py-1 tabular-nums focus:outline-none"
              />
              <span className="text-label-secondary text-footnote">km/h</span>
            </div>

            {presets.length > 0 && (
              <ToggleGroup
                type="single"
                disallowEmpty
                variant="outline"
                size="sm"
                aria-label="Speed presets"
                className="pt-1"
                value={String(routeSpeed)}
                onValueChange={(v) => v && onSpeedChange(Number(v))}
              >
                {presets.map((preset) => (
                  <ToggleGroupItem key={preset.speed} value={String(preset.speed)}>
                    {preset.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          </div>

          <div className="border-separator text-footnote grid grid-cols-2 gap-2 border-t pt-2">
            <div>
              <span className="text-label-secondary block">Effective speed</span>
              <span className="text-label font-medium tabular-nums">
                {travelTime.effectiveSpeedKmh} km/h
              </span>
              {travelTime.terrainPenaltyPercent > 0 && (
                <span className="text-caption text-yellow block">
                  -{travelTime.terrainPenaltyPercent}% terrain drag
                </span>
              )}
            </div>
            <div>
              <span className="text-label-secondary block">Dwell overhead</span>
              <span className="text-label font-medium tabular-nums">
                {travelTime.dwellTimeMinutes
                  ? `+${travelTime.dwellTimeMinutes}m stops`
                  : "Continuous"}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PathNodes({
  feature,
  onEditRoute,
}: {
  feature: EditorFeature;
  onEditRoute?: (routeId: string) => void;
}) {
  const vertices = useMemo(
    () => routeVertices(feature.geometry as Geometry | undefined),
    [feature.geometry]
  );
  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between">
        <span className="text-label-secondary text-caption">Path Nodes ({vertices.length})</span>
        {onEditRoute && (
          <Button
            variant="secondary"
            size="xs"
            type="button"
            onClick={() => onEditRoute(feature.id)}
          >
            <Route className="h-3 w-3" />
            <span>Edit path on map</span>
          </Button>
        )}
      </div>

      {vertices.length > 0 && (
        <div className="border-separator rounded-control-sm max-h-28 space-y-1 overflow-y-auto border p-2">
          {vertices.slice(0, MAX_LISTED_NODES).map((pt, i) => (
            <div
              key={i}
              className="text-label-secondary text-footnote flex items-center justify-between tabular-nums"
            >
              <span>
                #{i + 1} {nodeSuffix(i, vertices.length)}
              </span>
              <span>
                {pt[0].toFixed(4)}°, {pt[1].toFixed(4)}°
              </span>
            </div>
          ))}
          {vertices.length > MAX_LISTED_NODES && (
            <div className="text-label-secondary text-footnote pt-0.5 text-center">
              + {vertices.length - MAX_LISTED_NODES} more nodes
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface RouteInspectorSectionProps {
  feature: EditorFeature;
  routeType: string;
  routeStatus: string;
  isInternational: boolean;
  routeSpeed: number;
  onRouteTypeChange: (type: string) => void;
  onStatusChange: (status: string) => void;
  onInternationalChange: (value: boolean) => void;
  onSpeedChange: (speed: number) => void;
  onEditRoute?: (routeId: string) => void;
}

export function RouteInspectorSection({
  feature,
  routeType,
  routeStatus,
  isInternational,
  routeSpeed,
  onRouteTypeChange,
  onStatusChange,
  onInternationalChange,
  onSpeedChange,
  onEditRoute,
}: RouteInspectorSectionProps) {
  const lengthKm = feature.properties?.lengthKm;
  return (
    <div className="space-y-2">
      <Field label="Route sub-type">
        <OptionSelect
          aria-label="Route type"
          size="sm"
          value={routeType}
          onValueChange={onRouteTypeChange}
          options={ROUTE_TYPE_OPTIONS}
        />
      </Field>

      <Field label="Operational status">
        <OptionSelect
          aria-label="Operational status"
          value={routeStatus}
          onValueChange={onStatusChange}
          options={ROUTE_STATUS_OPTIONS}
          size="sm"
          className="w-full"
        />
      </Field>

      <label className="flex cursor-pointer items-center gap-2 pt-0.5">
        <Checkbox
          checked={isInternational}
          onCheckedChange={(c) => onInternationalChange(c === true)}
        />
        <span className="text-label text-caption">International corridor</span>
      </label>

      <TravelTelemetry
        feature={feature}
        routeType={routeType}
        routeSpeed={routeSpeed}
        onSpeedChange={onSpeedChange}
      />

      {typeof lengthKm === "number" && (
        <ReadoutRow
          className="border-separator rounded-control border px-3 py-2"
          label="Route length"
          value={`${lengthKm.toFixed(1)} km`}
        />
      )}

      <PathNodes feature={feature} onEditRoute={onEditRoute} />
    </div>
  );
}

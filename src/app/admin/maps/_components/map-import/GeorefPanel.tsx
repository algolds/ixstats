"use client";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SegmentedControl } from "~/components/ui/segmented-control";
import type {
  MapBounds,
  MapControlPoint,
  MapGeoreference,
  MapProjection,
} from "~/lib/maps/realm-map-settings";

export type GeorefPlacement = "whole" | "bounds" | "points";

/** A capital the wiki's infobox places, offered as a control point's lon/lat. */
export interface CapitalHint {
  nation: string;
  capital: string | null;
  coordinates: [number, number];
}

interface GeorefPanelProps {
  width: number;
  height: number;
  value: MapGeoreference;
  onChange: (value: MapGeoreference) => void;
  capitals?: CapitalHint[];
}

const DEFAULT_BOUNDS: MapBounds = { west: -180, south: -90, east: 180, north: 90 };
const EMPTY_POINT: MapControlPoint = { x: 0, y: 0, lon: 0, lat: 0 };

export const placementOf = (g: MapGeoreference): GeorefPlacement =>
  g.controlPoints?.length ? "points" : g.bounds ? "bounds" : "whole";

const num = (raw: string) => (raw.trim() === "" || Number.isNaN(Number(raw)) ? 0 : Number(raw));

/**
 * Where the map lies on the globe: its projection, and either the whole globe, the lon/lat box a crop covers, or
 * control points (a pixel and the lon/lat it shows). The server previews the extent it gives.
 */
export function GeorefPanel({ width, height, value, onChange, capitals = [] }: GeorefPanelProps) {
  const placement = placementOf(value);
  const projection: MapProjection = value.projection ?? "equirectangular";
  const valid =
    placement === "whole" ||
    (placement === "bounds" &&
      !!value.bounds &&
      value.bounds.west < value.bounds.east &&
      value.bounds.south < value.bounds.north) ||
    (placement === "points" && (value.controlPoints?.length ?? 0) >= 3);
  const preview = api.geoEditor.mapImport.previewGeoreference.useQuery(
    { width, height, georef: value },
    { enabled: valid && width > 0 && height > 0, retry: false }
  );

  const setPlacement = (next: GeorefPlacement) =>
    onChange({
      projection: value.projection,
      ...(next === "bounds" && { bounds: value.bounds ?? DEFAULT_BOUNDS }),
      ...(next === "points" && {
        controlPoints: value.controlPoints ?? [EMPTY_POINT, EMPTY_POINT, EMPTY_POINT],
      }),
    });
  const setBound = (key: keyof MapBounds, raw: string) =>
    onChange({ ...value, bounds: { ...(value.bounds ?? DEFAULT_BOUNDS), [key]: num(raw) } });
  const points = value.controlPoints ?? [];
  const setPoint = (index: number, key: keyof MapControlPoint, raw: string) =>
    onChange({
      ...value,
      controlPoints: points.map((p, i) => (i === index ? { ...p, [key]: num(raw) } : p)),
    });
  const addPoint = (point: MapControlPoint = EMPTY_POINT) =>
    onChange({ ...value, controlPoints: [...points, point] });
  const removePoint = (index: number) =>
    onChange({ ...value, controlPoints: points.filter((_, i) => i !== index) });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Label>Projection</Label>
        <SegmentedControl
          aria-label="Projection"
          value={projection}
          onValueChange={(next) => onChange({ ...value, projection: next as MapProjection })}
          options={[
            { value: "equirectangular", label: "Equirectangular" },
            { value: "mercator", label: "Mercator" },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Label>Placement</Label>
        <SegmentedControl
          aria-label="Placement"
          value={placement}
          onValueChange={(next) => setPlacement(next as GeorefPlacement)}
          options={[
            { value: "whole", label: "Whole globe" },
            { value: "bounds", label: "Crop bounds" },
            { value: "points", label: "Control points" },
          ]}
        />
      </div>

      {placement === "bounds" && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(["west", "south", "east", "north"] as const).map((key) => (
            <div key={key} className="flex flex-col gap-1">
              <Label htmlFor={`georef-${key}`} className="capitalize">
                {key} (°)
              </Label>
              <Input
                id={`georef-${key}`}
                type="number"
                inputMode="decimal"
                value={value.bounds?.[key] ?? ""}
                onChange={(e) => setBound(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {placement === "points" && (
        <div className="flex flex-col gap-2">
          <p className="text-label-secondary text-footnote">
            Pixels count from the image&apos;s top-left corner (x right, y down). Use three or more
            points far apart, not in a line.
          </p>
          {points.map((point, index) => (
            <div key={index} className="flex flex-wrap items-end gap-2">
              {(["x", "y", "lon", "lat"] as const).map((key) => (
                <div key={key} className="flex w-24 flex-col gap-1">
                  <Label htmlFor={`point-${index}-${key}`}>{key}</Label>
                  <Input
                    id={`point-${index}-${key}`}
                    type="number"
                    inputMode="decimal"
                    value={point[key]}
                    onChange={(e) => setPoint(index, key, e.target.value)}
                  />
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => removePoint(index)}>
                Remove
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => addPoint()}>
              Add a point
            </Button>
            {capitals.length > 0 && (
              <select
                aria-label="Add a capital from the wiki"
                className="border-separator bg-surface rounded-control text-footnote border px-2 py-1"
                value=""
                onChange={(e) => {
                  const hint = capitals[Number(e.target.value)];
                  if (hint)
                    addPoint({ x: 0, y: 0, lon: hint.coordinates[0], lat: hint.coordinates[1] });
                }}
              >
                <option value="">Add a capital from the wiki…</option>
                {capitals.map((hint, i) => (
                  <option key={hint.nation} value={i}>
                    {hint.capital ? `${hint.capital} (${hint.nation})` : hint.nation}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      <ExtentPreview
        loading={preview.isFetching}
        error={preview.error?.message ?? null}
        data={valid ? preview.data : undefined}
      />
    </div>
  );
}

function ExtentPreview({
  loading,
  error,
  data,
}: {
  loading: boolean;
  error: string | null;
  data:
    | { extent: MapBounds; warnings: string[]; rmseDegrees: number | null; method: string }
    | undefined;
}) {
  if (error) return <p className="text-destructive text-footnote">{error}</p>;
  if (!data)
    return (
      <p className="text-label-secondary text-footnote">
        {loading ? "Checking…" : "Fill in the placement to preview it."}
      </p>
    );
  const { extent } = data;
  const fmt = (v: number, pos: string, neg: string) =>
    `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg
        viewBox="-180 -90 360 180"
        className="border-separator bg-fill-4 rounded-control-sm h-24 w-48 border"
        role="img"
        aria-label="The map's extent on the globe"
      >
        <line x1={-180} y1={0} x2={180} y2={0} className="stroke-separator" strokeWidth={1} />
        <line x1={0} y1={-90} x2={0} y2={90} className="stroke-separator" strokeWidth={1} />
        <rect
          x={extent.west}
          y={-extent.north}
          width={extent.east - extent.west}
          height={extent.north - extent.south}
          className="fill-tint/30 stroke-tint"
          strokeWidth={2}
        />
      </svg>
      <div className="text-footnote flex flex-col gap-1">
        <span className="text-label">
          {fmt(extent.west, "E", "W")} to {fmt(extent.east, "E", "W")},{" "}
          {fmt(extent.south, "N", "S")} to {fmt(extent.north, "N", "S")}
        </span>
        {data.rmseDegrees !== null && (
          <span className="text-label-secondary">
            Control points fit within {data.rmseDegrees.toFixed(3)}°
          </span>
        )}
        {data.warnings.map((w) => (
          <span key={w} className="text-warning-ink">
            {w}
          </span>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { withBasePath } from "~/lib/base-path";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import {
  MAX_MAP_IMPORT_BYTES,
  type MapImportKind,
  type MapImportOptionsInput,
} from "~/lib/maps/import/options";
import type { GeojsonInspection } from "~/lib/maps/import/geojson-engine";
import type { MapGeoreference } from "~/lib/maps/realm-map-settings";
import { GeorefPanel, type CapitalHint } from "./GeorefPanel";

export interface MapUploadInfo {
  uploadId: string;
  kind: MapImportKind;
  filename: string;
  size: number;
  width: number | null;
  height: number | null;
  geojson?: GeojsonInspection;
}

const MAX_MB = MAX_MAP_IMPORT_BYTES / 1024 / 1024;

/** Upload the file to the map import store; the server reads its kind from the bytes. */
export async function uploadMapFile(realmId: string, file: File): Promise<MapUploadInfo> {
  if (file.size > MAX_MAP_IMPORT_BYTES) throw new Error(`Map files are limited to ${MAX_MB} MB`);
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(
    withBasePath(`/api/admin/map-import/upload?realm=${encodeURIComponent(realmId)}`),
    {
      method: "POST",
      body: form,
    }
  );
  const body = (await res
    .json()
    .catch(() => ({ error: `Upload failed (${res.status})` }))) as MapUploadInfo & {
    error?: string;
  };
  if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status})`);
  return body;
}

interface SettingsProps {
  upload: MapUploadInfo;
  initialGeoref: MapGeoreference;
  capitals: CapitalHint[];
  busy: boolean;
  onAnalyse: (options: MapImportOptionsInput) => void;
  onReset: () => void;
}

const numberOr = (raw: string, fallback: number) =>
  raw.trim() === "" || Number.isNaN(Number(raw)) ? fallback : Number(raw);

/** The engine's settings for an uploaded file: where it lies on the globe, and how its regions are read. */
export function ImportSettings({
  upload,
  initialGeoref,
  capitals,
  busy,
  onAnalyse,
  onReset,
}: SettingsProps) {
  const pixelSpace = upload.kind !== "geojson" || upload.geojson?.space === "pixel";
  const [georef, setGeoref] = useState<MapGeoreference>(initialGeoref);
  const [tolerance, setTolerance] = useState("12");
  const [minRegion, setMinRegion] = useState("");
  const [removeBorders, setRemoveBorders] = useState(true);
  const [water, setWater] = useState("");
  const [layer, setLayer] = useState("");
  const [nameProperty, setNameProperty] = useState(upload.geojson?.suggestedNameProperty ?? "");

  const analyse = () => {
    const waterColours = water
      .split(/[\s,]+/)
      .map((h) => h.trim().toLowerCase())
      .filter((h) => /^#[0-9a-f]{6}$/.test(h));
    onAnalyse({
      ...(pixelSpace && (georef.projection || georef.bounds || georef.controlPoints)
        ? { georef }
        : {}),
      png: {
        tolerance: numberOr(tolerance, 12),
        minRegionPixels: minRegion.trim() ? numberOr(minRegion, 0) : null,
        borderLightness: removeBorders ? 28 : 0,
        waterColours,
      },
      svg: { ...(layer.trim() && { layer: layer.trim() }) },
      geojson: { ...(nameProperty && { nameProperty }) },
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-label-secondary text-body">
        <span className="text-label font-medium">{upload.filename}</span> (
        {upload.kind === "png" ? "image" : upload.kind}
        {upload.width && upload.height ? `, ${upload.width}×${upload.height}` : ""},{" "}
        {(upload.size / 1024 / 1024).toFixed(1)} MB)
      </p>
      {upload.geojson?.warnings.map((w) => (
        <p key={w} className="text-warning-ink text-footnote">
          {w}
        </p>
      ))}

      {pixelSpace && upload.width && upload.height && (
        <section className="flex flex-col gap-2">
          <h4 className="text-label text-body font-medium">Where the map lies on the globe</h4>
          <GeorefPanel
            width={upload.width}
            height={upload.height}
            value={georef}
            onChange={setGeoref}
            capitals={capitals}
          />
        </section>
      )}

      {upload.kind === "png" && (
        <section className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="import-tolerance">Colour tolerance (ΔE)</Label>
            <Input
              id="import-tolerance"
              type="number"
              min={1}
              max={40}
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
            />
            <p className="text-label-secondary text-footnote">
              How far a pixel may be from a map colour and still be it.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="import-min-region">Smallest region (pixels)</Label>
            <Input
              id="import-min-region"
              type="number"
              min={0}
              placeholder="Automatic"
              value={minRegion}
              onChange={(e) => setMinRegion(e.target.value)}
            />
            <p className="text-label-secondary text-footnote">
              Smaller specks merge into their largest neighbour.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="import-water">Sea colours</Label>
            <Input
              id="import-water"
              placeholder="#2060c0, #a0c8f0"
              value={water}
              onChange={(e) => setWater(e.target.value)}
            />
            <p className="text-label-secondary text-footnote">
              Offered as ignored in the next step.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="import-borders"
              checked={removeBorders}
              onCheckedChange={(v) => setRemoveBorders(v === true)}
            />
            <Label htmlFor="import-borders">Remove dark border lines so neighbours touch</Label>
          </div>
        </section>
      )}

      {upload.kind === "svg" && (
        <div className="flex max-w-sm flex-col gap-1">
          <Label htmlFor="import-layer">Layer (group id or label)</Label>
          <Input
            id="import-layer"
            placeholder="Found automatically"
            value={layer}
            onChange={(e) => setLayer(e.target.value)}
          />
        </div>
      )}

      {upload.kind === "geojson" && upload.geojson && (
        <div className="flex max-w-sm flex-col gap-1">
          <Label htmlFor="import-name-property">Property holding the nation&apos;s name</Label>
          <select
            id="import-name-property"
            className="border-separator bg-surface rounded-control text-body border px-2 py-2"
            value={nameProperty}
            onChange={(e) => setNameProperty(e.target.value)}
          >
            {upload.geojson.properties.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} ({p.distinct} values, e.g. {p.samples.slice(0, 2).join(", ")})
              </option>
            ))}
          </select>
          <p className="text-label-secondary text-footnote">
            {upload.geojson.features} features, {upload.geojson.polygons} polygons.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={analyse} disabled={busy}>
          {busy ? "Starting…" : "Analyse the map"}
        </Button>
        <Button variant="outline" onClick={onReset} disabled={busy}>
          Choose another file
        </Button>
      </div>
    </div>
  );
}

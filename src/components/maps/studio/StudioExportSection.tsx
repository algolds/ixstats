"use client";

import { useState } from "react";
import { Download } from "iconoir-react";
import { SwitchRow } from "~/components/maps/editor/panels/WorldControlParts";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import type { PngWidth } from "~/hooks/useWorldGenerator";
import {
  downloadBlob,
  exportFileName,
  geojsonZip,
  pngFailureText,
} from "~/lib/worldgen/world-export";
import { isEncodeFailure, isOutrunMessage } from "~/lib/worldgen/worker/world-query-errors";
import { useStudio } from "./StudioContext";

// The same names as `PNG_WIDTHS` (render-png.ts, the worker's drawing code, which the page does not import)
const WIDTHS = ["2048", "4096", "8192"] as const;
const widthOf = (value: (typeof WIDTHS)[number]): PngWidth =>
  value === "2048" ? 2048 : value === "4096" ? 4096 : 8192;

/** What a failed render means to the admin: the browser's limit only when the encode failed, else its own reason. */
function pngErrorText(message: string, size: PngWidth): string {
  if (isOutrunMessage(message))
    return "The world changed while the image was being made. Try again.";
  if (isEncodeFailure(message)) return pngFailureText(size);
  return message || "The image could not be made.";
}

/** Export: the world's layers as one zip of GeoJSON files, or an equirectangular PNG of it. */
export function StudioExportSection() {
  const { generator, source, stale } = useStudio();
  const { result } = generator;
  const [width, setWidth] = useState<(typeof WIDTHS)[number]>("4096");
  const [politics, setPolitics] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportZip = () => {
    if (!result) return;
    setError(null);
    try {
      const zip = geojsonZip(result);
      downloadBlob(
        new Blob([zip], { type: "application/zip" }),
        exportFileName(source.preset, result.seed)
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The files could not be made.");
    }
  };

  const exportPng = async () => {
    if (!result || rendering) return;
    const size = widthOf(width);
    setRendering(true);
    setError(null);
    try {
      const png = await generator.renderPng(size, politics);
      downloadBlob(png, exportFileName(source.preset, result.seed, size));
    } catch (failure) {
      setError(pngErrorText(failure instanceof Error ? failure.message : "", size));
    } finally {
      setRendering(false);
    }
  };

  return (
    <section aria-label="Export" className="space-y-3">
      <h4 className="text-headline">Export</h4>
      {!result && (
        <p className="text-label-secondary text-caption">There is no world to export yet.</p>
      )}
      {result && stale && (
        <p className="text-label-secondary text-caption">
          The world is out of date; an export is of the world on the map now.
        </p>
      )}
      <div className="space-y-2">
        <p className="text-footnote font-medium">GeoJSON</p>
        <p className="text-label-secondary text-caption">
          One zip with a file for each layer of the world.
        </p>
        <Button size="sm" variant="outline" disabled={!result} onClick={exportZip}>
          <Download aria-hidden />
          Download GeoJSON
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-footnote font-medium">Image</p>
        <SegmentedControl
          aria-label="Image width"
          size="sm"
          value={width}
          onValueChange={setWidth}
          options={WIDTHS.map((value) => ({ value, label: `${value} px` }))}
        />
        <SwitchRow
          label="Political fills and borders"
          checked={politics}
          onCheckedChange={setPolitics}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!result || rendering || generator.state !== "ready"}
          onClick={() => void exportPng()}
        >
          <Download aria-hidden />
          {rendering ? "Drawing the image" : "Download PNG"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-caption">
          {error}
        </p>
      )}
    </section>
  );
}

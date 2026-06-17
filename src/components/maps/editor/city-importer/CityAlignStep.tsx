"use client";

import React, { memo } from "react";
import { Wand2, Move, Loader2, Check, AlertCircle, MapPin, HelpCircle } from "lucide-react";
import type { useCityImporter } from "~/hooks/useCityImporter";

interface CityAlignStepProps {
  importer: ReturnType<typeof useCityImporter>;
  countryId: string;
}

export const CityAlignStep = memo(function CityAlignStep({ importer }: CityAlignStepProps) {
  const hasAlignment = !!importer.transform;

  // Find the current cities layer count for the sub-text
  const currentCitiesLayer = importer.layers.find((l) => l.id === importer.citiesLayerId);
  const shapeCount = currentCitiesLayer ? currentCitiesLayer.shapeCount : 0;

  return (
    <div className="space-y-4">
      {/* Title & Desc */}
      <div>
        <h3 className="text-foreground text-sm font-medium">Align Cities to Map</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Match the SVG pixel coordinates of the cities with WGS84 geographic coordinates.
        </p>
      </div>

      {/* Layer Selectors */}
      <div className="bg-accent/40 border-border/40 space-y-3 rounded-lg border p-3">
        <h4 className="text-foreground text-xs font-semibold tracking-wider uppercase">
          SVG Layer Mapping
        </h4>

        {/* Cities Layer */}
        <div className="space-y-1">
          <label className="text-muted-foreground block text-[10px] font-medium">
            City Dots Layer
          </label>
          <select
            value={importer.citiesLayerId}
            onChange={(e) => importer.setLayer(e.target.value, importer.capitalLayerId)}
            className="bg-background border-border text-foreground w-full rounded border px-2.5 py-1 text-xs"
          >
            {importer.layers.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.name} ({layer.shapeCount} shape{layer.shapeCount !== 1 ? "s" : ""})
              </option>
            ))}
          </select>
        </div>

        {/* Capitals Layer */}
        <div className="space-y-1">
          <label className="text-muted-foreground block text-[10px] font-medium">
            Capitals Layer (Optional)
          </label>
          <select
            value={importer.capitalLayerId}
            onChange={(e) => importer.setLayer(importer.citiesLayerId, e.target.value)}
            className="bg-background border-border text-foreground w-full rounded border px-2.5 py-1 text-xs"
          >
            <option value="">None (Auto-detect from names/icons)</option>
            {importer.layers.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.name} ({layer.shapeCount} shape{layer.shapeCount !== 1 ? "s" : ""})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alignment Mode Selector */}
      <div className="border-border bg-accent/20 flex rounded-lg border p-0.5">
        <button
          onClick={() => importer.setAlignmentMode("auto-align")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
            importer.alignmentMode === "auto-align"
              ? "bg-background border-border/60 text-foreground border shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Wand2 className="h-3.5 w-3.5" />
          Auto-Align
        </button>
        <button
          onClick={() => importer.setAlignmentMode("manual")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
            importer.alignmentMode === "manual"
              ? "bg-background border-border/60 text-foreground border shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Move className="h-3.5 w-3.5" />
          Manual
        </button>
      </div>

      {/* Status Indicators */}
      {hasAlignment && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs text-green-700 dark:text-green-400">
          <Check className="h-3.5 w-3.5 shrink-0" />
          <span>Successfully aligned {shapeCount} city dots to country coordinates.</span>
        </div>
      )}

      {/* Mode Specific Controls */}
      {importer.alignmentMode === "auto-align" && (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs leading-relaxed">
            Auto-alignment matches names of provinces in the SVG to current database subdivisions to
            automatically compute the rotation, scale, and offset.
          </p>

          <button
            onClick={importer.autoAdjust}
            disabled={importer.isProcessing}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
          >
            {importer.isProcessing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Aligning...
              </>
            ) : (
              <>
                <Wand2 className="h-3.5 w-3.5" />
                {hasAlignment ? "Recompute Auto-Align" : "Auto-Adjust Coordinates"}
              </>
            )}
          </button>
        </div>
      )}

      {importer.alignmentMode === "manual" && (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs leading-relaxed">
            Drag sliders below to manually translate, rotate, or scale coordinates.
          </p>

          {/* Translate X */}
          <div className="space-y-1">
            <label className="text-muted-foreground flex items-center justify-between text-[10px] font-medium">
              <span>Shift East/West</span>
              <span className="text-foreground font-mono font-medium">
                {importer.manualTransform.translate[0].toFixed(2)}°
              </span>
            </label>
            <input
              type="range"
              min={-10}
              max={10}
              step={0.01}
              value={importer.manualTransform.translate[0]}
              onChange={(e) =>
                importer.setManualTransform({
                  ...importer.manualTransform,
                  translate: [parseFloat(e.target.value), importer.manualTransform.translate[1]],
                })
              }
              className="accent-primary w-full"
            />
          </div>

          {/* Translate Y */}
          <div className="space-y-1">
            <label className="text-muted-foreground flex items-center justify-between text-[10px] font-medium">
              <span>Shift North/South</span>
              <span className="text-foreground font-mono font-medium">
                {importer.manualTransform.translate[1].toFixed(2)}°
              </span>
            </label>
            <input
              type="range"
              min={-10}
              max={10}
              step={0.01}
              value={importer.manualTransform.translate[1]}
              onChange={(e) =>
                importer.setManualTransform({
                  ...importer.manualTransform,
                  translate: [importer.manualTransform.translate[0], parseFloat(e.target.value)],
                })
              }
              className="accent-primary w-full"
            />
          </div>

          {/* Rotation */}
          <div className="space-y-1">
            <label className="text-muted-foreground flex items-center justify-between text-[10px] font-medium">
              <span>Rotation (degrees)</span>
              <span className="text-foreground font-mono font-medium">
                {importer.manualTransform.rotate.toFixed(1)}°
              </span>
            </label>
            <input
              type="range"
              min={-180}
              max={180}
              step={0.5}
              value={importer.manualTransform.rotate}
              onChange={(e) =>
                importer.setManualTransform({
                  ...importer.manualTransform,
                  rotate: parseFloat(e.target.value),
                })
              }
              className="accent-primary w-full"
            />
          </div>

          {/* Scale */}
          <div className="space-y-1">
            <label className="text-muted-foreground flex items-center justify-between text-[10px] font-medium">
              <span>Scale Factor</span>
              <span className="text-foreground font-mono font-medium">
                {importer.manualTransform.scale.toFixed(2)}x
              </span>
            </label>
            <input
              type="range"
              min={0.1}
              max={5.0}
              step={0.01}
              value={importer.manualTransform.scale}
              onChange={(e) =>
                importer.setManualTransform({
                  ...importer.manualTransform,
                  scale: parseFloat(e.target.value),
                })
              }
              className="accent-primary w-full"
            />
          </div>

          <button
            onClick={() => importer.setManualTransform({ translate: [0, 0], rotate: 0, scale: 1 })}
            className="border-border text-muted-foreground hover:bg-accent hover:text-foreground w-full rounded-lg border py-1.5 text-xs font-medium transition-colors"
          >
            Reset Adjustments
          </button>
        </div>
      )}

      {/* Error message */}
      {importer.error && (
        <div className="bg-destructive/10 text-destructive border-destructive/20 flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{importer.error}</span>
        </div>
      )}

      {/* Aligned preview list */}
      <div className="space-y-1.5 pt-1">
        <label className="text-muted-foreground block text-[10px] font-semibold tracking-wider uppercase">
          Aligned Coordinates Preview ({importer.alignedRows.length})
        </label>
        <div className="border-border bg-background max-h-40 space-y-1 overflow-y-auto rounded-lg border p-1">
          {importer.alignedRows.map((row, idx) => (
            <div
              key={idx}
              className="border-border/40 flex items-center justify-between border-b px-2.5 py-1.5 text-xs last:border-b-0"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <MapPin className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                <span className="text-foreground truncate font-medium">
                  {row.name || <span className="text-muted-foreground italic">unnamed</span>}
                </span>
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-1.5">
                {row.isCapital && (
                  <span className="shrink-0 rounded bg-amber-500/10 px-1 text-[9px] font-semibold text-amber-500 uppercase">
                    Capital
                  </span>
                )}
                <span className="text-muted-foreground font-mono text-[10px]">
                  {row.lat.toFixed(4)}, {row.lng.toFixed(4)}
                </span>
              </div>
            </div>
          ))}
          {importer.alignedRows.length === 0 && (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-1.5 py-6 text-center text-xs">
              <HelpCircle className="h-5 w-5 opacity-40" />
              <p className="italic">No cities aligned yet. Click Auto-adjust or adjust manually.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

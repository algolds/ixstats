"use client";

import React, { memo } from "react";
import { Archery as Crosshair, MagicWand as Wand2, ArrowSeparate as Move, Refresh as RotateCw, ZoomIn, SystemRestart as Loader2, Trash as Trash2, Check, Magnet } from "iconoir-react";
import type { useProvinceImporter } from "~/hooks/useProvinceImporter";
import type { AlignmentMode } from "~/lib/maps/province-importer/types";

interface AlignmentStepProps {
  importer: ReturnType<typeof useProvinceImporter>;
}

const MODES: { key: AlignmentMode; label: string; icon: typeof Crosshair; desc: string }[] = [
  {
    key: "reference-points",
    label: "Reference Points",
    icon: Crosshair,
    desc: "Place 3+ matching points",
  },
  { key: "auto-align", label: "Auto-Align", icon: Wand2, desc: "ICP shape matching" },
  { key: "manual", label: "Manual Adjust", icon: Move, desc: "Fine-tune position" },
];

export const AlignmentStep = memo(function AlignmentStep({ importer }: AlignmentStepProps) {
  const hasAlignment = !!importer.transform;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-foreground text-sm font-medium">Align to Country Border</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          {hasAlignment
            ? "Initial alignment applied automatically. Fine-tune below if needed."
            : "Align the imported provinces to your country\u2019s border on the world map."}
        </p>
      </div>

      {/* Auto-alignment status */}
      {hasAlignment && (
        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-700 dark:text-green-400">
          <Check className="h-3.5 w-3.5 shrink-0" />
          Auto-aligned to country border. Use manual adjust for fine-tuning.
        </div>
      )}

      {/* Mode selector */}
      <div className="grid grid-cols-3 gap-1.5">
        {MODES.map((m) => {
          const Icon = m.icon;
          const isActive = importer.alignmentMode === m.key;
          return (
            <button
              key={m.key}
              onClick={() => importer.setAlignmentMode(m.key)}
              className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center transition-colors ${
                isActive
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[10px] font-medium">{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Mode-specific controls */}
      {importer.alignmentMode === "reference-points" && (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs">
            Click corresponding points on the province map and the country border. Need at least 3
            point pairs for accurate alignment.
          </p>

          {importer.referencePoints.length > 0 && (
            <div className="space-y-1">
              {importer.referencePoints.map((pt, i) => (
                <div
                  key={i}
                  className="bg-accent flex items-center justify-between rounded px-2 py-1 text-[10px]"
                >
                  <span>
                    Point {i + 1}: [{pt.source[0]?.toFixed(2)}, {pt.source[1]?.toFixed(2)}] → [
                    {pt.target[0]?.toFixed(2)}, {pt.target[1]?.toFixed(2)}]
                  </span>
                  <button
                    onClick={() => importer.removeReferencePoint(i)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={importer.applyReferencePointAlignment}
            disabled={importer.referencePoints.length < 2}
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-40"
          >
            Apply Alignment ({importer.referencePoints.length} points)
          </button>
        </div>
      )}

      {importer.alignmentMode === "auto-align" && (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs">
            {hasAlignment
              ? "Re-run auto-alignment to recompute the best fit using ICP shape matching."
              : "Automatically matches the outer boundary of your provinces to the country border using iterative shape matching (ICP algorithm)."}
          </p>
          <button
            onClick={importer.applyAutoAlignment}
            disabled={importer.isProcessing || !importer.countryBorder}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-40"
          >
            {importer.isProcessing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Aligning...
              </>
            ) : (
              <>
                <Wand2 className="h-3.5 w-3.5" />
                {hasAlignment ? "Re-run Auto-Align" : "Auto-Align"}
              </>
            )}
          </button>
        </div>
      )}

      {/* Snap to Border — available after any alignment */}
      {hasAlignment && (
        <div className="border-primary/40 bg-primary/5 space-y-2 rounded-lg border border-dashed p-3">
          <p className="text-muted-foreground text-xs">
            Once alignment looks close, snap province edges to the country border:
          </p>
          <button
            onClick={() => {
              importer.applySnapping();
            }}
            disabled={!importer.countryBorder || importer.isProcessing}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-40"
          >
            <Magnet className="h-3.5 w-3.5" />
            Snap to Country Border
          </button>
          <p className="text-muted-foreground text-[10px]">
            Clips provinces to the border, snaps outer vertices, and aligns shared edges. You can
            re-adjust and snap again.
          </p>
        </div>
      )}

      {importer.alignmentMode === "manual" && (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs">
            Fine-tune position, rotation, and scale. Changes preview in real-time.
          </p>

          {/* Translate X */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              <Move className="h-3 w-3" /> Shift East/West
            </label>
            <input
              type="range"
              min={-5}
              max={5}
              step={0.01}
              value={importer.manualTransform.translate[0]}
              onChange={(e) =>
                importer.setManualTransform({
                  ...importer.manualTransform,
                  translate: [parseFloat(e.target.value), importer.manualTransform.translate[1]],
                })
              }
              className="w-full"
            />
            <div className="text-muted-foreground flex justify-between text-[10px]">
              <span>-5°</span>
              <span className="text-foreground font-mono font-medium">
                {importer.manualTransform.translate[0].toFixed(2)}°
              </span>
              <span>+5°</span>
            </div>
          </div>

          {/* Translate Y */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              <Move className="h-3 w-3" /> Shift North/South
            </label>
            <input
              type="range"
              min={-5}
              max={5}
              step={0.01}
              value={importer.manualTransform.translate[1]}
              onChange={(e) =>
                importer.setManualTransform({
                  ...importer.manualTransform,
                  translate: [importer.manualTransform.translate[0], parseFloat(e.target.value)],
                })
              }
              className="w-full"
            />
            <div className="text-muted-foreground flex justify-between text-[10px]">
              <span>-5°</span>
              <span className="text-foreground font-mono font-medium">
                {importer.manualTransform.translate[1].toFixed(2)}°
              </span>
              <span>+5°</span>
            </div>
          </div>

          {/* Rotation */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              <RotateCw className="h-3 w-3" /> Rotation
            </label>
            <input
              type="range"
              min={-45}
              max={45}
              step={0.5}
              value={importer.manualTransform.rotate}
              onChange={(e) =>
                importer.setManualTransform({
                  ...importer.manualTransform,
                  rotate: parseFloat(e.target.value),
                })
              }
              className="w-full"
            />
            <div className="text-muted-foreground flex justify-between text-[10px]">
              <span>-45°</span>
              <span className="text-foreground font-mono font-medium">
                {importer.manualTransform.rotate.toFixed(1)}°
              </span>
              <span>+45°</span>
            </div>
          </div>

          {/* Scale */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              <ZoomIn className="h-3 w-3" /> Scale
            </label>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.01}
              value={importer.manualTransform.scale}
              onChange={(e) =>
                importer.setManualTransform({
                  ...importer.manualTransform,
                  scale: parseFloat(e.target.value),
                })
              }
              className="w-full"
            />
            <div className="text-muted-foreground flex justify-between text-[10px]">
              <span>0.5x</span>
              <span className="text-foreground font-mono font-medium">
                {importer.manualTransform.scale.toFixed(2)}x
              </span>
              <span>2x</span>
            </div>
          </div>

          {/* Reset manual transform button */}
          <button
            onClick={() => importer.setManualTransform({ translate: [0, 0], rotate: 0, scale: 1 })}
            className="border-border text-muted-foreground hover:bg-accent hover:text-foreground w-full rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
          >
            Reset Manual Adjustments
          </button>
        </div>
      )}
    </div>
  );
});

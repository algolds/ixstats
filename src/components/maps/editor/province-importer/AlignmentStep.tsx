"use client";

import { Button } from "~/components/ui/button";
import React, { memo } from "react";
import {
  Archery as Crosshair,
  MagicWand as Wand2,
  ArrowSeparate as Move,
  Refresh as RotateCw,
  ZoomIn,
  SystemRestart as Loader2,
  Trash as Trash2,
  Check,
  Magnet,
} from "iconoir-react";
import type { useProvinceImporter } from "~/hooks/useProvinceImporter";
import type { AlignmentMode } from "~/lib/maps/province-importer/types";
import { Slider } from "~/components/ui/slider";
import { SegmentedControl } from "~/components/ui/segmented-control";

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
        <h3 className="text-label text-body font-medium">Align to Country Border</h3>
        <p className="text-label-secondary text-footnote mt-1">
          {hasAlignment
            ? "Initial alignment applied automatically. Fine-tune below if needed."
            : "Align the imported provinces to your country\u2019s border on the world map."}
        </p>
      </div>

      {/* Auto-alignment status */}
      {hasAlignment && (
        <div className="bg-green/15 rounded-control text-footnote text-green-ink flex items-center gap-2 px-3 py-2">
          <Check className="h-3.5 w-3.5 shrink-0" />
          Auto-aligned to country border. Use manual adjust for fine-tuning.
        </div>
      )}

      {/* Mode selector */}
      <SegmentedControl
        aria-label="Alignment mode"
        fullWidth
        size="sm"
        value={importer.alignmentMode}
        onValueChange={(v) => importer.setAlignmentMode(v as AlignmentMode)}
        options={MODES.map((m) => ({
          value: m.key,
          label: m.label,
          icon: <m.icon aria-hidden />,
        }))}
      />

      {/* Mode-specific controls */}
      {importer.alignmentMode === "reference-points" && (
        <div className="space-y-3">
          <p className="text-label-secondary text-footnote">
            Click corresponding points on the province map and the country border. Need at least 3
            point pairs for accurate alignment.
          </p>

          {importer.referencePoints.length > 0 && (
            <div className="space-y-1">
              {importer.referencePoints.map((pt, i) => (
                <div
                  key={i}
                  className="bg-fill-3 text-footnote rounded-control-sm flex items-center justify-between px-2 py-1"
                >
                  <span>
                    Point {i + 1}: [{pt.source[0]?.toFixed(2)}, {pt.source[1]?.toFixed(2)}] → [
                    {pt.target[0]?.toFixed(2)}, {pt.target[1]?.toFixed(2)}]
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => importer.removeReferencePoint(i)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button
            size="sm"
            className="w-full"
            onClick={importer.applyReferencePointAlignment}
            disabled={importer.referencePoints.length < 2}
          >
            Apply Alignment ({importer.referencePoints.length} points)
          </Button>
        </div>
      )}

      {importer.alignmentMode === "auto-align" && (
        <div className="space-y-3">
          <p className="text-label-secondary text-footnote">
            {hasAlignment
              ? "Re-run auto-alignment to recompute the best fit using ICP shape matching."
              : "Automatically matches the outer boundary of your provinces to the country border using iterative shape matching (ICP algorithm)."}
          </p>
          <Button
            size="sm"
            className="w-full justify-center"
            onClick={importer.applyAutoAlignment}
            disabled={importer.isProcessing || !importer.countryBorder}
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
          </Button>
        </div>
      )}

      {/* Snap to Border — available after any alignment */}
      {hasAlignment && (
        <div className="border-tint/40 bg-tint-fill rounded-control space-y-2 border border-dashed p-3">
          <p className="text-label-secondary text-footnote">
            Once alignment looks close, snap province edges to the country border:
          </p>
          <Button
            size="sm"
            className="w-full justify-center"
            onClick={() => {
              importer.applySnapping();
            }}
            disabled={!importer.countryBorder || importer.isProcessing}
          >
            <Magnet className="h-3.5 w-3.5" />
            Snap to Country Border
          </Button>
          <p className="text-label-secondary text-footnote">
            Clips provinces to the border, snaps outer vertices, and aligns shared edges. You can
            re-adjust and snap again.
          </p>
        </div>
      )}

      {importer.alignmentMode === "manual" && (
        <div className="space-y-3">
          <p className="text-label-secondary text-footnote">
            Fine-tune position, rotation, and scale. Changes preview in real-time.
          </p>

          {/* Translate X */}
          <div className="space-y-2">
            <label className="text-label-secondary text-footnote flex items-center gap-2">
              <Move className="h-3 w-3" /> Shift East/West
            </label>
            <Slider
              aria-label="Shift east/west"
              min={-5}
              max={5}
              step={0.01}
              value={[importer.manualTransform.translate[0]]}
              onValueChange={([v]) =>
                v !== undefined &&
                importer.setManualTransform({
                  ...importer.manualTransform,
                  translate: [v, importer.manualTransform.translate[1]],
                })
              }
              className="w-full py-2"
            />
            <div className="text-label-secondary text-footnote flex justify-between">
              <span>-5°</span>
              <span className="text-label font-mono font-medium">
                {importer.manualTransform.translate[0].toFixed(2)}°
              </span>
              <span>+5°</span>
            </div>
          </div>

          {/* Translate Y */}
          <div className="space-y-2">
            <label className="text-label-secondary text-footnote flex items-center gap-2">
              <Move className="h-3 w-3" /> Shift North/South
            </label>
            <Slider
              aria-label="Shift north/south"
              min={-5}
              max={5}
              step={0.01}
              value={[importer.manualTransform.translate[1]]}
              onValueChange={([v]) =>
                v !== undefined &&
                importer.setManualTransform({
                  ...importer.manualTransform,
                  translate: [importer.manualTransform.translate[0], v],
                })
              }
              className="w-full py-2"
            />
            <div className="text-label-secondary text-footnote flex justify-between">
              <span>-5°</span>
              <span className="text-label font-mono font-medium">
                {importer.manualTransform.translate[1].toFixed(2)}°
              </span>
              <span>+5°</span>
            </div>
          </div>

          {/* Rotation */}
          <div className="space-y-2">
            <label className="text-label-secondary text-footnote flex items-center gap-2">
              <RotateCw className="h-3 w-3" /> Rotation
            </label>
            <Slider
              aria-label="Rotation"
              min={-45}
              max={45}
              step={0.5}
              value={[importer.manualTransform.rotate]}
              onValueChange={([v]) =>
                v !== undefined &&
                importer.setManualTransform({
                  ...importer.manualTransform,
                  rotate: v,
                })
              }
              className="w-full py-2"
            />
            <div className="text-label-secondary text-footnote flex justify-between">
              <span>-45°</span>
              <span className="text-label font-mono font-medium">
                {importer.manualTransform.rotate.toFixed(1)}°
              </span>
              <span>+45°</span>
            </div>
          </div>

          {/* Scale */}
          <div className="space-y-2">
            <label className="text-label-secondary text-footnote flex items-center gap-2">
              <ZoomIn className="h-3 w-3" /> Scale
            </label>
            <Slider
              aria-label="Scale"
              min={0.5}
              max={2}
              step={0.01}
              value={[importer.manualTransform.scale]}
              onValueChange={([v]) =>
                v !== undefined &&
                importer.setManualTransform({
                  ...importer.manualTransform,
                  scale: v,
                })
              }
              className="w-full py-2"
            />
            <div className="text-label-secondary text-footnote flex justify-between">
              <span>0.5x</span>
              <span className="text-label font-medium tabular-nums">
                {importer.manualTransform.scale.toFixed(2)}x
              </span>
              <span>2x</span>
            </div>
          </div>

          {/* Reset manual transform button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => importer.setManualTransform({ translate: [0, 0], rotate: 0, scale: 1 })}
          >
            Reset Manual Adjustments
          </Button>
        </div>
      )}
    </div>
  );
});

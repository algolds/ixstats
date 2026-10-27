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
    label: "Reference points",
    icon: Crosshair,
    desc: "Place 3+ matching points",
  },
  { key: "auto-align", label: "Auto-Align", icon: Wand2, desc: "ICP shape matching" },
  { key: "manual", label: "Manual adjust", icon: Move, desc: "Fine-tune position" },
];

type Importer = AlignmentStepProps["importer"];
type ManualTransform = Importer["manualTransform"];

interface ManualSlider {
  label: string;
  ariaLabel: string;
  icon: typeof Move;
  min: number;
  max: number;
  step: number;
  minText: string;
  maxText: string;
  valueClass: string;
  format: (t: ManualTransform) => string;
  get: (t: ManualTransform) => number;
  set: (t: ManualTransform, v: number) => ManualTransform;
}

const DEGREE_CLASS = "text-label font-mono font-medium";

const MANUAL_SLIDERS: ManualSlider[] = [
  {
    label: "Shift East/West",
    ariaLabel: "Shift east/west",
    icon: Move,
    min: -5,
    max: 5,
    step: 0.01,
    minText: "-5°",
    maxText: "+5°",
    valueClass: DEGREE_CLASS,
    format: (t) => `${t.translate[0].toFixed(2)}°`,
    get: (t) => t.translate[0],
    set: (t, v) => ({ ...t, translate: [v, t.translate[1]] }),
  },
  {
    label: "Shift North/South",
    ariaLabel: "Shift north/south",
    icon: Move,
    min: -5,
    max: 5,
    step: 0.01,
    minText: "-5°",
    maxText: "+5°",
    valueClass: DEGREE_CLASS,
    format: (t) => `${t.translate[1].toFixed(2)}°`,
    get: (t) => t.translate[1],
    set: (t, v) => ({ ...t, translate: [t.translate[0], v] }),
  },
  {
    label: "Rotation",
    ariaLabel: "Rotation",
    icon: RotateCw,
    min: -45,
    max: 45,
    step: 0.5,
    minText: "-45°",
    maxText: "+45°",
    valueClass: DEGREE_CLASS,
    format: (t) => `${t.rotate.toFixed(1)}°`,
    get: (t) => t.rotate,
    set: (t, v) => ({ ...t, rotate: v }),
  },
  {
    label: "Scale",
    ariaLabel: "Scale",
    icon: ZoomIn,
    min: 0.5,
    max: 2,
    step: 0.01,
    minText: "0.5x",
    maxText: "2x",
    valueClass: "text-label font-medium tabular-nums",
    format: (t) => `${t.scale.toFixed(2)}x`,
    get: (t) => t.scale,
    set: (t, v) => ({ ...t, scale: v }),
  },
];

function ManualAdjustControls({ importer }: { importer: Importer }) {
  const transform = importer.manualTransform;
  return (
    <div className="space-y-3">
      <p className="text-label-secondary text-footnote">
        Fine-tune position, rotation, and scale. Changes preview as you adjust.
      </p>

      {MANUAL_SLIDERS.map((slider) => (
        <div key={slider.label} className="space-y-2">
          <label className="text-label-secondary text-footnote flex items-center gap-2">
            <slider.icon className="h-3 w-3" /> {slider.label}
          </label>
          <Slider
            aria-label={slider.ariaLabel}
            min={slider.min}
            max={slider.max}
            step={slider.step}
            value={[slider.get(transform)]}
            onValueChange={([v]) =>
              v !== undefined && importer.setManualTransform(slider.set(transform, v))
            }
            className="w-full py-2"
          />
          <div className="text-label-secondary text-footnote flex justify-between">
            <span>{slider.minText}</span>
            <span className={slider.valueClass}>{slider.format(transform)}</span>
            <span>{slider.maxText}</span>
          </div>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => importer.setManualTransform({ translate: [0, 0], rotate: 0, scale: 1 })}
      >
        Reset manual adjustments
      </Button>
    </div>
  );
}

export const AlignmentStep = memo(function AlignmentStep({ importer }: AlignmentStepProps) {
  const hasAlignment = !!importer.transform;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-label text-body font-medium">Align to country border</h3>
        <p className="text-label-secondary text-footnote mt-1">
          {hasAlignment
            ? "Initial alignment applied automatically. Fine-tune below if needed."
            : "Align the imported provinces to your country\u2019s border on the world map."}
        </p>
      </div>

      {hasAlignment && (
        <div className="bg-green/15 rounded-control text-footnote text-green-ink flex items-center gap-2 px-3 py-2">
          <Check className="h-3.5 w-3.5 shrink-0" />
          Auto-aligned to country border. Use manual adjust for fine-tuning.
        </div>
      )}

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
            Snap to country border
          </Button>
          <p className="text-label-secondary text-footnote">
            Clips provinces to the border, snaps outer vertices, and aligns shared edges. You can
            re-adjust and snap again.
          </p>
        </div>
      )}

      {importer.alignmentMode === "manual" && <ManualAdjustControls importer={importer} />}
    </div>
  );
});

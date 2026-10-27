"use client";

import { SwitchRow } from "~/components/maps/editor/panels/WorldControlParts";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import type { StudioProjection } from "~/hooks/useStudioMap";
import type { DiagnosticKind } from "~/lib/worldgen/diagnostics";
import { isShownByDefault, type DraftLayerKey } from "~/lib/maps/world-draft-layers";
import { useStudio } from "./StudioContext";
import { StudioLegend } from "./StudioLegend";

/** The world's layers the draft draws, in the order the map stacks them from the top. */
const WORLD_LAYERS: ReadonlyArray<{ key: DraftLayerKey; label: string }> = [
  { key: "political", label: "Political" },
  { key: "relief", label: "Relief" },
  { key: "icecaps", label: "Ice caps" },
  { key: "background", label: "Land" },
  { key: "altitudes", label: "Elevation" },
  { key: "climate", label: "Climate zones" },
  { key: "rivers", label: "Rivers" },
  { key: "lakes", label: "Lakes" },
];

const PROJECTIONS: ReadonlyArray<{ value: StudioProjection; label: string }> = [
  { value: "globe", label: "Globe" },
  { value: "flat", label: "Flat" },
];

const DIAGNOSTIC_LABELS: Record<DiagnosticKind, string> = {
  height: "Height",
  temperature: "Temperature",
  rainfall: "Rainfall",
  flow: "River flow",
  cells: "Cells",
};

// Not `DIAGNOSTIC_KINDS` itself: that module is the worker's drawing code, and the page needs only the names
const KINDS = Object.keys(DIAGNOSTIC_LABELS) as DiagnosticKind[];

const isDiagnosticKind = (value: string): value is DiagnosticKind =>
  KINDS.some((kind) => kind === value);

/**
 * The Layers tab: the map's projection, switches for the world's layers, one diagnostic at a time with its legend,
 * and the nation seeds.
 */
export function StudioLayersTab() {
  const { projection, setProjection, visible, setLayerVisible, diagnostics } = useStudio();
  const { kind, setKind, image, seedsOn, setSeedsOn, error } = diagnostics;
  return (
    <div className="space-y-5 p-3">
      <section aria-label="Map" className="space-y-2">
        <h3 className="text-headline">Map</h3>
        <SegmentedControl
          aria-label="Projection"
          size="sm"
          value={projection}
          onValueChange={setProjection}
          options={PROJECTIONS}
        />
        <p className="text-label-secondary text-caption">
          {projection === "globe"
            ? "Land near the poles keeps its true shape. The globe turns flat as you zoom in."
            : "The flat map stretches land near the poles."}
        </p>
      </section>

      <section aria-label="World layers" className="space-y-2">
        <h3 className="text-headline">World layers</h3>
        {WORLD_LAYERS.map(({ key, label }) => (
          <SwitchRow
            key={key}
            label={label}
            checked={visible[key] ?? isShownByDefault(key)}
            onCheckedChange={(on) => setLayerVisible(key, on)}
          />
        ))}
      </section>

      <section aria-label="Diagnostics" className="space-y-2">
        <h3 className="text-headline">Diagnostics</h3>
        <ToggleGroup
          type="single"
          variant="pill"
          size="sm"
          aria-label="Diagnostic"
          value={kind ?? ""}
          onValueChange={(next) => setKind(isDiagnosticKind(next) ? next : null)}
        >
          {KINDS.map((option) => (
            <ToggleGroupItem key={option} value={option}>
              {DIAGNOSTIC_LABELS[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {kind !== null && !image && !error && (
          <p role="status" className="text-label-secondary text-caption">
            Drawing {DIAGNOSTIC_LABELS[kind].toLowerCase()}.
          </p>
        )}
        {image && <StudioLegend legend={image.legend} />}
        {error && (
          <p role="alert" className="text-destructive text-caption">
            {error}
          </p>
        )}
        <SwitchRow label="Nation seeds" checked={seedsOn} onCheckedChange={setSeedsOn} />
      </section>
    </div>
  );
}

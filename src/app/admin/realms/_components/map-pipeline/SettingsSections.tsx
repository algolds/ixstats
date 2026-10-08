"use client";

import { Compass, Settings, TriangleFlag } from "iconoir-react";
import type { CoverageSettings, RealmMapPipeline } from "~/lib/maps/realm-map-pipeline";
import { ValueSelect } from "~/components/ui/value-select";
import { Field, NumberInput, PipelineSection, SwitchRow, invalidProps } from "./fields";
import type { DraftErrors } from "./pipeline-draft";

const VIEW_OPTIONS = [
  ["auto", "Centre on the continent with the most nations"],
  ["keep", "Keep the view saved in the map editor"],
] as const;

/** The flags step: copy the nations' wiki flags and arms to local files. */
export function FlagsSection({
  flags,
  onChange,
}: {
  flags: RealmMapPipeline["flags"];
  onChange: (flags: RealmMapPipeline["flags"]) => void;
}) {
  return (
    <PipelineSection
      icon={<TriangleFlag />}
      title="Flags"
      description="Copy every nation's flag and coat of arms from its wiki to local files, so the map does not hotlink them."
      action={
        <SwitchRow
          id="flags-localize"
          label="Localize flags"
          checked={flags?.localize === true}
          onChange={(localize) => onChange(localize ? { localize } : undefined)}
        />
      }
    />
  );
}

/** Where the map opens: the automatic centre, or the view saved in the map editor. */
export function DefaultViewSection({
  defaultView,
  onChange,
}: {
  defaultView: RealmMapPipeline["defaultView"];
  onChange: (defaultView: RealmMapPipeline["defaultView"]) => void;
}) {
  return (
    <PipelineSection
      icon={<Compass />}
      title="Default view"
      description="The automatic centre is the area-weighted middle of the biggest continent's nations, at IxWorld's home zoom."
    >
      <div className="max-w-md">
        <ValueSelect
          aria-label="Default view"
          value={defaultView ?? "keep"}
          options={VIEW_OPTIONS}
          onValueChange={(view) => onChange(view === "auto" ? "auto" : undefined)}
        />
      </div>
    </PipelineSection>
  );
}

/** Border smoothing: the realm's borders simplified and rounded as one coverage (shared edges stay shared). */
export function SmoothingSection({
  coverage,
  errors,
  onChange,
}: {
  coverage: CoverageSettings | undefined;
  errors: DraftErrors;
  onChange: (coverage: CoverageSettings | undefined) => void;
}) {
  return (
    <PipelineSection
      icon={<Settings />}
      title="Border smoothing"
      description="Used by border repair and by the source sync after it writes borders. A tolerance of about one source pixel works: 360 divided by the image width (0.045° for 8000 px)."
      action={
        <SwitchRow
          id="coverage-on"
          label="Smooth borders"
          checked={!!coverage}
          onChange={(on) => onChange(on ? { tolerance: 0.045, smooth: 2 } : undefined)}
        />
      }
    >
      {coverage && (
        <div className="grid max-w-md gap-3 sm:grid-cols-2">
          <Field id="coverage-tolerance" label="Tolerance (°)" error={errors["coverage.tolerance"]}>
            <NumberInput
              id="coverage-tolerance"
              value={coverage.tolerance}
              onChange={(tolerance) =>
                onChange({ ...coverage, tolerance: tolerance ?? Number.NaN })
              }
              {...invalidProps("coverage-tolerance", errors["coverage.tolerance"])}
            />
          </Field>
          <Field id="coverage-smooth" label="Smoothing rounds" error={errors["coverage.smooth"]}>
            <NumberInput
              id="coverage-smooth"
              value={coverage.smooth}
              onChange={(smooth) => onChange({ ...coverage, smooth: smooth ?? Number.NaN })}
              {...invalidProps("coverage-smooth", errors["coverage.smooth"])}
            />
          </Field>
        </div>
      )}
    </PipelineSection>
  );
}

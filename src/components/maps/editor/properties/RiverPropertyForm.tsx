"use client";

import React, { useMemo } from "react";
import type { NamedRiverFormData, EditorFeature } from "~/hooks/useMapEditor";
import { polylineLengthKm } from "~/lib/maps/geo-math";
import { WikiLinkWizard } from "../WikiLinkWizard";

const inputClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

interface RiverPropertyFormProps {
  form: NamedRiverFormData;
  onChange: (form: NamedRiverFormData) => void;
  pendingGeometry?: object | null;
  selectedFeature?: EditorFeature | null;
}

export const RiverPropertyForm = React.memo(function RiverPropertyForm({
  form,
  onChange,
  pendingGeometry,
  selectedFeature,
}: RiverPropertyFormProps) {
  const activeGeom = (form.geometry ?? pendingGeometry ?? selectedFeature?.geometry) as {
    type?: string;
    coordinates?: unknown;
  } | null;
  const hasGeom = !!activeGeom;

  const lengthKm = useMemo(() => {
    if (!activeGeom) return (selectedFeature?.properties?.lengthKm as number | undefined);
    if (activeGeom.type === "LineString" && Array.isArray(activeGeom.coordinates)) {
      return polylineLengthKm(activeGeom.coordinates as [number, number][]);
    }
    if (
      activeGeom.type === "MultiLineString" &&
      Array.isArray(activeGeom.coordinates) &&
      Array.isArray(activeGeom.coordinates[0])
    ) {
      let total = 0;
      for (const line of activeGeom.coordinates as [number, number][][]) {
        total += polylineLengthKm(line);
      }
      return total;
    }
    return (selectedFeature?.properties?.lengthKm as number | undefined);
  }, [activeGeom, selectedFeature?.properties?.lengthKm]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="River Name"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        className={inputClasses}
        autoFocus
      />

      <div className="border-border/60 bg-muted/20 rounded-lg border px-3 py-2 text-xs">
        <div className="text-muted-foreground text-left font-medium">
          Line Geometry:{" "}
          {hasGeom ? (
            <span className="text-foreground font-semibold">
              Drawn {lengthKm !== undefined && `(${lengthKm.toFixed(2)} km)`}
            </span>
          ) : (
            <span className="text-amber-500 italic">Not drawn yet (use Line tool)</span>
          )}
        </div>
        {!hasGeom && (
          <div className="text-muted-foreground mt-1 text-left text-[10px]">
            Use the line drawing tool in the map controls to draw the path of the river.
          </div>
        )}
      </div>

      <WikiLinkWizard
        value={form.wikiPageTitle}
        onChange={(title) => onChange({ ...form, wikiPageTitle: title })}
        onImport={(fields) => {
          onChange({ ...form, wikiPageTitle: fields.wikiPageTitle });
        }}
        placeholder="Search wiki to link..."
      />
    </div>
  );
});

"use client";
import React, { useMemo } from "react";
import type { NamedRiverFormData, EditorFeature } from "~/hooks/useMapEditor";
import { polylineLengthKm } from "~/lib/maps/geo-math";
import { WikiLinkWizard } from "../WikiLinkWizard";
import { Card } from "~/components/ui/card";

const inputClasses =
  "w-full rounded-control border border-separator bg-surface px-3 py-2 sm:py-2 text-body sm:text-body text-label placeholder:text-label-secondary transition-colors focus:border-tint focus:outline-none focus:ring-1 focus:ring-tint";

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
    if (!activeGeom) return selectedFeature?.properties?.lengthKm as number | undefined;
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
    return selectedFeature?.properties?.lengthKm as number | undefined;
  }, [activeGeom, selectedFeature?.properties?.lengthKm]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="River name"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        className={inputClasses}
        autoFocus
      />

      <Card className="text-footnote px-3 py-2">
        <div className="text-label-secondary text-left font-medium">
          Line Geometry:{" "}
          {hasGeom ? (
            <span className="text-label font-semibold">
              Drawn {lengthKm !== undefined && `(${lengthKm.toFixed(2)} km)`}
            </span>
          ) : (
            <span className="text-yellow italic">Not drawn yet (use Line tool)</span>
          )}
        </div>
        {!hasGeom && (
          <div className="text-label-secondary text-footnote mt-1 text-left">
            Use the line drawing tool in the map controls to draw the path of the river.
          </div>
        )}
      </Card>

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

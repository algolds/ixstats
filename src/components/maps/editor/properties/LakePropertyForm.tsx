"use client";
import React, { useMemo } from "react";
import type { NamedLakeFormData, EditorFeature } from "~/hooks/map-editor/editor-types";
import { geometryAreaSqKm } from "~/lib/maps/geo-math";
import { WikiLinkWizard } from "../WikiLinkWizard";
import { Card } from "~/components/ui/card";

const inputClasses =
  "w-full rounded-control border border-separator bg-surface px-3 py-2 sm:py-2 text-body sm:text-body text-label placeholder:text-label-secondary transition-colors focus:border-tint focus:outline-none focus:ring-1 focus:ring-tint";

interface LakePropertyFormProps {
  form: NamedLakeFormData;
  onChange: (form: NamedLakeFormData) => void;
  pendingGeometry?: object | null;
  selectedFeature?: EditorFeature | null;
}

export const LakePropertyForm = React.memo(function LakePropertyForm({
  form,
  onChange,
  pendingGeometry,
  selectedFeature,
}: LakePropertyFormProps) {
  const activeGeom = (form.geometry ?? pendingGeometry ?? selectedFeature?.geometry) as {
    type?: string;
    coordinates?: unknown;
  } | null;
  const hasGeom = !!activeGeom;

  const areaSqKm = useMemo(() => {
    if (!activeGeom) return selectedFeature?.properties?.areaSqKm as number | undefined;
    if (
      (activeGeom.type === "Polygon" || activeGeom.type === "MultiPolygon") &&
      Array.isArray(activeGeom.coordinates)
    ) {
      return geometryAreaSqKm(
        activeGeom as { type: string; coordinates: number[][][] | number[][][][] }
      );
    }
    return selectedFeature?.properties?.areaSqKm as number | undefined;
  }, [activeGeom, selectedFeature?.properties?.areaSqKm]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Lake Name"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        className={inputClasses}
        autoFocus
      />

      <div>
        <label className="text-label-secondary text-caption mb-1 block text-left">
          Max Depth (meters, optional)
        </label>
        <input
          type="number"
          placeholder="e.g. 150"
          value={form.maxDepthM ?? ""}
          onChange={(e) =>
            onChange({
              ...form,
              maxDepthM:
                e.target.value === "" ? undefined : parseFloat(e.target.value) || undefined,
            })
          }
          className={inputClasses}
        />
      </div>

      <Card className="text-footnote px-3 py-2">
        <div className="text-label-secondary text-left font-medium">
          Polygon Geometry:{" "}
          {hasGeom ? (
            <span className="text-label font-semibold">
              Drawn {areaSqKm !== undefined && `(${areaSqKm.toFixed(2)} km²)`}
            </span>
          ) : (
            <span className="text-yellow italic">Not drawn yet (use Polygon tool)</span>
          )}
        </div>
        {!hasGeom && (
          <div className="text-label-secondary text-footnote mt-1 text-left">
            Use the polygon drawing tool in the map controls to trace the contours of the lake.
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

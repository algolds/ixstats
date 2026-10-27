"use client";
import React, { useMemo } from "react";
import type { NamedLakeFormData, EditorFeature } from "~/hooks/map-editor/editor-types";
import { geometryAreaSqKm } from "~/lib/maps/geo-math";
import { Field, GeometryStatus, inputClasses, WikiLinkField } from "./fields";

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

  const areaSqKm = useMemo(() => {
    const isPolygon = activeGeom?.type === "Polygon" || activeGeom?.type === "MultiPolygon";
    if (activeGeom && isPolygon && Array.isArray(activeGeom.coordinates)) {
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
        placeholder="Lake name"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        className={inputClasses}
        autoFocus
      />

      <Field label="Max Depth (meters, optional)">
        <input
          type="number"
          placeholder="e.g. 150"
          value={form.maxDepthM ?? ""}
          onChange={(e) =>
            onChange({ ...form, maxDepthM: parseFloat(e.target.value) || undefined })
          }
          className={inputClasses}
        />
      </Field>

      <GeometryStatus
        label="Polygon Geometry"
        hasGeom={!!activeGeom}
        measure={areaSqKm === undefined ? undefined : `${areaSqKm.toFixed(2)} km²`}
        missing="Not drawn yet (use Polygon tool)"
        hint="Use the polygon drawing tool in the map controls to trace the contours of the lake."
      />

      <WikiLinkField form={form} onChange={onChange} />
    </div>
  );
});

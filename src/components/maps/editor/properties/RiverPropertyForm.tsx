"use client";
import React, { useMemo } from "react";
import type { NamedRiverFormData, EditorFeature } from "~/hooks/useMapEditor";
import { polylineLengthKm } from "~/lib/maps/geo-math";
import { GeometryStatus, inputClasses, WikiLinkField } from "./fields";

interface RiverPropertyFormProps {
  form: NamedRiverFormData;
  onChange: (form: NamedRiverFormData) => void;
  pendingGeometry?: object | null;
  selectedFeature?: EditorFeature | null;
}

type Line = [number, number][];

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

  const lengthKm = useMemo(() => {
    const coords = activeGeom?.coordinates;
    if (activeGeom?.type === "LineString" && Array.isArray(coords)) {
      return polylineLengthKm(coords as Line);
    }
    if (
      activeGeom?.type === "MultiLineString" &&
      Array.isArray(coords) &&
      Array.isArray(coords[0])
    ) {
      return (coords as Line[]).reduce((total, line) => total + polylineLengthKm(line), 0);
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

      <GeometryStatus
        label="Line Geometry"
        hasGeom={!!activeGeom}
        measure={lengthKm === undefined ? undefined : `${lengthKm.toFixed(2)} km`}
        missing="Not drawn yet (use Line tool)"
        hint="Use the line drawing tool in the map controls to draw the path of the river."
      />

      <WikiLinkField form={form} onChange={onChange} />
    </div>
  );
});

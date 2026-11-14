"use client";
import React from "react";
import type { PeakFormData } from "~/hooks/useMapEditor";
import { Input } from "~/components/ui/input";
import { CoordinatePicker } from "./CoordinatePicker";
import { Field, SubdivisionSelect, WikiLinkField, type PointFormProps } from "./fields";

const MEASUREMENTS = [
  { key: "elevation", label: "Elevation (m)", placeholder: "e.g. 1500" },
  { key: "prominence", label: "Prominence (m)", placeholder: "e.g. 500" },
] as const;

export const PeakPropertyForm = React.memo(function PeakPropertyForm({
  form,
  onChange,
  pendingCoordinates,
  allFeatures,
  countryId,
  isPickingLocation = false,
  setIsPickingLocation,
}: PointFormProps<PeakFormData>) {
  return (
    <div className="space-y-2">
      <Input
        type="text"
        placeholder="Peak name"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        className="text-footnote h-8 px-2.5"
        autoFocus
      />

      <div className="grid grid-cols-2 gap-2">
        {MEASUREMENTS.map(({ key, label, placeholder }) => (
          <Field key={key} label={label}>
            <Input
              type="number"
              placeholder={placeholder}
              value={form[key] === 0 ? "" : form[key]}
              onChange={(e) => onChange({ ...form, [key]: parseFloat(e.target.value) || 0 })}
              className="text-footnote h-8 px-2.5 tabular-nums"
            />
          </Field>
        ))}
      </div>

      {countryId && (
        <CoordinatePicker
          coordinates={form.coordinates ?? pendingCoordinates}
          isPickingLocation={isPickingLocation}
          setIsPickingLocation={setIsPickingLocation}
        />
      )}

      <WikiLinkField
        form={form}
        onChange={onChange}
        currentCoords={pendingCoordinates ?? undefined}
      />

      <Field label="Subdivision / Region">
        <SubdivisionSelect
          ariaLabel="Subdivision / region"
          value={form.subdivisionId}
          onChange={(subdivisionId) => onChange({ ...form, subdivisionId })}
          allFeatures={allFeatures}
        />
      </Field>
    </div>
  );
});

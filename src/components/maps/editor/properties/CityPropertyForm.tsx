"use client";
import { Button } from "~/components/ui/button";
import React from "react";
import type { CityFormData } from "~/hooks/useMapEditor";
import { CoordinatePicker } from "./CoordinatePicker";
import { ModernTv as Mountain, SystemRestart as Loader2 } from "iconoir-react";
import { api } from "~/trpc/react";
import { Checkbox } from "~/components/ui/checkbox";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { CITY_TYPE_OPTIONS } from "../optionLists";
import { inputClasses, SubdivisionSelect, WikiLinkField, type PointFormProps } from "./fields";

const CAPITAL_FLAGS = [
  { key: "isNationalCapital", label: "National capital" },
  { key: "isSubdivisionCapital", label: "Regional capital" },
] as const;

function ElevationField({
  form,
  onChange,
}: {
  form: CityFormData;
  onChange: (form: CityFormData) => void;
}) {
  const sampleTerrain = api.countryGeo.sampleTerrainAt.useQuery(
    { lng: form.coordinates?.[0] ?? 0, lat: form.coordinates?.[1] ?? 0 },
    { enabled: !!form.coordinates?.[0] && !!form.coordinates?.[1] }
  );
  const derivedFromZone = form.elevation === sampleTerrain.data?.midpoint;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-label-secondary text-caption">Elevation (m)</label>
        {derivedFromZone && sampleTerrain.data && (
          <span className="text-label-secondary text-footnote">
            from zone: {sampleTerrain.data.zoneName}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          placeholder="Elevation (m)"
          value={form.elevation ?? ""}
          readOnly={derivedFromZone && !!sampleTerrain.data}
          onChange={(e) =>
            onChange({
              ...form,
              elevation: e.target.value ? parseInt(e.target.value, 10) : undefined,
            })
          }
          className={inputClasses}
        />
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          type="button"
          title={sampleTerrain.data ? `zone: ${sampleTerrain.data.zoneName}` : undefined}
          disabled={!form.coordinates || sampleTerrain.isFetching || !sampleTerrain.data}
          onClick={() =>
            onChange({
              ...form,
              elevation: sampleTerrain.data?.midpoint ?? form.elevation,
            })
          }
        >
          {sampleTerrain.isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mountain className="h-3.5 w-3.5" />
          )}
          <span>Auto</span>
        </Button>
      </div>
    </div>
  );
}

export const CityPropertyForm = React.memo(function CityPropertyForm({
  form,
  onChange,
  pendingCoordinates,
  allFeatures,
  countryId,
  isPickingLocation = false,
  setIsPickingLocation,
}: PointFormProps<CityFormData>) {
  const setInt = (key: "population" | "foundedYear", raw: string) =>
    onChange({ ...form, [key]: raw ? parseInt(raw, 10) : undefined });

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="City name"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        className={inputClasses}
        autoFocus
      />
      <OptionSelect
        aria-label="City type"
        value={form.cityType}
        onValueChange={(v) => onChange({ ...form, cityType: v })}
        options={CITY_TYPE_OPTIONS}
        size="sm"
        className="w-full"
      />

      {countryId && (
        <CoordinatePicker
          coordinates={form.coordinates ?? pendingCoordinates}
          isPickingLocation={isPickingLocation}
          setIsPickingLocation={setIsPickingLocation}
        />
      )}

      <input
        type="number"
        placeholder="Population (optional)"
        value={form.population ?? ""}
        onChange={(e) => setInt("population", e.target.value)}
        className={inputClasses}
      />
      <div className="grid grid-cols-2 gap-2">
        <ElevationField form={form} onChange={onChange} />
        <input
          type="number"
          placeholder="Founded year"
          value={form.foundedYear ?? ""}
          onChange={(e) => setInt("foundedYear", e.target.value)}
          className={inputClasses}
        />
      </div>
      <div className="space-y-1">
        {CAPITAL_FLAGS.map(({ key, label }) => (
          <label key={key} className="text-label-secondary text-body flex items-center gap-2">
            <Checkbox
              checked={form[key]}
              onCheckedChange={(c) => onChange({ ...form, [key]: c === true })}
            />
            {label}
          </label>
        ))}
      </div>
      <WikiLinkField
        form={form}
        onChange={onChange}
        currentCoords={pendingCoordinates ?? undefined}
        importPopulation
      />
      <SubdivisionSelect
        value={form.subdivisionId}
        onChange={(subdivisionId) => onChange({ ...form, subdivisionId })}
        allFeatures={allFeatures}
      />
    </div>
  );
});

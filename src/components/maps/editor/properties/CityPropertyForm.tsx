"use client";
import { Button } from "~/components/ui/button";
import React from "react";
import type { CityFormData, EditorFeature } from "~/hooks/useMapEditor";
import { WikiLinkWizard } from "../WikiLinkWizard";
import { CoordinatePicker } from "./CoordinatePicker";

import { ModernTv as Mountain, SystemRestart as Loader2 } from "iconoir-react";
import { api } from "~/trpc/react";
import { Checkbox } from "~/components/ui/checkbox";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";

const CITY_TYPES = ["capital", "city", "town", "village", "hamlet", "port", "fortress"];

const inputClasses =
  "w-full rounded-control border border-separator bg-surface px-3 py-2 sm:py-2 text-body sm:text-body text-label placeholder:text-label-secondary transition-colors focus:border-tint focus:outline-none focus:ring-1 focus:ring-tint";

const selectClasses =
  "w-full rounded-control border border-separator bg-surface px-3 py-2 sm:py-2 text-body sm:text-body text-label transition-colors focus:border-tint focus:outline-none focus:ring-1 focus:ring-tint";

const labelClasses = "text-label-secondary text-caption";

interface CityPropertyFormProps {
  form: CityFormData;
  onChange: (form: CityFormData) => void;
  pendingCoordinates?: [number, number] | null;
  allFeatures?: EditorFeature[];
  countryId?: string;
  isPickingLocation?: boolean;
  setIsPickingLocation?: (active: boolean) => void;
}

export const CityPropertyForm = React.memo(function CityPropertyForm({
  form,
  onChange,
  pendingCoordinates,
  allFeatures,
  countryId,
  isPickingLocation = false,
  setIsPickingLocation,
}: CityPropertyFormProps) {
  const activeCoords = form.coordinates ?? pendingCoordinates;
  const subdivisions = React.useMemo(
    () => (allFeatures ?? []).filter((f) => f.type === "subdivision"),
    [allFeatures]
  );

  const sampleTerrain = api.countryGeo.sampleTerrainAt.useQuery(
    { lng: form.coordinates?.[0] ?? 0, lat: form.coordinates?.[1] ?? 0 },
    { enabled: !!form.coordinates?.[0] && !!form.coordinates?.[1] }
  );
  const derivedFromZone = form.elevation === sampleTerrain.data?.midpoint;

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
        options={CITY_TYPES.map((t) => ({
          value: t,
          label: t.charAt(0).toUpperCase() + t.slice(1),
        }))}
        size="sm"
        className="w-full"
      />

      {countryId && (
        <CoordinatePicker
          coordinates={activeCoords}
          isPickingLocation={isPickingLocation}
          setIsPickingLocation={setIsPickingLocation}
        />
      )}

      <input
        type="number"
        placeholder="Population (optional)"
        value={form.population ?? ""}
        onChange={(e) =>
          onChange({
            ...form,
            population: e.target.value ? parseInt(e.target.value, 10) : undefined,
          })
        }
        className={inputClasses}
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className={labelClasses}>Elevation (m)</label>
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
        <input
          type="number"
          placeholder="Founded year"
          value={form.foundedYear ?? ""}
          onChange={(e) =>
            onChange({
              ...form,
              foundedYear: e.target.value ? parseInt(e.target.value, 10) : undefined,
            })
          }
          className={inputClasses}
        />
      </div>
      <div className="space-y-1">
        <label className="text-label-secondary text-body flex items-center gap-2">
          <Checkbox
            checked={form.isNationalCapital}
            onCheckedChange={(c) => onChange({ ...form, isNationalCapital: c === true })}
          />
          National capital
        </label>
        <label className="text-label-secondary text-body flex items-center gap-2">
          <Checkbox
            checked={form.isSubdivisionCapital}
            onCheckedChange={(c) => onChange({ ...form, isSubdivisionCapital: c === true })}
          />
          Regional capital
        </label>
      </div>
      <WikiLinkWizard
        value={form.wikiPageTitle}
        onChange={(title) => onChange({ ...form, wikiPageTitle: title })}
        onImport={(fields) => {
          const updates: Partial<CityFormData> = { wikiPageTitle: fields.wikiPageTitle };
          if (fields.population) updates.population = fields.population;
          onChange({ ...form, ...updates });
        }}
        currentCoords={pendingCoordinates ?? undefined}
        placeholder="Search wiki to link..."
      />
      <OptionSelect
        aria-label="Subdivision"
        value={form.subdivisionId ?? "auto"}
        onValueChange={(v) =>
          onChange({
            ...form,
            subdivisionId: v === "auto" ? "auto" : v === "none" ? "none" : v || undefined,
          })
        }
        options={[
          { value: "auto", label: "&mdash; Auto-detect Region (Recommended) &mdash;" },
          { value: "none", label: "&mdash; None &mdash;" },
          ...subdivisions.map((sub) => ({ value: sub.id, label: sub.name })),
        ]}
        size="sm"
        className="w-full"
      />
    </div>
  );
});

"use client";

import React from "react";
import type { CityFormData, EditorFeature } from "~/hooks/useMapEditor";
import { WikiLinkWizard } from "../WikiLinkWizard";

import { MapPickerModal } from "~/components/maps/core/MapPickerModal";
import { MapPin, Mountain, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";

const CITY_TYPES = ["capital", "city", "town", "village", "hamlet", "port", "fortress"];

const inputClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const selectClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const labelClasses = "text-muted-foreground text-xs font-medium";

interface CityPropertyFormProps {
  form: CityFormData;
  onChange: (form: CityFormData) => void;
  pendingCoordinates?: [number, number] | null;
  allFeatures?: EditorFeature[];
  countryId?: string;
}

export const CityPropertyForm = React.memo(function CityPropertyForm({
  form,
  onChange,
  pendingCoordinates,
  allFeatures,
  countryId,
}: CityPropertyFormProps) {
  const [isMapPickerOpen, setIsMapPickerOpen] = React.useState(false);
  const activeCoords = form.coordinates ?? pendingCoordinates;
  const subdivisions = (allFeatures ?? []).filter((f) => f.type === "subdivision");

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
      <select
        value={form.cityType}
        onChange={(e) => onChange({ ...form, cityType: e.target.value })}
        className={selectClasses}
      >
        {CITY_TYPES.map((t) => (
          <option key={t} value={t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </option>
        ))}
      </select>

      {/* Coordinate Picker Block */}
      {countryId && (
        <div className="border-border/60 bg-muted/20 flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
          <div className="text-muted-foreground text-left font-medium">
            Coordinates:{" "}
            {activeCoords ? (
              <span className="text-foreground font-semibold tabular-nums">
                {activeCoords[1].toFixed(4)}&deg; N, {activeCoords[0].toFixed(4)}&deg; E
              </span>
            ) : (
              <span className="italic">Not placed yet</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsMapPickerOpen(true)}
            className="flex shrink-0 items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700 focus:outline-none dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>Pick on Map</span>
          </button>
        </div>
      )}

      {isMapPickerOpen && countryId && (
        <MapPickerModal
          isOpen={isMapPickerOpen}
          onClose={() => setIsMapPickerOpen(false)}
          onConfirm={(coords) => {
            onChange({ ...form, coordinates: coords });
            setIsMapPickerOpen(false);
          }}
          countryId={countryId}
          title="Pick City Location"
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
              <span className="text-muted-foreground text-[10px]">
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
            <button
              type="button"
              title={sampleTerrain.data ? `zone: ${sampleTerrain.data.zoneName}` : undefined}
              disabled={!form.coordinates || sampleTerrain.isFetching || !sampleTerrain.data}
              onClick={() =>
                onChange({
                  ...form,
                  elevation: sampleTerrain.data?.midpoint ?? form.elevation,
                })
              }
              className="border-border bg-background text-foreground hover:bg-muted flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2 text-[10px] font-medium transition-colors disabled:opacity-50"
            >
              {sampleTerrain.isFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mountain className="h-3.5 w-3.5" />
              )}
              <span>Auto</span>
            </button>
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
        <label className="text-foreground/80 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isNationalCapital}
            onChange={(e) => onChange({ ...form, isNationalCapital: e.target.checked })}
            className="border-border text-primary focus:ring-primary rounded"
          />
          National capital
        </label>
        <label className="text-foreground/80 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isSubdivisionCapital}
            onChange={(e) => onChange({ ...form, isSubdivisionCapital: e.target.checked })}
            className="border-border text-primary focus:ring-primary rounded"
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
      <select
        value={form.subdivisionId ?? "auto"}
        onChange={(e) =>
          onChange({
            ...form,
            subdivisionId:
              e.target.value === "auto"
                ? "auto"
                : e.target.value === "none"
                  ? "none"
                  : e.target.value || undefined,
          })
        }
        className={selectClasses}
      >
        <option value="auto">&mdash; Auto-detect Region (Recommended) &mdash;</option>
        <option value="none">&mdash; None &mdash;</option>
        {subdivisions.map((sub) => (
          <option key={sub.id} value={sub.id}>
            {sub.name}
          </option>
        ))}
      </select>
    </div>
  );
});

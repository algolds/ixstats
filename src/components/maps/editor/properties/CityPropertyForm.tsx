"use client";

import React from "react";
import type { CityFormData, EditorFeature } from "~/hooks/useMapEditor";
import { WikiLinkWizard } from "../WikiLinkWizard";

const CITY_TYPES = ["capital", "city", "town", "village", "hamlet", "port", "fortress"];

const inputClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const selectClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

interface CityPropertyFormProps {
  form: CityFormData;
  onChange: (form: CityFormData) => void;
  pendingCoordinates?: [number, number] | null;
  allFeatures?: EditorFeature[];
}

export const CityPropertyForm = React.memo(function CityPropertyForm({
  form,
  onChange,
  pendingCoordinates,
  allFeatures,
}: CityPropertyFormProps) {
  const subdivisions = (allFeatures ?? []).filter((f) => f.type === "subdivision");
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
        <input
          type="number"
          placeholder="Elevation (m)"
          value={form.elevation ?? ""}
          onChange={(e) =>
            onChange({
              ...form,
              elevation: e.target.value ? parseInt(e.target.value, 10) : undefined,
            })
          }
          className={inputClasses}
        />
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
      {subdivisions.length > 0 && (
        <select
          value={form.subdivisionId ?? ""}
          onChange={(e) =>
            onChange({
              ...form,
              subdivisionId: e.target.value || undefined,
            })
          }
          className={selectClasses}
        >
          <option value="">&mdash; No region &mdash;</option>
          {subdivisions.map((sub) => (
            <option key={sub.id} value={sub.id}>
              {sub.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
});

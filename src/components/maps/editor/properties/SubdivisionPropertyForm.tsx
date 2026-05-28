"use client";

import React from "react";
import { Label } from "~/components/ui/label";
import { ColorPickerInput } from "~/components/kibo-ui/color-picker";
import type { SubdivisionFormData } from "~/hooks/useMapEditor";
import { WikiLinkWizard } from "../WikiLinkWizard";

const SUBDIVISION_TYPES = [
  "province",
  "state",
  "region",
  "territory",
  "district",
  "county",
  "department",
];

const inputClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const selectClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

interface SubdivisionPropertyFormProps {
  form: SubdivisionFormData;
  onChange: (form: SubdivisionFormData) => void;
}

export const SubdivisionPropertyForm = React.memo(function SubdivisionPropertyForm({
  form,
  onChange,
}: SubdivisionPropertyFormProps) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Region name"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        className={inputClasses}
        autoFocus
      />
      <select
        value={form.type}
        onChange={(e) => onChange({ ...form, type: e.target.value })}
        className={selectClasses}
      >
        {SUBDIVISION_TYPES.map((t) => (
          <option key={t} value={t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Capital city (optional)"
        value={form.capital ?? ""}
        onChange={(e) => onChange({ ...form, capital: e.target.value || undefined })}
        className={inputClasses}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          placeholder="Population"
          value={form.population ?? ""}
          onChange={(e) =>
            onChange({
              ...form,
              population: e.target.value ? parseInt(e.target.value, 10) : undefined,
            })
          }
          className={inputClasses}
        />
        <input
          type="number"
          placeholder="Area (km²)"
          value={form.areaSqKm ?? ""}
          onChange={(e) =>
            onChange({
              ...form,
              areaSqKm: e.target.value ? parseFloat(e.target.value) : undefined,
            })
          }
          className={inputClasses}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Color</Label>
        <ColorPickerInput
          value={form.color ?? "#a78bfa"}
          onChange={(val) => onChange({ ...form, color: val })}
        />
      </div>
      <WikiLinkWizard
        value={form.wikiPageTitle}
        onChange={(title) => onChange({ ...form, wikiPageTitle: title })}
        onImport={(fields) => {
          const updates: Partial<SubdivisionFormData> = { wikiPageTitle: fields.wikiPageTitle };
          if (fields.population) updates.population = fields.population;
          onChange({ ...form, ...updates });
        }}
        currentCoords={undefined}
        placeholder="Search wiki to link..."
      />
    </div>
  );
});

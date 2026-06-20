"use client";

import React from "react";
import { Label } from "~/components/ui/label";
import { ColorPickerInput } from "~/components/kibo-ui/color-picker";
import { Ruler } from "lucide-react";
import type { SubdivisionFormData } from "~/hooks/useMapEditor";
import { WikiLinkWizard } from "../WikiLinkWizard";
import { geometryAreaSqKm } from "~/lib/geo-math";

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
  // Area is a pure geometry calculation — compute it client-side. (Previously a
  // tRPC query that shipped the entire polygon in the GET URL, which blew past
  // URL/header limits for large countries → ERR_HTTP2_PROTOCOL_ERROR / 520.)
  const sampleAreaValue = React.useMemo<number | undefined>(() => {
    const geom = form.geometry as { type?: string; coordinates?: unknown } | undefined;
    if (!geom || !geom.coordinates || geom.type === "Point" || geom.type === "LineString") {
      return undefined;
    }
    try {
      const v = geometryAreaSqKm(geom as Parameters<typeof geometryAreaSqKm>[0]);
      return Number.isFinite(v) && v > 0 ? v : undefined;
    } catch {
      return undefined;
    }
  }, [form.geometry]);
  const derivedFromGeometry = form.areaSqKm === sampleAreaValue;

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
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-muted-foreground text-xs font-medium">Area (km²)</label>
            {derivedFromGeometry && sampleAreaValue !== undefined && (
              <span className="text-muted-foreground text-[10px]">from geometry</span>
            )}
          </div>
          <div className="flex items-center gap-2">
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
            <button
              type="button"
              disabled={sampleAreaValue === undefined}
              onClick={() =>
                onChange({
                  ...form,
                  areaSqKm: sampleAreaValue ?? form.areaSqKm,
                })
              }
              className="border-border bg-background text-foreground hover:bg-muted flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2 text-[10px] font-medium transition-colors disabled:opacity-50"
            >
              <Ruler className="h-3.5 w-3.5" />
              <span>Auto</span>
            </button>
          </div>
          {sampleAreaValue !== undefined && !derivedFromGeometry && (
            <div className="text-muted-foreground text-[10px]">
              ≈ {sampleAreaValue.toLocaleString(undefined, { maximumFractionDigits: 1 })} km² from
              geometry
            </div>
          )}
        </div>
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

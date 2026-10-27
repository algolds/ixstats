"use client";

import { Button } from "~/components/ui/button";
import React from "react";
import { Label } from "~/components/ui/label";
import { ColorPickerInput } from "~/components/ui/color-picker";
import { Ruler } from "iconoir-react";
import type { SubdivisionFormData } from "~/hooks/useMapEditor";
import { SUBDIVISION_TYPE_OPTIONS } from "../optionLists";
import { inputClasses, WikiLinkField } from "./fields";
import { geometryAreaSqKm } from "~/lib/maps/geo-math";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";

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
    const geom = form.geometry as
      { type?: string; coordinates?: number[][][] | number[][][][] } | undefined;
    if (!geom || !geom.coordinates || geom.type === "Point" || geom.type === "LineString") {
      return undefined;
    }
    try {
      const v = geometryAreaSqKm({
        type: geom.type ?? "Polygon",
        coordinates: geom.coordinates,
      });
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
      <OptionSelect
        aria-label="Subdivision type"
        value={form.type}
        onValueChange={(v) => onChange({ ...form, type: v })}
        options={SUBDIVISION_TYPE_OPTIONS}
        size="sm"
        className="w-full"
      />
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
            <label className="text-label-secondary text-caption">Area (km²)</label>
            {derivedFromGeometry && sampleAreaValue !== undefined && (
              <span className="text-label-secondary text-footnote">from geometry</span>
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
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              type="button"
              disabled={sampleAreaValue === undefined}
              onClick={() =>
                onChange({
                  ...form,
                  areaSqKm: sampleAreaValue ?? form.areaSqKm,
                })
              }
            >
              <Ruler className="h-3.5 w-3.5" />
              <span>Auto</span>
            </Button>
          </div>
          {sampleAreaValue !== undefined && !derivedFromGeometry && (
            <div className="text-label-secondary text-footnote">
              ≈ {sampleAreaValue.toLocaleString(undefined, { maximumFractionDigits: 1 })} km² from
              geometry
            </div>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-label-secondary text-footnote">Color</Label>
        <ColorPickerInput
          value={form.color ?? "#a78bfa"}
          onChange={(val: string) => onChange({ ...form, color: val })}
        />
      </div>
      <WikiLinkField form={form} onChange={onChange} importPopulation />
    </div>
  );
});

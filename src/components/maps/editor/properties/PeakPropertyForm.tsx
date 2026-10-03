"use client";
import React from "react";
import type { PeakFormData, EditorFeature } from "~/hooks/useMapEditor";
import { WikiLinkWizard } from "../WikiLinkWizard";
import { MapPin } from "iconoir-react";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

const inputClasses =
  "w-full rounded-control border border-separator bg-surface px-3 py-2 sm:py-2 text-body sm:text-body text-label placeholder:text-label-secondary transition-colors focus:border-tint focus:outline-none focus:ring-1 focus:ring-tint";

const selectClasses =
  "w-full rounded-control border border-separator bg-surface px-3 py-2 sm:py-2 text-body sm:text-body text-label transition-colors focus:border-tint focus:outline-none focus:ring-1 focus:ring-tint";

interface PeakPropertyFormProps {
  form: PeakFormData;
  onChange: (form: PeakFormData) => void;
  pendingCoordinates?: [number, number] | null;
  allFeatures?: EditorFeature[];
  countryId?: string;
  isPickingLocation?: boolean;
  setIsPickingLocation?: (active: boolean) => void;
}

export const PeakPropertyForm = React.memo(function PeakPropertyForm({
  form,
  onChange,
  pendingCoordinates,
  allFeatures,
  countryId,
  isPickingLocation = false,
  setIsPickingLocation,
}: PeakPropertyFormProps) {
  const activeCoords = form.coordinates ?? pendingCoordinates;
  const subdivisions = React.useMemo(
    () => (allFeatures ?? []).filter((f) => f.type === "subdivision"),
    [allFeatures]
  );

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Peak name"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        className={inputClasses}
        autoFocus
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-label-secondary text-caption mb-1 block text-left">
            Elevation (m)
          </label>
          <input
            type="number"
            placeholder="e.g. 1500"
            value={form.elevation === 0 ? "" : form.elevation}
            onChange={(e) =>
              onChange({
                ...form,
                elevation: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0,
              })
            }
            className={inputClasses}
          />
        </div>
        <div>
          <label className="text-label-secondary text-caption mb-1 block text-left">
            Prominence (m)
          </label>
          <input
            type="number"
            placeholder="e.g. 500"
            value={form.prominence === 0 ? "" : form.prominence}
            onChange={(e) =>
              onChange({
                ...form,
                prominence: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0,
              })
            }
            className={inputClasses}
          />
        </div>
      </div>

      {/* Coordinate Picker Block */}
      {countryId && (
        <Card className="text-footnote flex items-center justify-between px-3 py-2">
          <div className="text-label-secondary text-left font-medium">
            Coordinates:{" "}
            {activeCoords ? (
              <span className="text-label font-semibold tabular-nums">
                {activeCoords[1].toFixed(4)}&deg; N, {activeCoords[0].toFixed(4)}&deg; E
              </span>
            ) : (
              <span className="italic">Not placed yet</span>
            )}
          </div>
          <Button
            type="button"
            variant={isPickingLocation ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={isPickingLocation}
            onClick={() => setIsPickingLocation?.(!isPickingLocation)}
            className="shrink-0"
          >
            <MapPin className="size-3.5" aria-hidden />
            <span>{isPickingLocation ? "Click on Map..." : "Pick on Map"}</span>
          </Button>
        </Card>
      )}

      <WikiLinkWizard
        value={form.wikiPageTitle}
        onChange={(title) => onChange({ ...form, wikiPageTitle: title })}
        onImport={(fields) => {
          onChange({ ...form, wikiPageTitle: fields.wikiPageTitle });
        }}
        currentCoords={pendingCoordinates ?? undefined}
        placeholder="Search wiki to link..."
      />

      <div>
        <label className="text-label-secondary text-caption mb-1 block text-left">
          Subdivision / Region
        </label>
        <OptionSelect
          aria-label="Subdivision / region"
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
    </div>
  );
});

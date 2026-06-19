"use client";

import React from "react";
import type { PeakFormData, EditorFeature } from "~/hooks/useMapEditor";
import { WikiLinkWizard } from "../WikiLinkWizard";
import { MapPin } from "lucide-react";

const inputClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const selectClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

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
  const subdivisions = (allFeatures ?? []).filter((f) => f.type === "subdivision");

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Peak Name"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        className={inputClasses}
        autoFocus
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-left text-xs font-medium text-muted-foreground">
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
          <label className="mb-1 block text-left text-xs font-medium text-muted-foreground">
            Prominence (m, optional)
          </label>
          <input
            type="number"
            placeholder="e.g. 500"
            value={form.prominence ?? ""}
            onChange={(e) =>
              onChange({
                ...form,
                prominence: e.target.value === "" ? undefined : parseFloat(e.target.value) || undefined,
              })
            }
            className={inputClasses}
          />
        </div>
      </div>

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
            onClick={() => setIsPickingLocation?.(!isPickingLocation)}
            className={`flex shrink-0 items-center gap-1 font-semibold focus:outline-none transition-colors ${
              isPickingLocation
                ? "text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 animate-pulse font-bold"
                : "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>{isPickingLocation ? "Click on Map..." : "Pick on Map"}</span>
          </button>
        </div>
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
        <label className="mb-1 block text-left text-xs font-medium text-muted-foreground">
          Subdivision / Region
        </label>
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
    </div>
  );
});

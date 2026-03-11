"use client";

/**
 * FeaturePropertyPanel - Form panel for editing feature properties.
 * Shows different fields based on the current editor mode.
 * Matches standard map control styling (solid white, no glass).
 */

import { X, Check, Loader2, CheckCircle2 } from "lucide-react";
import type { EditorMode, CityFormData, SubdivisionFormData, POIFormData } from "~/hooks/useMapEditor";

interface PointInfo {
  elevation?: {
    zoneName?: string | null;
    elevationLabel?: string | null;
    color?: string | null;
  } | null;
  climate?: {
    climateName?: string | null;
    color?: string | null;
  } | null;
}

interface FeaturePropertyPanelProps {
  mode: EditorMode;
  pendingCoordinates: [number, number] | null;
  pendingGeometry: object | null;
  cityForm: CityFormData;
  onCityFormChange: (form: CityFormData) => void;
  subdivisionForm: SubdivisionFormData;
  onSubdivisionFormChange: (form: SubdivisionFormData) => void;
  poiForm: POIFormData;
  onPOIFormChange: (form: POIFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isMutating: boolean;
  error: { message: string } | null;
  /** Timestamp of last successful save — shows brief success flash */
  lastSavedAt?: number | null;
  /** Terrain info at the pending click point */
  pendingPointInfo?: PointInfo | null;
  isPendingPointInfoLoading?: boolean;
}

const CITY_TYPES = [
  "capital", "city", "town", "village", "hamlet", "port", "fortress",
];

const SUBDIVISION_TYPES = [
  "province", "state", "region", "territory", "district", "county", "department",
];

const POI_CATEGORIES = [
  "landmark", "historical", "natural", "religious", "military", "cultural",
  "economic", "educational", "monument", "ruins",
];

const inputClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const selectClasses =
  "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

export function FeaturePropertyPanel({
  mode,
  pendingCoordinates,
  pendingGeometry,
  cityForm,
  onCityFormChange,
  subdivisionForm,
  onSubdivisionFormChange,
  poiForm,
  onPOIFormChange,
  onSubmit,
  onCancel,
  isMutating,
  error,
  lastSavedAt,
  pendingPointInfo,
  isPendingPointInfoLoading,
}: FeaturePropertyPanelProps) {
  if (mode === "view") return null;

  const isEdit = mode.startsWith("edit-");

  const hasLocation =
    isEdit ||
    (mode === "add-city" && pendingCoordinates) ||
    (mode === "add-subdivision" && pendingGeometry) ||
    (mode === "add-poi" && pendingCoordinates);

  const hasName =
    ((mode === "add-city" || mode === "edit-city") && cityForm.name.trim()) ||
    ((mode === "add-subdivision" || mode === "edit-subdivision") && subdivisionForm.name.trim()) ||
    ((mode === "add-poi" || mode === "edit-poi") && poiForm.name.trim());

  const canSubmit = hasLocation && hasName && !isMutating;

  return (
    <div className="space-y-3 rounded-lg bg-card p-3 shadow-lg ring-1 ring-border">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {mode === "add-city" && "New City"}
          {mode === "edit-city" && "Edit City"}
          {mode === "add-subdivision" && "New Region"}
          {mode === "edit-subdivision" && "Edit Region"}
          {mode === "add-poi" && "New Point of Interest"}
          {mode === "edit-poi" && "Edit Point of Interest"}
        </h3>
        <button
          onClick={onCancel}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Location indicator */}
      {!isEdit && !hasLocation && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {mode === "add-subdivision"
            ? "Draw a polygon on the map to define the region boundary"
            : "Click on the map to set the location"}
        </div>
      )}
      {pendingCoordinates && (mode === "add-city" || mode === "add-poi") && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
          Location: {pendingCoordinates[1].toFixed(3)}&deg;, {pendingCoordinates[0].toFixed(3)}&deg;
        </div>
      )}
      {pendingGeometry && mode === "add-subdivision" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
          Region polygon drawn
        </div>
      )}

      {/* Terrain info at clicked point */}
      {pendingCoordinates && (mode === "add-city" || mode === "add-poi") && (
        <div className="flex flex-wrap gap-1.5">
          {isPendingPointInfoLoading && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Terrain...
            </span>
          )}
          {pendingPointInfo?.elevation?.zoneName && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
              {pendingPointInfo.elevation.color && (
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: pendingPointInfo.elevation.color.slice(0, 7) }}
                />
              )}
              {pendingPointInfo.elevation.zoneName}
              {pendingPointInfo.elevation.elevationLabel && (
                <span className="text-muted-foreground">
                  {pendingPointInfo.elevation.elevationLabel}
                </span>
              )}
            </span>
          )}
          {pendingPointInfo?.climate?.climateName && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
              {pendingPointInfo.climate.color && (
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: pendingPointInfo.climate.color }}
                />
              )}
              {pendingPointInfo.climate.climateName}
            </span>
          )}
        </div>
      )}

      {/* City Form */}
      {(mode === "add-city" || mode === "edit-city") && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="City name"
            value={cityForm.name}
            onChange={(e) => onCityFormChange({ ...cityForm, name: e.target.value })}
            className={inputClasses}
            autoFocus
          />
          <select
            value={cityForm.cityType}
            onChange={(e) => onCityFormChange({ ...cityForm, cityType: e.target.value })}
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
            value={cityForm.population ?? ""}
            onChange={(e) =>
              onCityFormChange({
                ...cityForm,
                population: e.target.value ? parseInt(e.target.value, 10) : undefined,
              })
            }
            className={inputClasses}
          />
          <label className="flex items-center gap-2 text-sm text-foreground/80">
            <input
              type="checkbox"
              checked={cityForm.isNationalCapital}
              onChange={(e) =>
                onCityFormChange({ ...cityForm, isNationalCapital: e.target.checked })
              }
              className="rounded border-border text-primary focus:ring-primary"
            />
            National capital
          </label>
          <input
            type="text"
            placeholder="Wiki page title (optional)"
            value={cityForm.wikiPageTitle ?? ""}
            onChange={(e) =>
              onCityFormChange({
                ...cityForm,
                wikiPageTitle: e.target.value || undefined,
              })
            }
            className={inputClasses}
          />
        </div>
      )}

      {/* Subdivision Form */}
      {(mode === "add-subdivision" || mode === "edit-subdivision") && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Region name"
            value={subdivisionForm.name}
            onChange={(e) => onSubdivisionFormChange({ ...subdivisionForm, name: e.target.value })}
            className={inputClasses}
            autoFocus
          />
          <select
            value={subdivisionForm.type}
            onChange={(e) => onSubdivisionFormChange({ ...subdivisionForm, type: e.target.value })}
            className={selectClasses}
          >
            {SUBDIVISION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Population (optional)"
            value={subdivisionForm.population ?? ""}
            onChange={(e) =>
              onSubdivisionFormChange({
                ...subdivisionForm,
                population: e.target.value ? parseInt(e.target.value, 10) : undefined,
              })
            }
            className={inputClasses}
          />
        </div>
      )}

      {/* POI Form */}
      {(mode === "add-poi" || mode === "edit-poi") && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Name"
            value={poiForm.name}
            onChange={(e) => onPOIFormChange({ ...poiForm, name: e.target.value })}
            className={inputClasses}
            autoFocus
          />
          <select
            value={poiForm.category}
            onChange={(e) => onPOIFormChange({ ...poiForm, category: e.target.value })}
            className={selectClasses}
          >
            {POI_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
          <textarea
            placeholder="Description (optional)"
            value={poiForm.description ?? ""}
            onChange={(e) => onPOIFormChange({ ...poiForm, description: e.target.value })}
            rows={2}
            className={inputClasses}
          />
          <input
            type="text"
            placeholder="Wiki page title (optional)"
            value={poiForm.wikiPageTitle ?? ""}
            onChange={(e) =>
              onPOIFormChange({
                ...poiForm,
                wikiPageTitle: e.target.value || undefined,
              })
            }
            className={inputClasses}
          />
        </div>
      )}

      {/* Success flash */}
      {lastSavedAt && !error && (
        <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {isEdit ? "Changes saved" : "Saved — click map to place another"}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error.message}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isMutating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {isMutating ? "Saving..." : isEdit ? "Update" : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

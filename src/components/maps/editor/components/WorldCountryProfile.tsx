"use client";

import React, { useState } from "react";
import {
  EditPencil as Pencil,
  ViewGrid as Grid3X3,
  ColorPicker as Paintbrush,
} from "iconoir-react";
import { useRouter } from "next/navigation";
import { ProvinceGeneratorPanel } from "./ProvinceGeneratorPanel";
import { JsonViewer } from "~/components/ui/json-viewer";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import type { Polygon, MultiPolygon } from "geojson";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import type {
  EditorFeatureDetails,
  PropertiesPanelCountry,
} from "../types/editor-state";

interface WorldCountryProfileProps {
  mapSelectedCountry: SelectedCountry;
  isUnclaimed?: boolean;
  selectedCountryName: string;
  editableFeatureName: string;
  setEditableFeatureName: (name: string) => void;
  editableCountryLinkageId: string;
  setEditableCountryLinkageId: (id: string) => void;
  countries?: PropertiesPanelCountry[];
  wikiPageTitle: string;
  setWikiPageTitle: (title: string) => void;
  featureDetails: EditorFeatureDetails | null;
  handleSaveFeatureProperties: (props?: Record<string, string | number | boolean | null>) => void;
  updatePropertiesMutation: {
    isPending: boolean;
    mutateAsync: (args: {
      featureId: string;
      displayName?: string;
      countryId?: string | null;
      properties?: Record<string, string | number | boolean | null>;
      wikiPageTitle?: string | null;
    }) => Promise<{ ok?: boolean; success?: boolean } | void>;
  };
  isEditingJson: boolean;
  setIsEditingJson: (editing: boolean) => void;
  propertiesJsonString: string;
  setPropertiesJsonString: (str: string) => void;
  jsonError: string | null;
  setJsonError: (err: string | null) => void;
  parsedProperties: Record<string, string | number | boolean | null> | null;
  assignCountryId?: string;
  setAssignCountryId?: (id: string) => void;
  handleAssignLink?: (featureId: string) => void;
  assignMutation?: {
    isPending: boolean;
    mutateAsync: (args: { countryId: string; featureId: string }) => Promise<{ success?: boolean } | void>;
  };
  availableCountries?: PropertiesPanelCountry[];
  createCountryFromShapeAction?: (name: string) => void;
  createCountryFromShapePending?: boolean;
  enterBorderEdit?: (
    initialMode?: "select" | "vertex_edit" | "split" | "merge" | "trace" | "brush"
  ) => void;
  countryGeometry?: Polygon | MultiPolygon | null;
  countryId?: string | null;
}

export const WorldCountryProfile = React.memo(function WorldCountryProfile({
  mapSelectedCountry,
  isUnclaimed,
  selectedCountryName,
  editableFeatureName,
  setEditableFeatureName,
  editableCountryLinkageId,
  setEditableCountryLinkageId,
  countries,
  wikiPageTitle,
  setWikiPageTitle,
  featureDetails,
  handleSaveFeatureProperties,
  updatePropertiesMutation,
  isEditingJson,
  setIsEditingJson,
  propertiesJsonString,
  setPropertiesJsonString,
  jsonError,
  setJsonError,
  parsedProperties,
  assignCountryId,
  setAssignCountryId,
  handleAssignLink,
  assignMutation,
  availableCountries,
  createCountryFromShapeAction,
  createCountryFromShapePending,
  enterBorderEdit,
  countryGeometry,
  countryId,
}: WorldCountryProfileProps) {
  const router = useRouter();
  const [showGenerator, setShowGenerator] = useState(false);
  const [isCreatingCountry, setIsCreatingCountry] = useState(false);
  const [newCountryName, setNewCountryName] = useState("");

  const inputClasses =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground disabled:opacity-50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="space-y-3">
      {/* Header badge */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          {isUnclaimed ? "Unclaimed Territory" : "Country Profile"}
        </span>
        <div className="flex items-center gap-1.5 min-w-0">
          {!isUnclaimed && (
            <div className="relative h-4 w-6 shrink-0 overflow-hidden rounded-xs border border-border/60 bg-muted/40 shadow-2xs">
              <UnifiedCountryFlag
                countryName={
                  selectedCountryName ||
                  mapSelectedCountry.displayName ||
                  mapSelectedCountry.featureId
                }
                fitContainer
                objectFit="cover"
                className="h-full w-full"
              />
            </div>
          )}
          <span
            className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${
              isUnclaimed
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {selectedCountryName ||
              mapSelectedCountry.displayName ||
              mapSelectedCountry.featureId}
          </span>
        </div>
      </div>

      {/* Settings (editable display name & linkage) */}
      <div className="border-border/60 bg-muted/10 space-y-3 rounded-lg border p-3">
        <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          Details
        </label>
        <div className="space-y-2">
          <div className="space-y-1">
            <span className="text-muted-foreground text-[10px] font-medium">Name</span>
            <input
              type="text"
              value={editableFeatureName}
              onChange={(e) => setEditableFeatureName(e.target.value)}
              className={inputClasses}
              placeholder="e.g. Caphiria"
            />
          </div>

          <div className="space-y-1">
            <span className="text-muted-foreground text-[10px] font-medium">Linked country</span>
            <select
              value={editableCountryLinkageId}
              onChange={(e) => setEditableCountryLinkageId(e.target.value)}
              className="border-border bg-background text-foreground w-full rounded-lg border px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
            >
              <option value="">None</option>
              {countries &&
                countries.map((c: PropertiesPanelCountry) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          {!isUnclaimed && (
            <div className="space-y-1">
              <span className="text-muted-foreground text-[10px] font-medium">Wiki article</span>
              <input
                type="text"
                value={wikiPageTitle}
                onChange={(e) => setWikiPageTitle(e.target.value)}
                placeholder="e.g. Caphiria"
                className={inputClasses}
              />
            </div>
          )}

          {(editableFeatureName !== (mapSelectedCountry.displayName || "") ||
            editableCountryLinkageId !== (mapSelectedCountry.countryId || "") ||
            wikiPageTitle !== (featureDetails?.wikiPageTitle || "")) && (
            <button
              onClick={() => handleSaveFeatureProperties()}
              disabled={updatePropertiesMutation.isPending}
              className="mt-2 w-full cursor-pointer rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {updatePropertiesMutation.isPending ? "Saving..." : "Save changes"}
            </button>
          )}
        </div>
      </div>

      {/* Feature data card */}
      <div className="border-border/60 bg-muted/10 space-y-2 rounded-lg border p-3">
        <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          Feature Data
        </label>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Feature ID</span>
            <span className="text-foreground/80 max-w-[180px] truncate font-mono text-[10px]">
              {mapSelectedCountry.featureId || "—"}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Centroid</span>
            <span className="text-foreground/80 font-mono text-[10px]">
              {mapSelectedCountry.centroidLng?.toFixed(4)},
              {mapSelectedCountry.centroidLat?.toFixed(4)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Fill Color</span>
            <span className="flex items-center gap-1">
              <span
                className="border-border inline-block h-3 w-3 rounded border"
                style={{
                  backgroundColor: mapSelectedCountry.fillColor || "var(--color-bg-secondary)",
                }}
              />
              <span className="text-foreground/80 font-mono text-[10px]">
                {mapSelectedCountry.fillColor || "—"}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* DB feature details card */}
      {featureDetails && (
        <div className="border-border/60 bg-muted/10 space-y-2 rounded-lg border p-3">
          <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Database Record
          </label>
          <div className="space-y-1">
            {featureDetails.flagUrl && (
              <img
                src={featureDetails.flagUrl}
                alt={`${selectedCountryName} flag`}
                className="border-border/60 mb-2 aspect-video w-full rounded-lg border object-cover shadow-sm"
              />
            )}
            {featureDetails.featureType && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Type</span>
                <span className="text-foreground/80">{String(featureDetails.featureType)}</span>
              </div>
            )}
            {featureDetails.areaKm2 != null && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Area</span>
                <span className="text-foreground/80">
                  {Math.round(Number(featureDetails.areaKm2)).toLocaleString()} km²
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full feature properties JSON viewer */}
      <div className="border-border/60 bg-muted/10 rounded-lg border p-3">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Properties JSON
          </label>
          <button
            onClick={() => {
              if (isEditingJson) {
                try {
                  const parsed = propertiesJsonString ? JSON.parse(propertiesJsonString) : {};
                  setJsonError(null);
                  handleSaveFeatureProperties(parsed);
                  setIsEditingJson(false);
                } catch (_e) {
                  setJsonError("Invalid JSON syntax");
                }
              } else {
                setIsEditingJson(true);
              }
            }}
            className="text-[10px] font-semibold text-primary hover:underline"
          >
            {isEditingJson ? "Save" : "Edit JSON"}
          </button>
        </div>
        {isEditingJson ? (
          <div className="space-y-1">
            <textarea
              value={propertiesJsonString}
              onChange={(e) => setPropertiesJsonString(e.target.value)}
              rows={6}
              className="border-border bg-background w-full rounded-lg border px-3 py-2 font-mono text-[10px] leading-relaxed focus:border-primary focus:outline-none"
            />
            {jsonError && <p className="text-[10px] text-destructive">{jsonError}</p>}
          </div>
        ) : (
          <JsonViewer data={parsedProperties} />
        )}
      </div>

      {/* Unclaimed territory actions */}
      {isUnclaimed && (
        <div className="border-border/60 space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-muted-foreground text-[10px]">
            This territory has no linked country record.
          </p>

          {setAssignCountryId && handleAssignLink && availableCountries && (
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-[10px] font-medium uppercase">
                Assign to country
              </label>
              <div className="flex gap-1.5">
                <select
                  value={assignCountryId ?? ""}
                  onChange={(e) => setAssignCountryId(e.target.value)}
                  className="border-border bg-background text-foreground w-full rounded-lg border px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
                >
                  <option value="">— select country —</option>
                  {availableCountries.map((c: PropertiesPanelCountry) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleAssignLink(mapSelectedCountry.featureId)}
                  disabled={!assignCountryId || assignMutation?.isPending}
                  className="bg-primary/15 hover:bg-primary/25 text-primary shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium active:scale-[0.98] disabled:opacity-50"
                >
                  Assign
                </button>
              </div>
            </div>
          )}

          {createCountryFromShapeAction && (
            isCreatingCountry ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 space-y-2">
                <label className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                  New Country Name
                </label>
                <input
                  type="text"
                  value={newCountryName}
                  onChange={(e) => setNewCountryName(e.target.value)}
                  placeholder="Enter country name..."
                  autoFocus
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCountryName.trim()) {
                      createCountryFromShapeAction(newCountryName.trim());
                      setIsCreatingCountry(false);
                      setNewCountryName("");
                    } else if (e.key === "Escape") {
                      setIsCreatingCountry(false);
                      setNewCountryName("");
                    }
                  }}
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => {
                      setIsCreatingCountry(false);
                      setNewCountryName("");
                    }}
                    className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (newCountryName.trim()) {
                        createCountryFromShapeAction(newCountryName.trim());
                        setIsCreatingCountry(false);
                        setNewCountryName("");
                      }
                    }}
                    disabled={!newCountryName.trim() || createCountryFromShapePending}
                    className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
                  >
                    {createCountryFromShapePending ? "Creating…" : "Create"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setNewCountryName(mapSelectedCountry.displayName || "");
                  setIsCreatingCountry(true);
                }}
                disabled={createCountryFromShapePending}
                className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium active:scale-[0.98] disabled:opacity-50"
              >
                {createCountryFromShapePending ? "Creating…" : "+ Create new country from shape"}
              </button>
            )
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="border-border/60 space-y-2 border-t pt-3">
        {enterBorderEdit && (
          <button
            onClick={() => enterBorderEdit()}
            className="bg-primary/15 text-primary hover:bg-primary/25 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium active:scale-[0.98]"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Borders
          </button>
        )}
        {enterBorderEdit && (
          <button
            onClick={() => enterBorderEdit("brush")}
            className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium active:scale-[0.98]"
          >
            <Paintbrush className="h-3.5 w-3.5" />
            Brush Territory…
          </button>
        )}
        {!isUnclaimed && (
          <button
            onClick={() => setShowGenerator((v) => !v)}
            className="bg-accent hover:bg-accent/80 text-accent-foreground flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium active:scale-[0.98]"
          >
            <Grid3X3 className="h-3.5 w-3.5" />
            Generate Subdivisions…
          </button>
        )}
        {!isUnclaimed && (
          <button
            onClick={() => {
              if (mapSelectedCountry?.featureId) {
                router.push(`/admin/geography?featureId=${mapSelectedCountry.featureId}`);
              }
            }}
            className="border-border bg-muted/20 hover:bg-muted/40 text-foreground w-full rounded-lg border py-2 text-center text-xs font-medium transition-colors active:scale-[0.98]"
          >
            Manage Database Record
          </button>
        )}
      </div>
      {showGenerator && (
        <div className="border-border/60 bg-muted/10 rounded-lg border">
          <ProvinceGeneratorPanel
            countryGeometry={countryGeometry ?? null}
            countryId={countryId ?? ""}
            onClose={() => setShowGenerator(false)}
          />
        </div>
      )}
    </div>
  );
});

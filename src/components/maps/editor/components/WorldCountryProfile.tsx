"use client";

import { FacetCard } from "~/components/ui/facet-container";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { useState } from "react";
import {
  EditPencil as Pencil,
  ViewGrid as Grid3X3,
  ColorPicker as Paintbrush,
} from "iconoir-react";
import { useRouter } from "next/navigation";
import { ProvinceGeneratorPanel } from "./ProvinceGeneratorPanel";
import { JsonViewer } from "~/components/shared/json-viewer";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import type { Polygon, MultiPolygon } from "geojson";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import type { EditorFeatureDetails, PropertiesPanelCountry } from "../types/editor-state";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";

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
    mutateAsync: (args: { countryId: string; featureId: string }) => Promise<object | void>;
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
    "w-full rounded-control border border-separator bg-surface px-3 py-2 text-footnote text-label disabled:opacity-50 focus:border-tint focus:outline-none focus:ring-1 focus:ring-tint";

  return (
    <div className="space-y-3">
      {/* Header badge */}
      <div className="flex items-center justify-between">
        <Eyebrow>{isUnclaimed ? "Unclaimed Territory" : "Country Profile"}</Eyebrow>
        <div className="flex min-w-0 items-center gap-2">
          {!isUnclaimed && (
            <FacetCard className="relative h-4 w-6 shrink-0 overflow-hidden rounded-xs">
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
            </FacetCard>
          )}
          <span
            className={`text-caption rounded-control-sm truncate border px-2 py-0.5 ${
              isUnclaimed ? "border-yellow/30 text-yellow" : "border-green/30 text-green"
            }`}
          >
            {selectedCountryName || mapSelectedCountry.displayName || mapSelectedCountry.featureId}
          </span>
        </div>
      </div>

      {/* Settings (editable display name & linkage) */}
      <FacetCard className="space-y-3 p-3">
        <Eyebrow className="block">Details</Eyebrow>
        <div className="space-y-2">
          <div className="space-y-1">
            <span className="text-label-secondary text-caption">Name</span>
            <input
              type="text"
              value={editableFeatureName}
              onChange={(e) => setEditableFeatureName(e.target.value)}
              className={inputClasses}
              placeholder="e.g. Caphiria"
            />
          </div>

          <div className="space-y-1">
            <span className="text-label-secondary text-caption">Linked country</span>
            <OptionSelect
              aria-label="Linked country"
              value={editableCountryLinkageId}
              onValueChange={setEditableCountryLinkageId}
              options={[
                { value: "", label: "None" },
                ...(countries ?? []).map((c: PropertiesPanelCountry) => ({
                  value: c.id,
                  label: c.name,
                })),
              ]}
            />
          </div>

          {!isUnclaimed && (
            <div className="space-y-1">
              <span className="text-label-secondary text-caption">Wiki article</span>
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
            <Button
              size="sm"
              className="mt-2 w-full"
              onClick={() => handleSaveFeatureProperties()}
              disabled={updatePropertiesMutation.isPending}
            >
              {updatePropertiesMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          )}
        </div>
      </FacetCard>

      {/* Feature data card */}
      <FacetCard className="space-y-2 p-3">
        <Eyebrow className="block">Feature Data</Eyebrow>
        <div className="space-y-1">
          <div className="text-footnote flex justify-between">
            <span className="text-label-secondary">Feature ID</span>
            <span className="text-label-secondary text-footnote max-w-[180px] truncate font-mono">
              {mapSelectedCountry.featureId || "—"}
            </span>
          </div>
          <div className="text-footnote flex justify-between">
            <span className="text-label-secondary">Centroid</span>
            <span className="text-label-secondary text-footnote font-mono">
              {mapSelectedCountry.centroidLng?.toFixed(4)},
              {mapSelectedCountry.centroidLat?.toFixed(4)}
            </span>
          </div>
          <div className="text-footnote flex justify-between">
            <span className="text-label-secondary">Fill Color</span>
            <span className="flex items-center gap-1">
              <span
                className="border-separator inline-block h-3 w-3 rounded-xs border"
                style={{
                  backgroundColor: mapSelectedCountry.fillColor || "var(--color-surface-secondary)",
                }}
              />
              <span className="text-label-secondary text-footnote tabular-nums">
                {mapSelectedCountry.fillColor || "—"}
              </span>
            </span>
          </div>
        </div>
      </FacetCard>

      {/* DB feature details card */}
      {featureDetails && (
        <FacetCard className="space-y-2 p-3">
          <Eyebrow className="block">Database Record</Eyebrow>
          <div className="space-y-1">
            {featureDetails.flagUrl && (
              <img
                src={featureDetails.flagUrl}
                alt={`${selectedCountryName} flag`}
                className="border-separator rounded-control shadow-card mb-2 aspect-video w-full border object-cover"
              />
            )}
            {featureDetails.featureType && (
              <div className="text-footnote flex justify-between">
                <span className="text-label-secondary">Type</span>
                <span className="text-label-secondary">{String(featureDetails.featureType)}</span>
              </div>
            )}
            {featureDetails.areaKm2 != null && (
              <div className="text-footnote flex justify-between">
                <span className="text-label-secondary">Area</span>
                <span className="text-label-secondary">
                  {Math.round(Number(featureDetails.areaKm2)).toLocaleString()} km²
                </span>
              </div>
            )}
          </div>
        </FacetCard>
      )}

      {/* Full feature properties JSON viewer */}
      <FacetCard className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <Eyebrow className="block">Properties JSON</Eyebrow>
          <Button
            variant="ghost"
            size="sm"
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
          >
            {isEditingJson ? "Save" : "Edit JSON"}
          </Button>
        </div>
        {isEditingJson ? (
          <div className="space-y-1">
            <textarea
              value={propertiesJsonString}
              onChange={(e) => setPropertiesJsonString(e.target.value)}
              rows={6}
              className="border-separator bg-surface focus:border-tint rounded-control text-footnote w-full border px-3 py-2 leading-relaxed tabular-nums focus:outline-none"
            />
            {jsonError && <p className="text-destructive text-footnote">{jsonError}</p>}
          </div>
        ) : (
          <JsonViewer data={parsedProperties} />
        )}
      </FacetCard>

      {/* Unclaimed territory actions */}
      {isUnclaimed && (
        <div className="border-separator rounded-control border-yellow/20 bg-yellow/5 space-y-2 border p-3">
          <p className="text-label-secondary text-footnote">
            This territory has no linked country record.
          </p>

          {setAssignCountryId && handleAssignLink && availableCountries && (
            <div className="space-y-2">
              <Eyebrow className="block">Assign to country</Eyebrow>
              <div className="flex gap-2">
                <OptionSelect
                  aria-label="Assign to country"
                  value={assignCountryId ?? ""}
                  onValueChange={(v) => setAssignCountryId(v)}
                  options={[
                    { value: "", label: "— select country —" },
                    ...availableCountries.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                  size="sm"
                  className="w-full"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => handleAssignLink(mapSelectedCountry.featureId)}
                  disabled={!assignCountryId || assignMutation?.isPending}
                >
                  Assign
                </Button>
              </div>
            </div>
          )}

          {createCountryFromShapeAction &&
            (isCreatingCountry ? (
              <div className="rounded-control border-green/30 bg-green/5 space-y-2 border p-2">
                <Eyebrow className="block">New Country Name</Eyebrow>
                <input
                  type="text"
                  value={newCountryName}
                  onChange={(e) => setNewCountryName(e.target.value)}
                  placeholder="Enter country name..."
                  autoFocus
                  className="border-separator bg-surface text-label text-footnote focus:ring-green rounded-control-sm w-full border px-2 py-1 focus:ring-1 focus:outline-none"
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
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-label-secondary"
                    onClick={() => {
                      setIsCreatingCountry(false);
                      setNewCountryName("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      if (newCountryName.trim()) {
                        createCountryFromShapeAction(newCountryName.trim());
                        setIsCreatingCountry(false);
                        setNewCountryName("");
                      }
                    }}
                    disabled={!newCountryName.trim() || createCountryFromShapePending}
                  >
                    {createCountryFromShapePending ? "Creating…" : "Create"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={() => {
                  setNewCountryName(mapSelectedCountry.displayName || "");
                  setIsCreatingCountry(true);
                }}
                disabled={createCountryFromShapePending}
              >
                {createCountryFromShapePending ? "Creating…" : "+ Create new country from shape"}
              </Button>
            ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="border-separator space-y-2 border-t pt-3">
        {enterBorderEdit && (
          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-center"
            onClick={() => enterBorderEdit()}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Borders
          </Button>
        )}
        {enterBorderEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={() => enterBorderEdit("brush")}
          >
            <Paintbrush className="h-3.5 w-3.5" />
            Brush Territory…
          </Button>
        )}
        {!isUnclaimed && (
          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-center"
            onClick={() => setShowGenerator((v) => !v)}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
            Generate Subdivisions…
          </Button>
        )}
        {!isUnclaimed && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              if (mapSelectedCountry?.featureId) {
                router.push(`/admin/geography?featureId=${mapSelectedCountry.featureId}`);
              }
            }}
          >
            Manage Database Record
          </Button>
        )}
      </div>
      {showGenerator && (
        <FacetCard>
          <ProvinceGeneratorPanel
            countryGeometry={countryGeometry ?? null}
            countryId={countryId ?? ""}
            onClose={() => setShowGenerator(false)}
          />
        </FacetCard>
      )}
    </div>
  );
});

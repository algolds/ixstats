"use client";
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
import { Card } from "~/components/ui/card";

export interface WorldCountryProfileProps {
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

const inputClasses =
  "w-full rounded-control border border-separator bg-surface px-3 py-2 text-footnote text-label disabled:opacity-50 focus:border-tint focus:outline-none focus:ring-1 focus:ring-tint";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-label-secondary text-caption">{label}</span>
      {children}
    </div>
  );
}

function DataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-footnote flex justify-between">
      <span className="text-label-secondary">{label}</span>
      {children}
    </div>
  );
}

function ProfileHeader({
  isUnclaimed,
  title,
}: Pick<WorldCountryProfileProps, "isUnclaimed"> & { title: string }) {
  return (
    <div className="flex items-center justify-between">
      <Eyebrow>{isUnclaimed ? "Unclaimed Territory" : "Country Profile"}</Eyebrow>
      <div className="flex min-w-0 items-center gap-2">
        {!isUnclaimed && (
          <Card className="relative h-4 w-6 shrink-0 overflow-hidden rounded-xs">
            <UnifiedCountryFlag
              countryName={title}
              fitContainer
              objectFit="cover"
              className="h-full w-full"
            />
          </Card>
        )}
        <span
          className={`text-caption rounded-control-sm truncate border px-2 py-0.5 ${
            isUnclaimed ? "border-yellow/30 text-yellow" : "border-green/30 text-green"
          }`}
        >
          {title}
        </span>
      </div>
    </div>
  );
}

function DetailsCard(props: WorldCountryProfileProps) {
  const { mapSelectedCountry, isUnclaimed, editableFeatureName, editableCountryLinkageId } = props;
  const isDirty =
    editableFeatureName !== (mapSelectedCountry.displayName || "") ||
    editableCountryLinkageId !== (mapSelectedCountry.countryId || "") ||
    props.wikiPageTitle !== (props.featureDetails?.wikiPageTitle || "");
  const countryOptions = [
    { value: "", label: "None" },
    ...(props.countries ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <Card className="space-y-3 p-3">
      <Eyebrow className="block">Details</Eyebrow>
      <div className="space-y-2">
        <Field label="Name">
          <input
            type="text"
            value={editableFeatureName}
            onChange={(e) => props.setEditableFeatureName(e.target.value)}
            className={inputClasses}
            placeholder="e.g. Caphiria"
          />
        </Field>

        <Field label="Linked country">
          <OptionSelect
            aria-label="Linked country"
            value={editableCountryLinkageId}
            onValueChange={props.setEditableCountryLinkageId}
            options={countryOptions}
          />
        </Field>

        {!isUnclaimed && (
          <Field label="Wiki article">
            <input
              type="text"
              value={props.wikiPageTitle}
              onChange={(e) => props.setWikiPageTitle(e.target.value)}
              placeholder="e.g. Caphiria"
              className={inputClasses}
            />
          </Field>
        )}

        {isDirty && (
          <Button
            size="sm"
            className="mt-2 w-full"
            onClick={() => props.handleSaveFeatureProperties()}
            disabled={props.updatePropertiesMutation.isPending}
          >
            {props.updatePropertiesMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function FeatureDataCard({ country }: { country: SelectedCountry }) {
  return (
    <Card className="space-y-2 p-3">
      <Eyebrow className="block">Feature data</Eyebrow>
      <div className="space-y-1">
        <DataRow label="Feature ID">
          <span className="text-label-secondary text-footnote max-w-[180px] truncate font-mono">
            {country.featureId || "—"}
          </span>
        </DataRow>
        <DataRow label="Centroid">
          <span className="text-label-secondary text-footnote font-mono">
            {country.centroidLng?.toFixed(4)},{country.centroidLat?.toFixed(4)}
          </span>
        </DataRow>
        <DataRow label="Fill color">
          <span className="flex items-center gap-1">
            <span
              className="border-separator inline-block h-3 w-3 rounded-xs border"
              style={{ backgroundColor: country.fillColor || "var(--color-surface-secondary)" }}
            />
            <span className="text-label-secondary text-footnote tabular-nums">
              {country.fillColor || "—"}
            </span>
          </span>
        </DataRow>
      </div>
    </Card>
  );
}

function DatabaseRecordCard({
  details,
  countryName,
}: {
  details: EditorFeatureDetails;
  countryName: string;
}) {
  return (
    <Card className="space-y-2 p-3">
      <Eyebrow className="block">Database record</Eyebrow>
      <div className="space-y-1">
        {details.flagUrl && (
          <img
            src={details.flagUrl}
            alt={`${countryName} flag`}
            className="border-separator rounded-control shadow-card mb-2 aspect-video w-full border object-cover"
          />
        )}
        {details.featureType && (
          <DataRow label="Type">
            <span className="text-label-secondary">{String(details.featureType)}</span>
          </DataRow>
        )}
        {details.areaKm2 != null && (
          <DataRow label="Area">
            <span className="text-label-secondary">
              {Math.round(Number(details.areaKm2)).toLocaleString()} km²
            </span>
          </DataRow>
        )}
      </div>
    </Card>
  );
}

function PropertiesJsonCard(props: WorldCountryProfileProps) {
  const { isEditingJson, propertiesJsonString } = props;

  const toggleEdit = () => {
    if (!isEditingJson) {
      props.setIsEditingJson(true);
      return;
    }
    try {
      const parsed = propertiesJsonString ? JSON.parse(propertiesJsonString) : {};
      props.setJsonError(null);
      props.handleSaveFeatureProperties(parsed);
      props.setIsEditingJson(false);
    } catch {
      props.setJsonError("Invalid JSON syntax");
    }
  };

  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <Eyebrow className="block">Properties JSON</Eyebrow>
        <Button variant="ghost" size="sm" onClick={toggleEdit}>
          {isEditingJson ? "Save" : "Edit JSON"}
        </Button>
      </div>
      {isEditingJson ? (
        <div className="space-y-1">
          <textarea
            value={propertiesJsonString}
            onChange={(e) => props.setPropertiesJsonString(e.target.value)}
            rows={6}
            className="border-separator bg-surface focus:border-tint rounded-control text-footnote w-full border px-3 py-2 leading-relaxed tabular-nums focus:outline-none"
          />
          {props.jsonError && <p className="text-destructive text-footnote">{props.jsonError}</p>}
        </div>
      ) : (
        <JsonViewer data={props.parsedProperties} />
      )}
    </Card>
  );
}

function CreateCountryFromShape({
  initialName,
  pending,
  onCreate,
}: {
  initialName: string;
  pending: boolean | undefined;
  onCreate: (name: string) => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const trimmed = name.trim();

  const close = () => {
    setIsCreating(false);
    setName("");
  };
  const submit = () => {
    if (!trimmed) return;
    onCreate(trimmed);
    close();
  };

  if (!isCreating) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-center"
        onClick={() => {
          setName(initialName);
          setIsCreating(true);
        }}
        disabled={pending}
      >
        {pending ? "Creating…" : "+ Create new country from shape"}
      </Button>
    );
  }

  return (
    <div className="rounded-control border-green/30 bg-green/5 space-y-2 border p-2">
      <Eyebrow className="block">New country name</Eyebrow>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter country name..."
        autoFocus
        className="border-separator bg-surface text-label text-footnote focus:ring-green rounded-control-sm w-full border px-2 py-1 focus:ring-1 focus:outline-none"
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          else if (e.key === "Escape") close();
        }}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="xs" className="text-label-secondary" onClick={close}>
          Cancel
        </Button>
        <Button variant="outline" size="xs" onClick={submit} disabled={!trimmed || pending}>
          {pending ? "Creating…" : "Create"}
        </Button>
      </div>
    </div>
  );
}

function UnclaimedActions(props: WorldCountryProfileProps) {
  const { setAssignCountryId, handleAssignLink, availableCountries, assignCountryId } = props;
  return (
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
              onValueChange={setAssignCountryId}
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
              onClick={() => handleAssignLink(props.mapSelectedCountry.featureId)}
              disabled={!assignCountryId || props.assignMutation?.isPending}
            >
              Assign
            </Button>
          </div>
        </div>
      )}

      {props.createCountryFromShapeAction && (
        <CreateCountryFromShape
          initialName={props.mapSelectedCountry.displayName || ""}
          pending={props.createCountryFromShapePending}
          onCreate={props.createCountryFromShapeAction}
        />
      )}
    </div>
  );
}

export const WorldCountryProfile = React.memo(function WorldCountryProfile(
  props: WorldCountryProfileProps
) {
  const { mapSelectedCountry, isUnclaimed, enterBorderEdit } = props;
  const router = useRouter();
  const [showGenerator, setShowGenerator] = useState(false);
  const title =
    props.selectedCountryName || mapSelectedCountry.displayName || mapSelectedCountry.featureId;

  return (
    <div className="space-y-3">
      <ProfileHeader isUnclaimed={isUnclaimed} title={title} />
      <DetailsCard {...props} />
      <FeatureDataCard country={mapSelectedCountry} />
      {props.featureDetails && (
        <DatabaseRecordCard
          details={props.featureDetails}
          countryName={props.selectedCountryName}
        />
      )}
      <PropertiesJsonCard {...props} />
      {isUnclaimed && <UnclaimedActions {...props} />}

      <div className="border-separator space-y-2 border-t pt-3">
        {enterBorderEdit && (
          <>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-center"
              onClick={() => enterBorderEdit()}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit borders
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center"
              onClick={() => enterBorderEdit("brush")}
            >
              <Paintbrush className="h-3.5 w-3.5" />
              Brush Territory…
            </Button>
          </>
        )}
        {!isUnclaimed && (
          <>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-center"
              onClick={() => setShowGenerator((v) => !v)}
            >
              <Grid3X3 className="h-3.5 w-3.5" />
              Generate Subdivisions…
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                if (mapSelectedCountry.featureId) {
                  router.push(`/admin/geography?featureId=${mapSelectedCountry.featureId}`);
                }
              }}
            >
              Manage database record
            </Button>
          </>
        )}
      </div>
      {showGenerator && (
        <Card>
          <ProvinceGeneratorPanel
            countryGeometry={props.countryGeometry ?? null}
            countryId={props.countryId ?? ""}
            onClose={() => setShowGenerator(false)}
          />
        </Card>
      )}
    </div>
  );
});

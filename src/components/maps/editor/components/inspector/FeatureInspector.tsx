"use client";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { useState } from "react";
import { Xmark as Close, Check, OpenNewWindow as ExternalLink } from "iconoir-react";
import type { EditorFeature } from "~/hooks/useMapEditor";
import { ScrubbableCoordinateInput } from "./ScrubbableCoordinateInput";
import { GeometryActionsBar } from "./GeometryActionsBar";
import { WikiLinkWizard } from "../../WikiLinkWizard";
import { RiverHydrologySection } from "./RiverHydrologySection";
import { LakeHydrologySection } from "./LakeHydrologySection";
import { RouteInspectorSection } from "./RouteInspectorSection";
import { InspectorSection, ReadoutRow } from "./InspectorPrimitives";
import { getFeatureIcon } from "../featureTypeIcons";
import { CITY_TYPES } from "../../optionLists";
import { resolveRouteBaseSpeed } from "~/lib/economy/travel-time";
import { api, type RouterOutputs } from "~/trpc/react";
import { useMapRealm } from "~/components/maps/core/MapRealmContext";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { Card } from "~/components/ui/card";

export interface FeaturePropertyUpdates {
  name?: string;
  wikiPageTitle?: string | null;
  cityType?: string;
  population?: number;
  isNationalCapital?: boolean;
  isSubdivisionCapital?: boolean;
  subdivisionId?: string | null;
  type?: string;
  level?: number;
  capital?: string;
  category?: string;
  description?: string;
  elevationMeters?: number;
  routeType?: string;
  status?: "planned" | "under_construction" | "operational" | "abandoned";
  isInternational?: boolean;
  speedKmh?: number;
  speed_kmh?: number;
  [key: string]: string | number | boolean | object | null | undefined;
}

interface FeatureInspectorProps {
  feature: EditorFeature;
  allFeatures?: EditorFeature[];
  onClose?: () => void;
  onUpdateFeature: (updates: FeaturePropertyUpdates) => Promise<void> | void;
  onUpdateCoordinates?: (coords: [number, number]) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onCenter?: () => void;
  onPromoteCapital?: () => void;
  onSnapCoastline?: () => void;
  onReverseRoute?: () => void;
  onEditRoute?: (routeId: string) => void;
  onPathfinderOperation?: (op: "union" | "subtract" | "intersect") => void;
  isPickingLocation?: boolean;
  onTogglePickLocation?: () => void;
  isMutating?: boolean;
}

const SUBDIVISION_LEVEL_OPTIONS = [
  { value: "1", label: "Province / State (Tier 1)" },
  { value: "2", label: "Prefecture / District (Tier 2)" },
  { value: "3", label: "County / Municipality (Tier 3)" },
];

const SPATIAL_TITLES: Partial<Record<EditorFeature["type"], string>> = {
  river: "Hydrology & Course",
  lake: "Hydrology & Limnology",
};

const MIN_SPEED_KMH = 5;
const MAX_SPEED_KMH = 2000;

type TerrainSample = RouterOutputs["countryGeo"]["sampleTerrainAt"];

function readFields(feature: EditorFeature) {
  const p = feature.properties;
  const routeType = (p?.routeType as string) || "road";
  return {
    name: feature.name || "",
    wikiPageTitle: (p?.wikiPageTitle as string) || undefined,
    subdivisionId: (p?.subdivisionId as string) || "",
    cityType: (p?.cityType as string) || "city",
    routeType,
    routeStatus: (p?.status as string) || "operational",
    isInternational: Boolean(p?.isInternational),
    routeSpeed: resolveRouteBaseSpeed(routeType, p?.speedKmh as number | undefined, p),
    subdivisionLevel: typeof p?.level === "number" ? p.level : 1,
  };
}

type Fields = ReturnType<typeof readFields>;

/** Local editable copy of the feature's properties, re-read whenever the selected feature changes. */
function useFeatureFields(feature: EditorFeature) {
  const [fields, setFields] = useState(() => readFields(feature));
  const [syncedFeature, setSyncedFeature] = useState(feature);
  if (syncedFeature !== feature) {
    setSyncedFeature(feature);
    setFields(readFields(feature));
  }
  return [fields, setFields] as const;
}

function InspectorHeader({
  feature,
  name,
  isMutating,
  onClose,
}: {
  feature: EditorFeature;
  name: string;
  isMutating: boolean;
  onClose?: () => void;
}) {
  const Icon = getFeatureIcon(feature.type);
  return (
    <Card className="flex items-center justify-between p-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="bg-tint-fill text-tint ring-tint/20 rounded-control flex h-8 w-8 shrink-0 items-center justify-center ring-1">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-label text-headline truncate leading-tight">
              {name || "Untitled Feature"}
            </h3>
          </div>
          <p className="text-label-secondary text-footnote truncate capitalize">
            {feature.type === "subdivision" ? "Region" : feature.type}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {isMutating ? (
          <div className="text-label-secondary text-footnote flex items-center gap-1 pr-1">
            <div className="border-separator border-t-primary h-3 w-3 animate-spin rounded-full border-2" />
            <span>Saving…</span>
          </div>
        ) : (
          <span className="text-label-secondary text-footnote flex items-center gap-1 pr-1">
            <Check className="text-green h-3 w-3" />
            <span>Saved</span>
          </span>
        )}

        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="text-label-secondary h-6 w-6"
            onClick={onClose}
            title="Deselect"
          >
            <Close className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}

function LabeledField({
  label,
  id,
  children,
}: {
  label: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <span id={id} className="text-label-secondary text-caption">
        {label}
      </span>
      {children}
    </div>
  );
}

function ElevationTerrainCard({
  isLoading,
  sample,
}: {
  isLoading: boolean;
  sample: TerrainSample | undefined;
}) {
  return (
    <div className="border-separator rounded-control space-y-2 border p-2">
      <div className="flex items-center justify-between">
        <Eyebrow>Elevation & terrain</Eyebrow>
        {isLoading && (
          <div className="border-separator border-t-primary h-2.5 w-2.5 animate-spin rounded-full border-2" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          ["Elevation", sample?.midpoint != null ? `${sample.midpoint.toLocaleString()} m` : "—"],
          ["Terrain zone", sample?.zoneName || "Lowland"],
        ].map(([label, value]) => (
          <div key={label} className="border-separator bg-fill-4 rounded-control-sm p-2">
            <span className="text-label-secondary text-footnote">{label}</span>
            <p className="text-label text-caption font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {sample?.elevationMin != null && sample?.elevationMax != null && (
        <ReadoutRow
          className="border-separator bg-fill-4 rounded-control-sm px-2 py-1"
          label="Zone range"
          value={`${sample.elevationMin}m to ${sample.elevationMax}m`}
        />
      )}
    </div>
  );
}

export const FeatureInspector = React.memo(function FeatureInspector({
  feature,
  allFeatures = [],
  onClose,
  onUpdateFeature,
  onUpdateCoordinates,
  onDelete,
  onDuplicate,
  onCenter,
  onPromoteCapital,
  onSnapCoastline,
  onReverseRoute,
  onEditRoute,
  onPathfinderOperation,
  isPickingLocation = false,
  onTogglePickLocation,
  isMutating = false,
}: FeatureInspectorProps) {
  const [fields, setFields] = useFeatureFields(feature);

  /** Applies a change locally and persists it. */
  const commit = (local: Partial<Fields>, updates: FeaturePropertyUpdates) => {
    setFields((f) => ({ ...f, ...local }));
    void onUpdateFeature(updates);
  };

  const handleRouteTypeChange = (routeType: string) => {
    const speedKmh = resolveRouteBaseSpeed(routeType);
    commit({ routeType, routeSpeed: speedKmh }, { routeType, speedKmh, speed_kmh: speedKmh });
  };

  const handleSpeedChange = (speed: number) => {
    const speedKmh = Math.max(MIN_SPEED_KMH, Math.min(MAX_SPEED_KMH, speed));
    commit({ routeSpeed: speedKmh }, { speedKmh, speed_kmh: speedKmh });
  };

  const coords = feature.coordinates;
  const realm = useMapRealm();
  const sampleTerrain = api.countryGeo.sampleTerrainAt.useQuery(
    { lng: coords?.[0] ?? 0, lat: coords?.[1] ?? 0, realm },
    { enabled: !!coords && coords[0] !== 0 && coords[1] !== 0 }
  );

  const handleNameBlur = () => {
    if (fields.name.trim() !== (feature.name || "").trim()) {
      void onUpdateFeature({ name: fields.name.trim() });
    }
  };

  const subdivisions = allFeatures.filter((f) => f.type === "subdivision");
  const { type } = feature;

  return (
    <div className="text-footnote space-y-3 select-none">
      <InspectorHeader
        feature={feature}
        name={fields.name}
        isMutating={isMutating}
        onClose={onClose}
      />

      <InspectorSection title="Details">
        <LabeledField label="Name">
          <input
            type="text"
            value={fields.name}
            onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
            onBlur={handleNameBlur}
            placeholder="e.g. Caphiria"
            className="border-separator bg-surface text-label placeholder:text-label-tertiary focus:border-tint focus:ring-tint rounded-control text-caption w-full border px-3 py-2 transition-colors focus:ring-1 focus:outline-none"
          />
        </LabeledField>

        {type === "city" && (
          <LabeledField label="Type" id="inspector-city-type">
            <ToggleGroup
              type="single"
              disallowEmpty
              variant="outline"
              size="sm"
              aria-labelledby="inspector-city-type"
              value={fields.cityType}
              onValueChange={(cityType) =>
                cityType &&
                commit({ cityType }, { cityType, isNationalCapital: cityType === "capital" })
              }
            >
              {CITY_TYPES.map((t) => (
                <ToggleGroupItem key={t} value={t} className="capitalize">
                  {t}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </LabeledField>
        )}

        {type === "route" && (
          <RouteInspectorSection
            feature={feature}
            routeType={fields.routeType}
            routeStatus={fields.routeStatus}
            isInternational={fields.isInternational}
            routeSpeed={fields.routeSpeed}
            onRouteTypeChange={handleRouteTypeChange}
            onStatusChange={(routeStatus) =>
              commit({ routeStatus }, { status: routeStatus as FeaturePropertyUpdates["status"] })
            }
            onInternationalChange={(isInternational) =>
              commit({ isInternational }, { isInternational })
            }
            onSpeedChange={handleSpeedChange}
            onEditRoute={onEditRoute}
          />
        )}

        {type === "subdivision" && (
          <LabeledField label="Level">
            <OptionSelect
              aria-label="Level"
              value={String(fields.subdivisionLevel)}
              onValueChange={(v) => {
                const level = parseInt(v, 10);
                commit({ subdivisionLevel: level }, { level });
              }}
              options={SUBDIVISION_LEVEL_OPTIONS}
              size="sm"
              className="w-full"
            />
          </LabeledField>
        )}

        {type !== "subdivision" && subdivisions.length > 0 && (
          <LabeledField label="Region">
            <OptionSelect
              aria-label="Region"
              value={fields.subdivisionId}
              onValueChange={(subdivisionId) =>
                commit({ subdivisionId }, { subdivisionId: subdivisionId || null })
              }
              options={[
                { value: "", label: "None" },
                ...subdivisions.map((s) => ({ value: s.id, label: s.name || s.id })),
              ]}
              size="sm"
              className="w-full"
            />
          </LabeledField>
        )}
      </InspectorSection>

      <InspectorSection title={SPATIAL_TITLES[type] ?? "Location"}>
        {type === "river" ? (
          <RiverHydrologySection feature={feature} />
        ) : type === "lake" ? (
          <LakeHydrologySection feature={feature} onUpdateFeature={onUpdateFeature} />
        ) : (
          <>
            {coords && onUpdateCoordinates && (
              <ScrubbableCoordinateInput
                coordinates={coords}
                onChange={onUpdateCoordinates}
                isPickingLocation={isPickingLocation}
                onTogglePickLocation={onTogglePickLocation}
                disabled={isMutating}
              />
            )}
            {coords && (
              <ElevationTerrainCard
                isLoading={sampleTerrain.isLoading}
                sample={sampleTerrain.data}
              />
            )}
          </>
        )}
      </InspectorSection>

      <InspectorSection title="Wiki article">
        <LabeledField label="Article title">
          <WikiLinkWizard
            value={fields.wikiPageTitle}
            onChange={(wikiPageTitle) =>
              commit({ wikiPageTitle }, { wikiPageTitle: wikiPageTitle || null })
            }
            currentCoords={coords}
            placeholder="Search wiki articles…"
          />
        </LabeledField>

        {fields.wikiPageTitle && (
          <a
            href={`/wiki/${encodeURIComponent(fields.wikiPageTitle)}`}
            target="_blank"
            rel="noreferrer"
            className="border-separator bg-surface hover:bg-fill-3 text-label rounded-control text-caption flex items-center justify-center gap-2 border py-2 transition-[color,background-color,border-color,box-shadow,opacity]"
          >
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            <span>Open in wiki</span>
          </a>
        )}
      </InspectorSection>

      <InspectorSection title="Actions">
        <GeometryActionsBar
          feature={feature}
          onCenter={onCenter}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onPromoteCapital={onPromoteCapital}
          onSnapCoastline={onSnapCoastline}
          onReverseRoute={onReverseRoute}
          onPathfinderOperation={onPathfinderOperation}
          disabled={isMutating}
        />
      </InspectorSection>
    </div>
  );
});

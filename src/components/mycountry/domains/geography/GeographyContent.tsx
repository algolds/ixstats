"use client";

import React, { useState } from "react";
import {
  MapPin,
  City as Building2,
  Pin,
  FloppyDisk as Save,
  SystemRestart as Loader2,
  Label as Tag,
} from "iconoir-react";
import type { City, PointOfInterest, Subdivision } from "@prisma/client";
import { api, type RouterOutputs } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { SearchableList } from "~/components/mycountry/shared/primitives";
import { RollupSettingsModal } from "~/components/mycountry/shared/modals/RollupSettingsModal";
import { PopulateFromWikiButton } from "~/components/mycountry/shell/PopulateFromWikiButton";
import { GeoCompliancePanel } from "./GeoCompliancePanel";
import { GeographyReportModal } from "./GeographyReportModal";
import { TransitMobilityCard } from "./TransitMobilityCard";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

/**
 * Geography attribute editor (cities, subdivisions, POIs) plus the rollup settings dialog. Spatial
 * data (geometry, coordinates, placement) belongs to the map editor; writes go through the
 * owner-gated countryGeo router.
 */
export function GeographyContent() {
  const { country } = useCountryData();
  const countryId = country?.id;

  const {
    data: bundle,
    isLoading,
    refetch,
  } = api.countryGeo.getCountryGeoBundle.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const { data: geoProfile } = api.geoCore.getCountryGeoProfile.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId && !!bundle?.geometry, staleTime: 30_000 }
  );

  if (!countryId) {
    return <p className="text-label-secondary text-body">No country context.</p>;
  }

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading geography">
        <Skeleton className="rounded-card h-16" />
        <Skeleton className="rounded-card h-32" />
      </div>
    );
  }

  if (!bundle) {
    return <p className="text-label-secondary text-body">No geographic data found.</p>;
  }

  if (!bundle.geometry) {
    return (
      <div className="space-y-4">
        <Card className="rounded-card">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <MapPin aria-hidden="true" className="text-label-secondary mb-3 h-8 w-8" />
            <h3 className="text-label text-title-3 mb-2">Map integration required</h3>
            <p className="text-label-secondary text-footnote max-w-md leading-relaxed">
              This nation has not yet established map coordinates. Map feature linkage is required
              to define cities, subdivisions, and points of interest.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <GeographyBody
      countryId={countryId}
      countryName={country?.name}
      bundle={bundle}
      geoProfile={geoProfile}
      onRefetch={() => refetch()}
    />
  );
}

type GeoProfile = NonNullable<RouterOutputs["geoCore"]["getCountryGeoProfile"]>;
type GeoBundle = NonNullable<RouterOutputs["countryGeo"]["getCountryGeoBundle"]>;

function GeographyBody({
  countryId,
  countryName,
  bundle,
  geoProfile,
  onRefetch,
}: {
  countryId: string;
  countryName?: string;
  bundle: GeoBundle;
  geoProfile: GeoProfile | undefined;
  onRefetch: () => void;
}) {
  const { isPublicReadOnly } = useCountryData();
  // The bundle builder queries through an untyped client; rows are these Prisma models.
  const cities: City[] = bundle.cities;
  const subdivisions: Subdivision[] = bundle.subdivisions;
  const pois: PointOfInterest[] = bundle.pois;
  const { rollups, country: countryData } = bundle;

  return (
    <div className="space-y-4">
      {rollups && !isPublicReadOnly && (
        <RollupSettingsModal
          countryId={countryId}
          geoRollupMode={countryData?.geoRollupMode ?? "hybrid"}
          rollups={rollups}
          nationalPopulation={countryData?.currentPopulation ?? 0}
          nationalGdp={countryData?.currentTotalGdp ?? 0}
          onUpdated={onRefetch}
        />
      )}
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            { label: "Cities", icon: Building2, value: cities.length },
            { label: "Subdivisions", icon: MapPin, value: subdivisions.length },
            { label: "POIs", icon: Pin, value: pois.length },
          ] as const
        ).map(({ label, icon: Icon, value }) => (
          <Card key={label} className="rounded-card p-3">
            <div className="flex items-center gap-2">
              <Icon aria-hidden="true" className="text-label-secondary h-3.5 w-3.5" />
              <span className="text-stat-label text-label-secondary">{label}</span>
            </div>
            <p className="text-label text-title-3 mt-1 tabular-nums">{value}</p>
          </Card>
        ))}
      </div>
      {geoProfile && (
        <Card className="rounded-card">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 p-4 pb-3">
            <h3 className="text-label text-headline">Geographic profile</h3>
            <GeographyReportModal countryName={countryName ?? ""} geoProfile={geoProfile} />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-4">
            <ProfileStat
              label="Land area"
              value={`${geoProfile.area.areaKm2.toLocaleString()} km²`}
              mono
            />
            <ProfileStat
              label="Climate"
              value={geoProfile.climate.dominant ?? "—"}
              title={geoProfile.climate.dominant ?? undefined}
            />
            <ProfileStat
              label="Mean elevation"
              value={`${Math.round(geoProfile.elevation.meanElev).toLocaleString()} m`}
              mono
            />
            <ProfileStat
              label="Hydrology"
              value={`${geoProfile.hydro.riverCount} rivers / ${geoProfile.hydro.lakeCount} lakes`}
            />
          </CardContent>
        </Card>
      )}

      {/* Surfaces rollup inconsistencies, capital integrity, founded-year and coordinate-bounds issues. */}
      {!isPublicReadOnly && <GeoCompliancePanel countryId={countryId} onRefresh={onRefetch} />}
      <TransitMobilityCard countryId={countryId} countryName={countryName} />
      <SearchableList
        title="Cities"
        icon={<Building2 className="text-label-secondary h-3.5 w-3.5" />}
        items={cities}
        searchKeys={["name", "type", "mayorName", "specialization"]}
        searchPlaceholder="Search cities, mayors, specializations…"
        emptyMessage="No cities yet. Use the map editor to place some."
        noMatchMessage="No cities match your search."
        renderItem={(city) => <CityEditor item={city} countryId={countryId} onSaved={onRefetch} />}
      />
      <SearchableList
        title="Subdivisions"
        icon={<MapPin className="text-label-secondary h-3.5 w-3.5" />}
        items={subdivisions}
        searchKeys={["name", "type", "governorName", "governmentType"]}
        searchPlaceholder="Search subdivisions, governors, government…"
        emptyMessage="No subdivisions yet. Generate some from the action buttons above."
        noMatchMessage="No subdivisions match your search."
        renderItem={(sub) => (
          <SubdivisionEditor item={sub} countryId={countryId} onSaved={onRefetch} />
        )}
      />
      <SearchableList
        title="Points of interest"
        icon={<Pin className="text-label-secondary h-3.5 w-3.5" />}
        items={pois}
        searchKeys={["name", "category", "description"]}
        searchPlaceholder="Search POIs, categories…"
        emptyMessage="No points of interest yet."
        noMatchMessage="No POIs match your search."
        renderItem={(poi) => <PoiCard poi={poi} countryId={countryId} onApplied={onRefetch} />}
      />
    </div>
  );
}

interface EditorActionsProps {
  editing: boolean;
  readOnly: boolean;
  isPending: boolean;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
  populate: React.ReactNode;
}

/** Save/Cancel while editing; the wiki populate button and Edit otherwise (hidden when read-only). */
function EditorActions({
  editing,
  readOnly,
  isPending,
  onSave,
  onCancel,
  onEdit,
  populate,
}: EditorActionsProps) {
  if (editing) {
    return (
      <div className="flex gap-1">
        <Button
          type="button"
          size="xs"
          onClick={onSave}
          disabled={isPending}
          className="h-11 sm:h-7"
        >
          {isPending ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Save aria-hidden="true" />
          )}
          Save
        </Button>
        <Button type="button" variant="ghost" size="xs" onClick={onCancel} className="h-11 sm:h-7">
          Cancel
        </Button>
      </div>
    );
  }
  if (readOnly) return null;
  return (
    <div className="flex items-center gap-1">
      {populate}
      <Button type="button" variant="ghost" size="xs" onClick={onEdit} className="h-11 sm:h-7">
        Edit
      </Button>
    </div>
  );
}

interface TextField {
  key: string;
  label: string;
  value: string | null;
}

interface GeoEntityCardProps {
  name: string;
  subtitle: string;
  population: number | null;
  gdpContribution: number | null;
  /** Free-text attributes; the first is also shown in the read-only summary as `summaryLabel`. */
  textFields: TextField[];
  summaryLabel: string;
  isPending: boolean;
  onSave: (
    values: { population: number; gdpContribution: number; text: Record<string, string> },
    done: () => void
  ) => void;
  populate: React.ReactNode;
}

/** The shared editor card for a city or subdivision: stats summary, or inputs while editing. */
function GeoEntityCard({
  name,
  subtitle,
  population: initialPopulation,
  gdpContribution: initialGdp,
  textFields,
  summaryLabel,
  isPending,
  onSave,
  populate,
}: GeoEntityCardProps) {
  const [editing, setEditing] = useState(false);
  const [population, setPopulation] = useState(initialPopulation ?? 0);
  const [gdpContribution, setGdpContribution] = useState(initialGdp ?? 0);
  const [text, setText] = useState(() =>
    Object.fromEntries(textFields.map((f) => [f.key, f.value ?? ""]))
  );
  const { isPublicReadOnly } = useCountryData();
  const summaryValue = textFields[0]?.value;

  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-label text-caption font-semibold">{name}</div>
          <div className="text-label-secondary text-footnote">{subtitle}</div>
        </div>
        <EditorActions
          editing={editing && !isPublicReadOnly}
          readOnly={!!isPublicReadOnly}
          isPending={isPending}
          onSave={() => onSave({ population, gdpContribution, text }, () => setEditing(false))}
          onCancel={() => setEditing(false)}
          onEdit={() => setEditing(true)}
          populate={populate}
        />
      </div>

      {editing ? (
        <div className="space-y-2">
          <FieldInput
            label="Population"
            type="number"
            value={population}
            onChange={(v) => setPopulation(parseInt(v) || 0)}
          />
          <FieldInput
            label="GDP contribution"
            type="number"
            value={gdpContribution}
            onChange={(v) => setGdpContribution(parseFloat(v) || 0)}
          />
          {textFields.map((f) => (
            <FieldInput
              key={f.key}
              label={f.label}
              type="text"
              value={text[f.key] ?? ""}
              onChange={(v) => setText((prev) => ({ ...prev, [f.key]: v }))}
            />
          ))}
        </div>
      ) : (
        <div className="text-label-secondary text-footnote grid grid-cols-2 gap-2">
          {[
            ["Pop", (initialPopulation ?? 0).toLocaleString()],
            ["GDP", Math.round(initialGdp ?? 0).toLocaleString()],
          ].map(([label, value]) => (
            <div key={label}>
              <span className="text-stat-label text-label-secondary block">{label}</span>
              <div className="text-label-secondary text-footnote">{value}</div>
            </div>
          ))}
          {summaryValue && (
            <div className="col-span-2">
              <Eyebrow className="block">{summaryLabel}</Eyebrow>
              <div className="text-label-secondary text-footnote">{summaryValue}</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

interface EditorProps<T> {
  countryId: string;
  onSaved: () => void;
  item: T;
}

function CityEditor({ item: city, countryId, onSaved }: EditorProps<City>) {
  const upsert = api.countryGeo.upsertCity.useMutation();
  return (
    <GeoEntityCard
      name={city.name}
      subtitle={`${city.isNationalCapital ? "National capital" : city.type}${city.wikiPageTitle ? ` · wiki: ${city.wikiPageTitle}` : ""}`}
      population={city.population}
      gdpContribution={city.gdpContribution}
      textFields={[
        { key: "mayorName", label: "Mayor name", value: city.mayorName },
        { key: "specialization", label: "Specialization", value: city.specialization },
      ]}
      summaryLabel="Mayor"
      isPending={upsert.isPending}
      onSave={({ population, gdpContribution, text }, done) =>
        upsert.mutate(
          {
            countryId,
            id: city.id,
            name: city.name,
            population,
            gdpContribution,
            mayorName: text.mayorName || undefined,
            specialization: text.specialization || undefined,
          },
          {
            onSuccess: () => {
              done();
              onSaved();
            },
          }
        )
      }
      populate={
        <PopulateFromWikiButton
          countryId={countryId}
          kind="city"
          id={city.id}
          wikiTitle={city.wikiPageTitle}
          onApplied={onSaved}
        />
      }
    />
  );
}

function SubdivisionEditor({ item: subdivision, countryId, onSaved }: EditorProps<Subdivision>) {
  const upsert = api.countryGeo.upsertSubdivision.useMutation();
  return (
    <GeoEntityCard
      name={subdivision.name}
      subtitle={subdivision.type}
      population={subdivision.population}
      gdpContribution={subdivision.gdpContribution}
      textFields={[
        { key: "governorName", label: "Governor name", value: subdivision.governorName },
        { key: "governmentType", label: "Government type", value: subdivision.governmentType },
      ]}
      summaryLabel="Governor"
      isPending={upsert.isPending}
      onSave={({ population, gdpContribution, text }, done) =>
        upsert.mutate(
          {
            countryId,
            id: subdivision.id,
            name: subdivision.name,
            population,
            gdpContribution,
            governorName: text.governorName || undefined,
            governmentType: text.governmentType || undefined,
          },
          {
            onSuccess: () => {
              done();
              onSaved();
            },
          }
        )
      }
      populate={
        <PopulateFromWikiButton
          countryId={countryId}
          kind="subdivision"
          id={subdivision.id}
          onApplied={onSaved}
        />
      }
    />
  );
}

function PoiCard({
  poi,
  countryId,
  onApplied,
}: {
  poi: PointOfInterest;
  countryId: string;
  onApplied?: () => void;
}) {
  const { isPublicReadOnly } = useCountryData();
  return (
    <Card className="p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Tag aria-hidden="true" className="text-label-secondary h-3 w-3" />
          <div className="text-label text-caption font-semibold">{poi.name}</div>
        </div>
        {!isPublicReadOnly && (
          <PopulateFromWikiButton
            countryId={countryId}
            kind="poi"
            id={poi.id}
            wikiTitle={poi.wikiPageTitle}
            onApplied={onApplied}
            compact
          />
        )}
      </div>
      <div className="text-label-secondary text-footnote mb-1 flex items-center gap-1">
        <Badge variant="default" className="capitalize">
          {poi.category}
        </Badge>
        {poi.wikiPageTitle ? <span>· wiki: {poi.wikiPageTitle}</span> : null}
      </div>
      {poi.description && (
        <p className="text-label-secondary text-footnote leading-snug">{poi.description}</p>
      )}
    </Card>
  );
}

function FieldInput({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: "text" | "number";
  value: string | number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <Eyebrow className="block">{label}</Eyebrow>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-footnote h-11 sm:h-8"
      />
    </label>
  );
}

/** A captioned figure inside the geographic profile card (opaque: nested in a Facet card). */
function ProfileStat({
  label,
  value,
  title,
  mono = false,
}: {
  label: string;
  value: string;
  title?: string;
  mono?: boolean;
}) {
  return (
    <Card className="p-2">
      <span className="text-stat-label text-label-secondary block">{label}</span>
      <p
        className={cn(
          "text-label text-caption mt-0.5 truncate font-semibold",
          mono && "tabular-nums"
        )}
        title={title}
      >
        {value}
      </p>
    </Card>
  );
}

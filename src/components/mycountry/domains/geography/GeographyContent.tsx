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
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { SearchableList } from "~/components/mycountry/shared/primitives";
import { RollupSettingsModal } from "~/components/mycountry/shared/modals/RollupSettingsModal";
import { PopulateFromWikiButton } from "~/components/mycountry/shell/PopulateFromWikiButton";
import { GeoCompliancePanel } from "./GeoCompliancePanel";
import { GeographyReportModal } from "./GeographyReportModal";
import { TransitMobilityCard } from "./TransitMobilityCard";
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";

/**
 * Geography attribute editor — MyCountry P-C.
 *
 * Lives under the Overview page, after the Government tab. Owns the
 * geographic attribute UI (cities, subdivisions, POIs) + a settings
 * dialog for the geographic rollup mode and rebase action. Spatial
 * (geometry, coordinates, placement) is owned by the map editor.
 *
 * Uses the existing countryGeo tRPC router (upsertCity, upsertSubdivision,
 * upsertPoi, setCapital) — owner-gated via standardMutationCountryOwnerProcedure.
 */
export function GeographyContent() {
  const { country, isPublicReadOnly } = useCountryData();
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
    return <p className="text-muted-foreground text-sm">No country context.</p>;
  }

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading geography">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  if (!bundle) {
    return <p className="text-muted-foreground text-sm">No geographic data found.</p>;
  }

  // The bundle builder queries through an untyped client; rows are these Prisma models.
  const cities: City[] = bundle.cities;
  const subdivisions: Subdivision[] = bundle.subdivisions;
  const pois: PointOfInterest[] = bundle.pois;
  const { rollups, country: countryData } = bundle;

  if (!bundle.geometry) {
    return (
      <div className="space-y-4">
        <FacetCard className="rounded-2xl">
          <FacetCardContent className="flex flex-col items-center justify-center p-8 text-center">
            <MapPin aria-hidden="true" className="text-muted-foreground mb-3 h-8 w-8" />
            <h3 className="text-foreground mb-2 text-base font-semibold">
              Map integration required
            </h3>
            <p className="text-muted-foreground max-w-md text-xs leading-relaxed">
              This nation has not yet established map coordinates. Map feature linkage is required
              to define cities, subdivisions, and points of interest.
            </p>
          </FacetCardContent>
        </FacetCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Rollup settings trigger */}
      {rollups && !isPublicReadOnly && (
        <RollupSettingsModal
          countryId={countryId}
          geoRollupMode={countryData?.geoRollupMode ?? "hybrid"}
          rollups={rollups}
          nationalPopulation={countryData?.currentPopulation ?? 0}
          nationalGdp={countryData?.currentTotalGdp ?? 0}
          onUpdated={() => refetch()}
        />
      )}

      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            { label: "Cities", icon: Building2, value: cities.length },
            { label: "Subdivisions", icon: MapPin, value: subdivisions.length },
            { label: "POIs", icon: Pin, value: pois.length },
          ] as const
        ).map(({ label, icon: Icon, value }) => (
          <FacetCard key={label} className="rounded-2xl p-3">
            <div className="flex items-center gap-1.5">
              <Icon aria-hidden="true" className="text-muted-foreground h-3.5 w-3.5" />
              <Eyebrow>{label}</Eyebrow>
            </div>
            <p className="text-foreground mt-1 text-lg font-semibold tabular-nums">{value}</p>
          </FacetCard>
        ))}
      </div>

      {/* Geographic profile summary */}
      {geoProfile && (
        <FacetCard className="rounded-2xl">
          <FacetCardHeader className="flex-row flex-wrap items-center justify-between gap-2 p-4 pb-3">
            <h3 className="text-foreground text-sm font-semibold">Geographic profile</h3>
            <GeographyReportModal countryName={country?.name ?? ""} geoProfile={geoProfile} />
          </FacetCardHeader>
          <FacetCardContent className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-4">
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
          </FacetCardContent>
        </FacetCard>
      )}

      {/* Compliance guard — surfaces population/GDP rollup inconsistencies,
          capital integrity, founded-year sanity, and coordinate-bounds issues. */}
      {!isPublicReadOnly && (
        <GeoCompliancePanel countryId={countryId} onRefresh={() => refetch()} />
      )}

      {/* National Transit & Mobility Index Card */}
      <TransitMobilityCard countryId={countryId} countryName={country?.name} />

      {/* Cities editor */}
      <SearchableList
        title="Cities"
        icon={<Building2 className="text-muted-foreground h-3.5 w-3.5" />}
        items={cities}
        searchKeys={["name", "type", "mayorName", "specialization"]}
        searchPlaceholder="Search cities, mayors, specializations…"
        emptyMessage="No cities yet. Use the map editor to place some."
        noMatchMessage="No cities match your search."
        renderItem={(city) => (
          <CityEditor city={city} countryId={countryId} onSaved={() => refetch()} />
        )}
      />

      {/* Subdivisions editor */}
      <SearchableList
        title="Subdivisions"
        icon={<MapPin className="text-muted-foreground h-3.5 w-3.5" />}
        items={subdivisions}
        searchKeys={["name", "type", "governorName", "governmentType"]}
        searchPlaceholder="Search subdivisions, governors, government…"
        emptyMessage="No subdivisions yet. Generate some from the action buttons above."
        noMatchMessage="No subdivisions match your search."
        renderItem={(sub) => (
          <SubdivisionEditor subdivision={sub} countryId={countryId} onSaved={() => refetch()} />
        )}
      />

      {/* Points of Interest (read-only) */}
      <SearchableList
        title="Points of Interest"
        icon={<Pin className="text-muted-foreground h-3.5 w-3.5" />}
        items={pois}
        searchKeys={["name", "category", "description"]}
        searchPlaceholder="Search POIs, categories…"
        emptyMessage="No points of interest yet."
        noMatchMessage="No POIs match your search."
        renderItem={(poi) => (
          <PoiCard poi={poi} countryId={countryId} onApplied={() => refetch()} />
        )}
      />
    </div>
  );
}

interface CityEditorProps {
  city: City;
  countryId: string;
  onSaved: () => void;
}

function CityEditor({ city, countryId, onSaved }: CityEditorProps) {
  const [editing, setEditing] = useState(false);
  const [population, setPopulation] = useState(city.population ?? 0);
  const [gdpContribution, setGdpContribution] = useState(city.gdpContribution ?? 0);
  const [mayorName, setMayorName] = useState(city.mayorName ?? "");
  const [specialization, setSpecialization] = useState(city.specialization ?? "");
  const { isPublicReadOnly } = useCountryData();

  const upsert = api.countryGeo.upsertCity.useMutation({
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
  });

  const handleSave = () => {
    upsert.mutate({
      countryId,
      id: city.id,
      name: city.name,
      population: population,
      gdpContribution: gdpContribution,
      mayorName: mayorName || undefined,
      specialization: specialization || undefined,
    });
  };

  return (
    <FacetCard surface="solid" className="rounded-xl p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-foreground text-xs font-semibold">{city.name}</div>
          <div className="text-muted-foreground text-xs">
            {city.isNationalCapital ? "National capital" : city.type}
            {city.wikiPageTitle ? ` · wiki: ${city.wikiPageTitle}` : ""}
          </div>
        </div>
        {editing && !isPublicReadOnly ? (
          <div className="flex gap-1">
            <Button
              type="button"
              size="xs"
              onClick={handleSave}
              disabled={upsert.isPending}
              className="h-11 sm:h-7"
            >
              {upsert.isPending ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <Save aria-hidden="true" />
              )}
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setEditing(false)}
              className="h-11 sm:h-7"
            >
              Cancel
            </Button>
          </div>
        ) : (
          !isPublicReadOnly && (
            <div className="flex items-center gap-1">
              <PopulateFromWikiButton
                countryId={countryId}
                kind="city"
                id={city.id}
                wikiTitle={city.wikiPageTitle}
                onApplied={onSaved}
              />
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setEditing(true)}
                className="h-11 sm:h-7"
              >
                Edit
              </Button>
            </div>
          )
        )}
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
            label="GDP Contribution"
            type="number"
            value={gdpContribution}
            onChange={(v) => setGdpContribution(parseFloat(v) || 0)}
          />
          <FieldInput label="Mayor Name" type="text" value={mayorName} onChange={setMayorName} />
          <FieldInput
            label="Specialization"
            type="text"
            value={specialization}
            onChange={setSpecialization}
          />
        </div>
      ) : (
        <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
          <div>
            <Eyebrow className="block">Pop</Eyebrow>
            <div className="text-foreground/80 text-xs">
              {(city.population ?? 0).toLocaleString()}
            </div>
          </div>
          <div>
            <Eyebrow className="block">GDP</Eyebrow>
            <div className="text-foreground/80 text-xs">
              {Math.round(city.gdpContribution ?? 0).toLocaleString()}
            </div>
          </div>
          {city.mayorName && (
            <div className="col-span-2">
              <Eyebrow className="block">Mayor</Eyebrow>
              <div className="text-foreground/80 text-xs">{city.mayorName}</div>
            </div>
          )}
        </div>
      )}
    </FacetCard>
  );
}

interface SubdivisionEditorProps {
  subdivision: Subdivision;
  countryId: string;
  onSaved: () => void;
}

function SubdivisionEditor({ subdivision, countryId, onSaved }: SubdivisionEditorProps) {
  const [editing, setEditing] = useState(false);
  const [population, setPopulation] = useState(subdivision.population ?? 0);
  const [gdpContribution, setGdpContribution] = useState(subdivision.gdpContribution ?? 0);
  const [governorName, setGovernorName] = useState(subdivision.governorName ?? "");
  const [governmentType, setGovernmentType] = useState(subdivision.governmentType ?? "");
  const { isPublicReadOnly } = useCountryData();

  const upsert = api.countryGeo.upsertSubdivision.useMutation({
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
  });

  const handleSave = () => {
    upsert.mutate({
      countryId,
      id: subdivision.id,
      name: subdivision.name,
      population: population,
      gdpContribution: gdpContribution,
      governorName: governorName || undefined,
      governmentType: governmentType || undefined,
    });
  };

  return (
    <FacetCard surface="solid" className="rounded-xl p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-foreground text-xs font-semibold">{subdivision.name}</div>
          <div className="text-muted-foreground text-xs">{subdivision.type}</div>
        </div>
        {editing && !isPublicReadOnly ? (
          <div className="flex gap-1">
            <Button
              type="button"
              size="xs"
              onClick={handleSave}
              disabled={upsert.isPending}
              className="h-11 sm:h-7"
            >
              {upsert.isPending ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <Save aria-hidden="true" />
              )}
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setEditing(false)}
              className="h-11 sm:h-7"
            >
              Cancel
            </Button>
          </div>
        ) : (
          !isPublicReadOnly && (
            <div className="flex items-center gap-1">
              <PopulateFromWikiButton
                countryId={countryId}
                kind="subdivision"
                id={subdivision.id}
                onApplied={onSaved}
              />
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setEditing(true)}
                className="h-11 sm:h-7"
              >
                Edit
              </Button>
            </div>
          )
        )}
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
            label="GDP Contribution"
            type="number"
            value={gdpContribution}
            onChange={(v) => setGdpContribution(parseFloat(v) || 0)}
          />
          <FieldInput
            label="Governor Name"
            type="text"
            value={governorName}
            onChange={setGovernorName}
          />
          <FieldInput
            label="Government Type"
            type="text"
            value={governmentType}
            onChange={setGovernmentType}
          />
        </div>
      ) : (
        <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
          <div>
            <Eyebrow className="block">Pop</Eyebrow>
            <div className="text-foreground/80 text-xs">
              {(subdivision.population ?? 0).toLocaleString()}
            </div>
          </div>
          <div>
            <Eyebrow className="block">GDP</Eyebrow>
            <div className="text-foreground/80 text-xs">
              {Math.round(subdivision.gdpContribution ?? 0).toLocaleString()}
            </div>
          </div>
          {subdivision.governorName && (
            <div className="col-span-2">
              <Eyebrow className="block">Governor</Eyebrow>
              <div className="text-foreground/80 text-xs">{subdivision.governorName}</div>
            </div>
          )}
        </div>
      )}
    </FacetCard>
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
    <FacetCard surface="solid" className="rounded-xl p-3">
      <div className="mb-1 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <Tag aria-hidden="true" className="text-muted-foreground h-3 w-3" />
          <div className="text-foreground text-xs font-semibold">{poi.name}</div>
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
      <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
        <Badge variant="secondary" className="capitalize">
          {poi.category}
        </Badge>
        {poi.wikiPageTitle ? <span>· wiki: {poi.wikiPageTitle}</span> : null}
      </div>
      {poi.description && (
        <p className="text-foreground/80 text-xs leading-snug">{poi.description}</p>
      )}
    </FacetCard>
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
        className="h-11 text-xs sm:h-8"
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
    <FacetCard surface="solid" className="rounded-xl p-2.5">
      <Eyebrow className="block">{label}</Eyebrow>
      <p
        className={cn(
          "text-foreground mt-0.5 truncate text-xs font-semibold",
          mono && "font-mono tabular-nums"
        )}
        title={title}
      >
        {value}
      </p>
    </FacetCard>
  );
}

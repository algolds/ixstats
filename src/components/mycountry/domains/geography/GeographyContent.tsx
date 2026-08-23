"use client";

import React, { useState } from "react";
import { MapPin, City as Building2, Pin, FloppyDisk as Save, SystemRestart as Loader2, Label as Tag } from "iconoir-react";
import { api } from "~/trpc/react";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { SearchableList } from "~/components/mycountry/shared/primitives";
import { RollupSettingsModal } from "~/components/mycountry/shared/modals/RollupSettingsModal";
import { PopulateFromWikiButton } from "~/components/mycountry/shell/PopulateFromWikiButton";
import { GeoCompliancePanel } from "./GeoCompliancePanel";
import { GeographyReportModal } from "./GeographyReportModal";
import { Card, CardContent } from "~/components/ui/card";

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
      <div className="space-y-2">
        <div className="bg-muted h-12 animate-pulse rounded" />
        <div className="bg-muted h-32 animate-pulse rounded" />
      </div>
    );
  }

  if (!bundle) {
    return <p className="text-muted-foreground text-sm">No geographic data found.</p>;
  }

  const { cities, subdivisions, pois, rollups, country: countryData } = bundle;

  if (!bundle.geometry) {
    return (
      <div className="space-y-4">
        <Card className="facet-surface border-border overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <div className="bg-muted/50 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
              <MapPin className="text-muted-foreground/60 h-8 w-8" />
            </div>
            <h3 className="text-foreground mb-2 text-lg font-semibold">Map Integration Required</h3>
            <p className="text-muted-foreground max-w-md text-xs leading-relaxed">
              This nation has not yet established map coordinates. Map feature linkage is required
              to define cities, subdivisions, and points of interest.
            </p>
          </CardContent>
        </Card>
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
        <div className="bg-card/30 flex h-16 flex-col justify-between rounded-xl border border-white/10 p-3 backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:bg-white/[0.06]">
          <div className="text-muted-foreground/80 flex items-center gap-1.5 text-[9px] font-extrabold tracking-wider uppercase">
            <Building2 className="h-3 w-3 text-[var(--flag-primary)]" />
            Cities
          </div>
          <div className="text-foreground text-lg font-bold tracking-tight">{cities.length}</div>
        </div>
        <div className="bg-card/30 flex h-16 flex-col justify-between rounded-xl border border-white/10 p-3 backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:bg-white/[0.06]">
          <div className="text-muted-foreground/80 flex items-center gap-1.5 text-[9px] font-extrabold tracking-wider uppercase">
            <MapPin className="h-3 w-3 text-[var(--flag-secondary)]" />
            Subdivisions
          </div>
          <div className="text-foreground text-lg font-bold tracking-tight">
            {subdivisions.length}
          </div>
        </div>
        <div className="bg-card/30 flex h-16 flex-col justify-between rounded-xl border border-white/10 p-3 backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:bg-white/[0.06]">
          <div className="text-muted-foreground/80 flex items-center gap-1.5 text-[9px] font-extrabold tracking-wider uppercase">
            <Pin className="h-3 w-3 text-[var(--flag-accent)]" />
            POIs
          </div>
          <div className="text-foreground text-lg font-bold tracking-tight">{pois.length}</div>
        </div>
      </div>

      {/* Geographic Profile summary card */}
      {geoProfile && (
        <div className="bg-card/30 space-y-3 rounded-xl border border-white/10 p-4 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="text-foreground text-xs font-extrabold tracking-wider uppercase">
              Geographic Profile
            </div>
            <GeographyReportModal countryName={country?.name ?? ""} geoProfile={geoProfile} />
          </div>
          <div className="text-muted-foreground grid grid-cols-2 gap-3 text-[10px] sm:grid-cols-4">
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
              <span className="text-muted-foreground/80 text-[9px] font-extrabold tracking-wider uppercase">
                Land Area
              </span>
              <div className="text-foreground font-mono text-xs font-bold tracking-tight">
                {geoProfile.area.areaKm2.toLocaleString()} km²
              </div>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
              <span className="text-muted-foreground/80 text-[9px] font-extrabold tracking-wider uppercase">
                Climate Model
              </span>
              <div
                className="text-foreground truncate text-xs font-bold tracking-tight"
                title={geoProfile.climate.dominant ?? undefined}
              >
                {geoProfile.climate.dominant}
              </div>
            </div>
            <div>
              <span className="text-[9px] uppercase">Mean Elevation</span>
              <div className="text-foreground/80 font-mono text-xs font-semibold">
                {Math.round(geoProfile.elevation.meanElev).toLocaleString()} m
              </div>
            </div>
            <div>
              <span className="text-[9px] uppercase">Hydrology</span>
              <div className="text-foreground/80 font-mono text-xs font-semibold">
                {geoProfile.hydro.riverCount} Rivers / {geoProfile.hydro.lakeCount} Lakes
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compliance guard — surfaces population/GDP rollup inconsistencies,
          capital integrity, founded-year sanity, and coordinate-bounds issues. */}
      {!isPublicReadOnly && (
        <GeoCompliancePanel countryId={countryId} onRefresh={() => refetch()} />
      )}

      {/* Cities editor */}
      <SearchableList
        title="Cities"
        icon={<Building2 className="text-muted-foreground h-3.5 w-3.5" />}
        accent={{ badge: "bg-blue-600/20 text-blue-500", ring: "ring-blue-500/30" }}
        items={cities}
        searchKeys={["name", "type", "mayorName", "specialization"]}
        searchPlaceholder="Search cities, mayors, specializations…"
        emptyMessage="No cities yet. Use the map editor to place some."
        noMatchMessage="No cities match your search."
        renderItem={(city: any) => (
          <CityEditor city={city} countryId={countryId} onSaved={() => refetch()} />
        )}
      />

      {/* Subdivisions editor */}
      <SearchableList
        title="Subdivisions"
        icon={<MapPin className="text-muted-foreground h-3.5 w-3.5" />}
        accent={{ badge: "bg-emerald-600/20 text-emerald-500", ring: "ring-emerald-500/30" }}
        items={subdivisions}
        searchKeys={["name", "type", "governorName", "governmentType"]}
        searchPlaceholder="Search subdivisions, governors, government…"
        emptyMessage="No subdivisions yet. Generate some from the action buttons above."
        noMatchMessage="No subdivisions match your search."
        renderItem={(sub: any) => (
          <SubdivisionEditor subdivision={sub} countryId={countryId} onSaved={() => refetch()} />
        )}
      />

      {/* Points of Interest (read-only) */}
      <SearchableList
        title="Points of Interest"
        icon={<Pin className="text-muted-foreground h-3.5 w-3.5" />}
        accent={{ badge: "bg-amber-600/20 text-amber-500", ring: "ring-amber-500/30" }}
        items={pois}
        searchKeys={["name", "category", "description"]}
        searchPlaceholder="Search POIs, categories…"
        emptyMessage="No points of interest yet."
        noMatchMessage="No POIs match your search."
        renderItem={(poi: any) => (
          <PoiCard poi={poi} countryId={countryId} onApplied={() => refetch()} />
        )}
      />
    </div>
  );
}

interface CityEditorProps {
  city: any;
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
    <div className="border-border bg-card/30 rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-foreground text-xs font-semibold">{city.name}</div>
          <div className="text-muted-foreground text-[10px]">
            {city.isNationalCapital ? "★ National Capital" : city.type}
            {city.wikiPageTitle ? ` · wiki: ${city.wikiPageTitle}` : ""}
          </div>
        </div>
        {editing && !isPublicReadOnly ? (
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={upsert.isPending}
              className="rounded bg-emerald-600/20 px-2 py-0.5 text-[10px] font-medium text-emerald-500 hover:bg-emerald-600/30 disabled:opacity-50"
            >
              {upsert.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-muted-foreground text-[10px] underline"
            >
              Cancel
            </button>
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
              <button
                onClick={() => setEditing(true)}
                className="text-muted-foreground text-[10px] underline"
              >
                Edit
              </button>
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
        <div className="text-muted-foreground grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <span className="text-[9px] uppercase">Pop</span>
            <div className="text-foreground/80 text-xs">
              {(city.population ?? 0).toLocaleString()}
            </div>
          </div>
          <div>
            <span className="text-[9px] uppercase">GDP</span>
            <div className="text-foreground/80 text-xs">
              {Math.round(city.gdpContribution ?? 0).toLocaleString()}
            </div>
          </div>
          {city.mayorName && (
            <div className="col-span-2">
              <span className="text-[9px] uppercase">Mayor</span>
              <div className="text-foreground/80 text-xs">{city.mayorName}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SubdivisionEditorProps {
  subdivision: any;
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
    <div className="border-border bg-card/30 rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-foreground text-xs font-semibold">{subdivision.name}</div>
          <div className="text-muted-foreground text-[10px]">
            {subdivision.type}
            {subdivision.wikiPageTitle ? ` · wiki: ${subdivision.wikiPageTitle}` : ""}
          </div>
        </div>
        {editing && !isPublicReadOnly ? (
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={upsert.isPending}
              className="rounded bg-emerald-600/20 px-2 py-0.5 text-[10px] font-medium text-emerald-500 hover:bg-emerald-600/30 disabled:opacity-50"
            >
              {upsert.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-muted-foreground text-[10px] underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          !isPublicReadOnly && (
            <div className="flex items-center gap-1">
              <PopulateFromWikiButton
                countryId={countryId}
                kind="subdivision"
                id={subdivision.id}
                wikiTitle={subdivision.wikiPageTitle}
                onApplied={onSaved}
              />
              <button
                onClick={() => setEditing(true)}
                className="text-muted-foreground text-[10px] underline"
              >
                Edit
              </button>
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
        <div className="text-muted-foreground grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <span className="text-[9px] uppercase">Pop</span>
            <div className="text-foreground/80 text-xs">
              {(subdivision.population ?? 0).toLocaleString()}
            </div>
          </div>
          <div>
            <span className="text-[9px] uppercase">GDP</span>
            <div className="text-foreground/80 text-xs">
              {Math.round(subdivision.gdpContribution ?? 0).toLocaleString()}
            </div>
          </div>
          {subdivision.governorName && (
            <div className="col-span-2">
              <span className="text-[9px] uppercase">Governor</span>
              <div className="text-foreground/80 text-xs">{subdivision.governorName}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PoiCard({
  poi,
  countryId,
  onApplied,
}: {
  poi: any;
  countryId: string;
  onApplied?: () => void;
}) {
  const { isPublicReadOnly } = useCountryData();
  return (
    <div className="border-border bg-card/30 rounded-lg border p-3">
      <div className="mb-1 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <Tag className="text-muted-foreground h-3 w-3" />
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
      <div className="text-muted-foreground mb-1 flex items-center gap-1 text-[10px]">
        <span className="bg-accent/60 rounded px-1.5 py-0.5 font-mono uppercase">
          {poi.category}
        </span>
        {poi.wikiPageTitle ? <span>· wiki: {poi.wikiPageTitle}</span> : null}
      </div>
      {poi.description && (
        <p className="text-foreground/80 text-[11px] leading-snug">{poi.description}</p>
      )}
    </div>
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
    <div>
      <label className="text-muted-foreground text-[10px] font-medium uppercase">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-border bg-background mt-0.5 w-full rounded border px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { MapPin, Building2, Pin, Save, Loader2, Users, TrendingUp } from "lucide-react";
import { api } from "~/trpc/react";
import { useCountryData } from "./primitives";
import { SectionShell } from "./primitives";
import type { MyCountrySection } from "./MyCountrySidebarNav";

interface GeographyContentProps {
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  notifications?: Partial<Record<string, number>>;
}

/**
 * Geography attribute editor — MyCountry P-C.
 *
 * Per docs/systems/maps.md, the geographic data is split into two editing
 * surfaces: the map editor owns spatial (geometry, coordinates, placement);
 * this widget owns attributes (population, GDP contribution, governor/mayor
 * name, specialization, etc.).
 *
 * Uses the existing countryGeo tRPC router (upsertCity, upsertSubdivision,
 * upsertPoi, setCapital) — owner-gated via standardMutationCountryOwnerProcedure.
 */
export function GeographyContent({
  activeSection,
  onNavigate,
  notifications,
}: GeographyContentProps) {
  const { country } = useCountryData();
  const countryId = country?.id;

  const { data: bundle, isLoading, refetch } = api.countryGeo.getCountryGeoBundle.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  if (!countryId) {
    return (
      <SectionShell section="geography" activeSection={activeSection} onNavigate={onNavigate}>
        <p className="text-muted-foreground text-sm">No country context.</p>
      </SectionShell>
    );
  }

  if (isLoading) {
    return (
      <SectionShell section="geography" activeSection={activeSection} onNavigate={onNavigate}>
        <div className="space-y-2">
          <div className="bg-muted h-12 animate-pulse rounded" />
          <div className="bg-muted h-32 animate-pulse rounded" />
        </div>
      </SectionShell>
    );
  }

  if (!bundle) {
    return (
      <SectionShell section="geography" activeSection={activeSection} onNavigate={onNavigate}>
        <p className="text-muted-foreground text-sm">No geographic data found.</p>
      </SectionShell>
    );
  }

  const { cities, subdivisions, pois } = bundle;

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="border-border bg-card/40 rounded-lg border p-2">
          <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] uppercase">
            <Building2 className="h-3 w-3" />
            Cities
          </div>
          <div className="text-foreground text-lg font-semibold">{cities.length}</div>
        </div>
        <div className="border-border bg-card/40 rounded-lg border p-2">
          <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] uppercase">
            <MapPin className="h-3 w-3" />
            Subdivisions
          </div>
          <div className="text-foreground text-lg font-semibold">{subdivisions.length}</div>
        </div>
        <div className="border-border bg-card/40 rounded-lg border p-2">
          <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] uppercase">
            <Pin className="h-3 w-3" />
            POIs
          </div>
          <div className="text-foreground text-lg font-semibold">{pois.length}</div>
        </div>
      </div>

      {/* Cities editor */}
      {cities.length > 0 && (
        <div>
          <h3 className="text-foreground mb-2 text-sm font-semibold">Cities</h3>
          <div className="space-y-2">
            {cities.map((city: any) => (
              <CityEditor
                key={city.id}
                city={city}
                countryId={countryId}
                onSaved={() => refetch()}
              />
            ))}
          </div>
        </div>
      )}

      {/* Subdivisions editor */}
      {subdivisions.length > 0 && (
        <div>
          <h3 className="text-foreground mb-2 text-sm font-semibold">Subdivisions</h3>
          <div className="space-y-2">
            {subdivisions.map((sub: any) => (
              <SubdivisionEditor
                key={sub.id}
                subdivision={sub}
                countryId={countryId}
                onSaved={() => refetch()}
              />
            ))}
          </div>
        </div>
      )}

      {cities.length === 0 && subdivisions.length === 0 && (
        <div className="text-muted-foreground py-6 text-center text-sm">
          No cities or subdivisions yet. Use the map editor to place some.
        </div>
      )}
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
          </div>
        </div>
        {editing ? (
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={upsert.isPending}
              className="rounded bg-emerald-600/20 px-2 py-0.5 text-[10px] font-medium text-emerald-500 hover:bg-emerald-600/30 disabled:opacity-50"
            >
              {upsert.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-muted-foreground text-[10px] underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-muted-foreground text-[10px] underline"
          >
            Edit
          </button>
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
          <div className="text-muted-foreground text-[10px]">{subdivision.type}</div>
        </div>
        {editing ? (
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={upsert.isPending}
              className="rounded bg-emerald-600/20 px-2 py-0.5 text-[10px] font-medium text-emerald-500 hover:bg-emerald-600/30 disabled:opacity-50"
            >
              {upsert.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-muted-foreground text-[10px] underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-muted-foreground text-[10px] underline"
          >
            Edit
          </button>
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
      <label className="text-muted-foreground text-[10px] font-medium uppercase">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-border bg-background mt-0.5 w-full rounded border px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

"use client";

/**
 * CountryFeatureSheet — click-to-manage dialog for a map feature (City / Subdivision).
 *
 * Part of the Maps↔MyCountry tier-0 integration (Phase E, §7). Clicking a city or
 * subdivision on the embedded `<CountryMapEmbed onFeatureClick>` opens this sheet,
 * which surfaces the *attribute half* of the one canonical geo record:
 *   - Owners (`useCanEdit().canEdit`) get an inline edit form saved via
 *     `countryGeo.upsertCity` / `countryGeo.upsertSubdivision`.
 *   - Non-owners see a read-only summary.
 * Saving invalidates `getCountryGeoBundle` so the map + MyCountry stay in sync.
 */

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Building2, Landmark, Loader2, MapPin, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { useCanEdit } from "~/context/MyCountryEditModeContext";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import { toTitleCase } from "~/lib/utils";
import type { CountryMapFeature } from "~/components/maps/widgets/CountryMapEmbed";

interface CountryFeatureSheetProps {
  countryId: string;
  /** The selected feature, or null when the sheet is closed. */
  feature: CountryMapFeature | null;
  onClose: () => void;
}

// ── City edit form state ──
interface CityFormState {
  name: string;
  population: string;
  economyOutput: string;
  gdpContribution: string;
  specialization: string;
  infrastructureLevel: string;
  isPort: boolean;
  mayorName: string;
}

// ── Subdivision edit form state ──
interface SubdivisionFormState {
  name: string;
  population: string;
  gdpContribution: string;
  budgetShare: string;
  governorName: string;
  governmentType: string;
}

function numOrUndef(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function fmt(v: number | null | undefined, suffix = ""): string {
  if (v === null || v === undefined) return "—";
  return `${Number(v).toLocaleString()}${suffix}`;
}

export function CountryFeatureSheet({ countryId, feature, onClose }: CountryFeatureSheetProps) {
  const { canEdit } = useCanEdit();
  const notify = useNotify();
  const utils = api.useUtils();

  const { data: bundle, isLoading } = api.countryGeo.getCountryGeoBundle.useQuery(
    { countryId },
    { enabled: !!feature }
  );

  const selectedCity = useMemo(() => {
    if (feature?.kind !== "city") return null;
    return (bundle?.cities ?? []).find((c: any) => c.id === feature.id) ?? null;
  }, [bundle, feature]);

  const selectedSubdivision = useMemo(() => {
    if (feature?.kind !== "subdivision") return null;
    return (bundle?.subdivisions ?? []).find((s: any) => s.id === feature.id) ?? null;
  }, [bundle, feature]);

  const [cityForm, setCityForm] = useState<CityFormState | null>(null);
  const [subForm, setSubForm] = useState<SubdivisionFormState | null>(null);

  // Hydrate form state from the selected record
  useEffect(() => {
    if (selectedCity) {
      setCityForm({
        name: selectedCity.name ?? "",
        population: selectedCity.population != null ? String(selectedCity.population) : "",
        economyOutput: selectedCity.economyOutput != null ? String(selectedCity.economyOutput) : "",
        gdpContribution:
          selectedCity.gdpContribution != null ? String(selectedCity.gdpContribution) : "",
        specialization: selectedCity.specialization ?? "",
        infrastructureLevel:
          selectedCity.infrastructureLevel != null ? String(selectedCity.infrastructureLevel) : "",
        isPort: !!selectedCity.isPort,
        mayorName: selectedCity.mayorName ?? "",
      });
    } else {
      setCityForm(null);
    }
  }, [selectedCity]);

  useEffect(() => {
    if (selectedSubdivision) {
      setSubForm({
        name: selectedSubdivision.name ?? "",
        population:
          selectedSubdivision.population != null ? String(selectedSubdivision.population) : "",
        gdpContribution:
          selectedSubdivision.gdpContribution != null
            ? String(selectedSubdivision.gdpContribution)
            : "",
        budgetShare:
          selectedSubdivision.budgetShare != null ? String(selectedSubdivision.budgetShare) : "",
        governorName: selectedSubdivision.governorName ?? "",
        governmentType: selectedSubdivision.governmentType ?? "",
      });
    } else {
      setSubForm(null);
    }
  }, [selectedSubdivision]);

  const invalidateBundle = () => utils.countryGeo.getCountryGeoBundle.invalidate({ countryId });

  const upsertCity = api.countryGeo.upsertCity.useMutation({
    onSuccess: () => {
      notify.success("City updated", `${cityForm?.name ?? "City"} saved`);
      void invalidateBundle();
      onClose();
    },
    onError: (err) => notify.error("Save failed", err.message),
  });

  const upsertSubdivision = api.countryGeo.upsertSubdivision.useMutation({
    onSuccess: () => {
      notify.success("Subdivision updated", `${subForm?.name ?? "Subdivision"} saved`);
      void invalidateBundle();
      onClose();
    },
    onError: (err) => notify.error("Save failed", err.message),
  });

  const isSaving = upsertCity.isPending || upsertSubdivision.isPending;

  const handleSaveCity = () => {
    if (!selectedCity || !cityForm) return;
    if (!cityForm.name.trim()) {
      notify.warning("Name required", "A city must have a name");
      return;
    }
    upsertCity.mutate({
      countryId,
      id: selectedCity.id,
      name: cityForm.name.trim(),
      type: selectedCity.type ?? "city",
      population: numOrUndef(cityForm.population),
      economyOutput: numOrUndef(cityForm.economyOutput),
      gdpContribution: numOrUndef(cityForm.gdpContribution),
      specialization: cityForm.specialization.trim() || undefined,
      infrastructureLevel: numOrUndef(cityForm.infrastructureLevel),
      isPort: cityForm.isPort,
      mayorName: cityForm.mayorName.trim() || undefined,
    });
  };

  const handleSaveSubdivision = () => {
    if (!selectedSubdivision || !subForm) return;
    if (!subForm.name.trim()) {
      notify.warning("Name required", "A subdivision must have a name");
      return;
    }
    upsertSubdivision.mutate({
      countryId,
      id: selectedSubdivision.id,
      name: subForm.name.trim(),
      type: selectedSubdivision.type ?? "province",
      level: selectedSubdivision.level ?? 1,
      population: numOrUndef(subForm.population),
      gdpContribution: numOrUndef(subForm.gdpContribution),
      budgetShare: numOrUndef(subForm.budgetShare),
      governorName: subForm.governorName.trim() || undefined,
      governmentType: subForm.governmentType.trim() || undefined,
    });
  };

  const isCity = feature?.kind === "city";
  const Icon = isCity ? Building2 : Landmark;
  const title = isCity ? selectedCity?.name : selectedSubdivision?.name;

  return (
    <Dialog open={!!feature} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="text-muted-foreground h-4 w-4" />
            {title ?? (isCity ? "City" : "Subdivision")}
          </DialogTitle>
          <DialogDescription>
            {canEdit
              ? "Edit this feature's attributes. Spatial changes are made in the map editor."
              : "Feature details (read-only)."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : isCity && selectedCity ? (
          canEdit && cityForm ? (
            <CityEditForm
              form={cityForm}
              setForm={setCityForm}
              isCapital={!!selectedCity.isNationalCapital}
            />
          ) : (
            <CityReadOnly city={selectedCity} />
          )
        ) : !isCity && selectedSubdivision ? (
          canEdit && subForm ? (
            <SubdivisionEditForm form={subForm} setForm={setSubForm} />
          ) : (
            <SubdivisionReadOnly subdivision={selectedSubdivision} />
          )
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-sm">
            <MapPin className="h-6 w-6" />
            Feature not found
          </div>
        )}

        {canEdit && ((isCity && selectedCity) || (!isCity && selectedSubdivision)) && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={isCity ? handleSaveCity : handleSaveSubdivision} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────── City ────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {children}
    </div>
  );
}

function CityEditForm({
  form,
  setForm,
  isCapital,
}: {
  form: CityFormState;
  setForm: React.Dispatch<React.SetStateAction<CityFormState | null>>;
  isCapital: boolean;
}) {
  const set = <K extends keyof CityFormState>(key: K, value: CityFormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <div className="grid gap-3">
      {isCapital && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
          <MapPin className="h-3.5 w-3.5" /> National capital
        </div>
      )}
      <Field label="Name">
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Population">
          <Input
            type="number"
            value={form.population}
            onChange={(e) => set("population", e.target.value)}
          />
        </Field>
        <Field label="Infrastructure (0-10)">
          <Input
            type="number"
            min={0}
            max={10}
            value={form.infrastructureLevel}
            onChange={(e) => set("infrastructureLevel", e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Economy output">
          <Input
            type="number"
            value={form.economyOutput}
            onChange={(e) => set("economyOutput", e.target.value)}
          />
        </Field>
        <Field label="GDP contribution">
          <Input
            type="number"
            value={form.gdpContribution}
            onChange={(e) => set("gdpContribution", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Specialization">
        <Input
          value={form.specialization}
          onChange={(e) => set("specialization", e.target.value)}
          placeholder="e.g. Finance, Manufacturing"
        />
      </Field>
      <Field label="Mayor">
        <Input value={form.mayorName} onChange={(e) => set("mayorName", e.target.value)} />
      </Field>
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground text-xs">Port city</Label>
        <Switch checked={form.isPort} onCheckedChange={(v) => set("isPort", v)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-border/40 flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

function CityReadOnly({ city }: { city: any }) {
  return (
    <div className="grid gap-0.5">
      {city.isNationalCapital && <Stat label="Role" value="National capital" />}
      <Stat label="Population" value={fmt(city.population)} />
      <Stat label="Economy output" value={fmt(city.economyOutput)} />
      <Stat label="GDP contribution" value={fmt(city.gdpContribution)} />
      <Stat label="Specialization" value={city.specialization || "—"} />
      <Stat
        label="Infrastructure"
        value={city.infrastructureLevel != null ? `${city.infrastructureLevel}/10` : "—"}
      />
      <Stat label="Port" value={city.isPort ? "Yes" : "No"} />
      <Stat label="Mayor" value={city.mayorName || "—"} />
    </div>
  );
}

// ──────────────────────────── Subdivision ────────────────────────────

function SubdivisionEditForm({
  form,
  setForm,
}: {
  form: SubdivisionFormState;
  setForm: React.Dispatch<React.SetStateAction<SubdivisionFormState | null>>;
}) {
  const set = <K extends keyof SubdivisionFormState>(key: K, value: SubdivisionFormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <div className="grid gap-3">
      <Field label="Name">
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Population">
          <Input
            type="number"
            value={form.population}
            onChange={(e) => set("population", e.target.value)}
          />
        </Field>
        <Field label="GDP contribution">
          <Input
            type="number"
            value={form.gdpContribution}
            onChange={(e) => set("gdpContribution", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Budget share (%)">
        <Input
          type="number"
          min={0}
          max={100}
          value={form.budgetShare}
          onChange={(e) => set("budgetShare", e.target.value)}
        />
      </Field>
      <Field label="Governor">
        <Input value={form.governorName} onChange={(e) => set("governorName", e.target.value)} />
      </Field>
      <Field label="Government type">
        <Input
          value={form.governmentType}
          onChange={(e) => set("governmentType", e.target.value)}
          placeholder="e.g. Province, Federal state"
        />
      </Field>
    </div>
  );
}

function SubdivisionReadOnly({ subdivision }: { subdivision: any }) {
  return (
    <div className="grid gap-0.5">
      <Stat label="Type" value={subdivision.type || "—"} />
      <Stat label="Population" value={fmt(subdivision.population)} />
      <Stat label="GDP contribution" value={fmt(subdivision.gdpContribution)} />
      <Stat
        label="Budget share"
        value={subdivision.budgetShare != null ? `${subdivision.budgetShare}%` : "—"}
      />
      <Stat label="Governor" value={subdivision.governorName || "—"} />
      <Stat label="Government" value={subdivision.governmentType ? toTitleCase(subdivision.governmentType) : "—"} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  COUNTRY_GROWTH_RANGES,
  countryGrowthSchema,
  type CountryGrowthField,
} from "~/lib/countries/country-growth";
import { growthFromPercent, growthPercent } from "~/lib/realms/nation-growth-defaults";
import { ECONOMIC_TIER_INFO } from "~/lib/tier-utils";
import type { EconomicTier } from "~/types/ixstats";

type Draft = Record<CountryGrowthField, string>;
type StoredGrowth = Record<CountryGrowthField, number> & { economicTier: string };

/** Rates are edited as percents; the local growth factor as a multiplier. */
const FIELDS: ReadonlyArray<{ key: CountryGrowthField; label: string; percent: boolean }> = [
  { key: "populationGrowthRate", label: "Population growth (%)", percent: true },
  { key: "adjustedGdpGrowth", label: "Adjusted GDP growth (%)", percent: true },
  { key: "maxGdpGrowthRate", label: "Max GDP growth (%)", percent: true },
  { key: "localGrowthFactor", label: "Local growth factor (x)", percent: false },
];

const show = (value: number, percent: boolean) =>
  percent ? growthPercent(value) : String(Number(value.toPrecision(10)));

const read = (text: string, percent: boolean) =>
  percent ? growthFromPercent(text) : text.trim() === "" ? NaN : Number(text);

function rangeHint(key: CountryGrowthField, percent: boolean) {
  const range = COUNTRY_GROWTH_RANGES[key];
  return `${show(range.min, percent)} to ${show(range.max, percent)}`;
}

/**
 * One country's growth fields (any realm), saved through the audited admin procedure. The stat progression
 * projects from the new rates on its next run.
 */
export function CountryGrowthEditor({ countryId }: { countryId: string }) {
  const { data, isLoading } = api.admin.getCountryDetail.useQuery(
    { countryId },
    { refetchOnWindowFocus: false }
  );
  if (isLoading) return <p className="text-label-secondary text-footnote">Loading growth…</p>;
  if (!data) return null;
  return (
    <GrowthForm key={String(data.country.updatedAt)} countryId={countryId} stored={data.country} />
  );
}

function GrowthForm({ countryId, stored }: { countryId: string; stored: StoredGrowth }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [draft, setDraft] = useState<Draft>(
    () => Object.fromEntries(FIELDS.map((f) => [f.key, show(stored[f.key], f.percent)])) as Draft
  );
  const parsed = countryGrowthSchema.safeParse(
    Object.fromEntries(FIELDS.map((f) => [f.key, read(draft[f.key], f.percent)]))
  );
  const save = api.admin.updateCountryGrowth.useMutation({
    onSuccess: (result) =>
      result.updated
        ? notify.success("Growth saved", "Recorded in the audit log.")
        : notify.info("Nothing changed", "The growth fields already had these values."),
    onError: (e) => notify.error("Could not save growth", e.message),
    onSettled: () => {
      void utils.admin.getCountryDetail.invalidate({ countryId });
      void utils.countries.getByIdWithEconomicData.invalidate({ id: countryId });
    },
  });
  const tierCap = ECONOMIC_TIER_INFO[stored.economicTier as EconomicTier]?.maxGrowth;

  return (
    <div className="border-separator bg-fill-4 rounded-row flex flex-col gap-4 border p-4">
      <div className="flex flex-col gap-1">
        <h4 className="text-label text-headline">Growth settings</h4>
        <p className="text-label-secondary text-footnote">
          Stored on the country and used by every projection.
          {tierCap !== undefined && ` Its tier caps GDP growth at ${growthPercent(tierCap)}%.`}
        </p>
      </div>
      {FIELDS.map((field) => (
        <div key={field.key} className="flex flex-col gap-1">
          <Label htmlFor={`growth-${field.key}`}>{field.label}</Label>
          <Input
            id={`growth-${field.key}`}
            type="number"
            step="any"
            inputMode="decimal"
            value={draft[field.key]}
            onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
          />
          <span className="text-label-secondary text-footnote">
            {rangeHint(field.key, field.percent)}
          </span>
        </div>
      ))}
      {!parsed.success && (
        <p role="alert" className="text-red text-footnote">
          Every field needs a number within its range.
        </p>
      )}
      <Button
        size="sm"
        disabled={save.isPending || !parsed.success}
        onClick={() => parsed.success && save.mutate({ countryId, growth: parsed.data })}
      >
        {save.isPending ? "Saving…" : "Save growth"}
      </Button>
    </div>
  );
}

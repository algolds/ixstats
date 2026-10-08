"use client";

import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  ADJUSTED_GDP_GROWTH_RANGE,
  ECONOMIC_TIERS,
  growthFromPercent,
  growthPercent,
  nationGrowthTableSchema,
  POPULATION_GROWTH_RANGE,
  type NationGrowth,
  type NationGrowthTable,
} from "~/lib/realms/nation-growth-defaults";
import { ECONOMIC_TIER_INFO } from "~/lib/tier-utils";
import type { EconomicTier } from "~/types/ixstats";
import { ApplyDefaultsSection } from "./ApplyDefaultsSection";

type NationDefaultsView = RouterOutputs["realms"]["nationDefaults"]["get"];
type Draft = Record<EconomicTier, Record<keyof NationGrowth, string>>;

const RATE_COLUMNS: ReadonlyArray<{ key: keyof NationGrowth; label: string }> = [
  { key: "populationGrowthRate", label: "Population growth" },
  { key: "adjustedGdpGrowth", label: "Adjusted GDP growth" },
];

const rangeText = (range: { min: number; max: number }) =>
  `${growthPercent(range.min)} to ${growthPercent(range.max)}`;
const RANGE_TEXT = {
  population: rangeText(POPULATION_GROWTH_RANGE),
  adjusted: rangeText(ADJUSTED_GDP_GROWTH_RANGE),
};

function toDraft(table: NationGrowthTable): Draft {
  return Object.fromEntries(
    ECONOMIC_TIERS.map((tier) => [
      tier,
      {
        populationGrowthRate: growthPercent(table[tier].populationGrowthRate),
        adjustedGdpGrowth: growthPercent(table[tier].adjustedGdpGrowth),
      },
    ])
  ) as Draft;
}

function fromDraft(draft: Draft) {
  return nationGrowthTableSchema.safeParse(
    Object.fromEntries(
      ECONOMIC_TIERS.map((tier) => [
        tier,
        {
          populationGrowthRate: growthFromPercent(draft[tier].populationGrowthRate),
          adjustedGdpGrowth: growthFromPercent(draft[tier].adjustedGdpGrowth),
        },
      ])
    )
  );
}

/** A realm's nation growth defaults: the per-tier table, then applying it to the realm's unclaimed nations. */
export function NationDefaultsPanel({ realmId }: { realmId: string }) {
  const {
    data: view,
    isLoading,
    error,
  } = api.realms.nationDefaults.get.useQuery({ realmId }, { retry: false });
  if (isLoading) return <p className="text-label-secondary text-body">Loading nation defaults…</p>;
  if (!view)
    return <p className="text-label-secondary text-body">{error?.message ?? "Not available."}</p>;
  return <NationDefaultsEditor key={JSON.stringify(view.table)} view={view} />;
}

function NationDefaultsEditor({ view }: { view: NationDefaultsView }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const realmId = view.realm.id;
  const saved = toDraft(view.table);
  const [draft, setDraft] = useState<Draft>(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const parsed = fromDraft(draft);
  const save = api.realms.nationDefaults.save.useMutation({
    onSuccess: ({ custom }) =>
      notify.success(
        "Nation defaults saved",
        custom ? `${view.realm.name} has its own growth table.` : "Back to IxStats defaults."
      ),
    onError: (e) => notify.error("Could not save the nation defaults", e.message),
    onSettled: () => void utils.realms.nationDefaults.get.invalidate({ realmId }),
  });
  const setRate = (tier: EconomicTier, key: keyof NationGrowth, value: string) =>
    setDraft((prev) => ({ ...prev, [tier]: { ...prev[tier], [key]: value } }));

  return (
    <div className="flex flex-col gap-6">
      <section className="border-separator bg-surface rounded-card flex flex-col gap-4 border p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-label text-headline">Growth by economic tier</h3>
            <p className="text-label-secondary text-footnote">
              {view.custom
                ? `${view.realm.name} uses its own table.`
                : `${view.realm.name} follows the IxStats defaults (IxWorld's medians).`}{" "}
              Nations its source sync or claims create start with the rates for their tier. GDP
              growth is capped by the IxStats tier rule. Rates are percent a year.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={save.isPending || !view.custom}
              onClick={() => save.mutate({ realmId, table: null })}
            >
              Reset to IxStats defaults
            </Button>
            <Button
              size="sm"
              disabled={save.isPending || !dirty || !parsed.success}
              onClick={() => parsed.success && save.mutate({ realmId, table: parsed.data })}
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tier</TableHead>
              {RATE_COLUMNS.map((column) => (
                <TableHead key={column.key} numeric>
                  {column.label} (%)
                </TableHead>
              ))}
              <TableHead numeric>Max GDP growth (%)</TableHead>
              <TableHead numeric>IxStats default (%)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ECONOMIC_TIERS.map((tier) => (
              <TableRow key={tier}>
                <TableCell>{tier}</TableCell>
                {RATE_COLUMNS.map((column) => (
                  <TableCell key={column.key} numeric>
                    <Input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      aria-label={`${column.label}, ${tier}`}
                      className="ml-auto w-28 text-right"
                      value={draft[tier][column.key]}
                      onChange={(e) => setRate(tier, column.key, e.target.value)}
                    />
                  </TableCell>
                ))}
                <TableCell numeric>{growthPercent(ECONOMIC_TIER_INFO[tier].maxGrowth)}</TableCell>
                <TableCell numeric className="text-label-secondary">
                  {growthPercent(view.systemDefaults[tier].populationGrowthRate)} /{" "}
                  {growthPercent(view.systemDefaults[tier].adjustedGdpGrowth)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!parsed.success && (
          <p role="alert" className="text-red text-footnote">
            Every rate needs a number: population growth from {RANGE_TEXT.population}, adjusted GDP
            growth from {RANGE_TEXT.adjusted}.
          </p>
        )}
      </section>

      <ApplyDefaultsSection
        realmId={realmId}
        nations={view.nations}
        unclaimed={view.unclaimed}
        unsaved={dirty}
      />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Globe, Undo } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Slider } from "~/components/ui/slider";
import { Stat } from "~/components/ui/stat";
import { RateInput } from "~/components/mycountry/shell/RateInput";
import {
  exciseWithSectorTariff,
  readSectorTariffs,
} from "~/components/mycountry/shell/trade-commerce/sector-tariffs";
import {
  ACCENT_BG,
  sectorsFromRecorded,
  type CustomSector,
} from "~/components/mycountry/shell/trade-commerce/trade-commerce-types";
import { useNotify } from "~/hooks/useNotify";
import { finiteOrNull, savedTariffRate } from "~/lib/economy/country-relations";
import { parseSectorBreakdown } from "~/lib/economy/sector-breakdown";
import { cn } from "~/lib/utils/cn";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import { api } from "~/trpc/react";
import { EditorSection, SaveButton } from "./EditorSection";
import { useEditor, useReportDirty, type EditorState } from "./editor-context";

export function TariffsSection({ state }: { state: EditorState }) {
  const { countryId, applySaved } = useEditor();
  const notify = useNotify();
  const utils = api.useUtils();

  const baseTariff = savedTariffRate(state.fiscalSystem?.exciseTaxRates);
  const taxEfficiency = finiteOrNull(state.fiscalSystem?.taxEfficiency);
  const recordedSectors = useMemo(
    () =>
      sectorsFromRecorded(
        parseSectorBreakdown(state.economicProfile?.sectorBreakdown),
        baseTariff ?? 0
      ),
    [state.economicProfile?.sectorBreakdown, baseTariff]
  );
  const savedSectorTariffs = useMemo(
    () => readSectorTariffs(state.fiscalSystem?.exciseTaxRates),
    [state.fiscalSystem?.exciseTaxRates]
  );

  // `null` in draft means explicitly reset back to the base import tariff.
  const [draft, setDraft] = useState<Record<string, number | null>>({});

  const rateOf = (sector: CustomSector): number => {
    const edited = draft[sector.key];
    if (edited === null) return sector.defaultTariff;
    if (edited !== undefined) return edited;
    return savedSectorTariffs[sector.key] ?? sector.defaultTariff;
  };

  const changedSectors = recordedSectors.filter((sector) => {
    if (draft[sector.key] === undefined) return false;
    const savedVal = savedSectorTariffs[sector.key] ?? null;
    return draft[sector.key] !== savedVal;
  });
  const dirty = changedSectors.length > 0;
  useReportDirty("tariffs", "Sector tariffs", dirty);

  const gdp = finiteOrNull(state.currentTotalGdp);
  const importsPct = finiteOrNull(state.economicProfile?.importsGDPPercent);
  const totalImports =
    gdp != null && gdp > 0 && importsPct != null ? (gdp * importsPct) / 100 : null;

  let weightedTariff = 0;
  let totalShare = 0;
  for (const sector of recordedSectors) {
    weightedTariff += rateOf(sector) * sector.defaultShare;
    totalShare += sector.defaultShare;
  }
  const averageTariff = totalShare > 0 ? weightedTariff / totalShare : null;
  const plannedYield =
    averageTariff != null && totalImports != null
      ? totalImports * (averageTariff / 100) * (taxEfficiency ?? 1)
      : null;

  const mutation = api.economics.updateFiscalSystem.useMutation({
    onSuccess: (_result, variables) => {
      applySaved((current) => ({
        ...current,
        fiscalSystem: {
          corporateTaxRates: current.fiscalSystem?.corporateTaxRates ?? null,
          personalIncomeTaxRates: current.fiscalSystem?.personalIncomeTaxRates ?? null,
          salesTaxRate: current.fiscalSystem?.salesTaxRate ?? null,
          exciseTaxRates: variables.exciseTaxRates ?? current.fiscalSystem?.exciseTaxRates ?? null,
          wealthTaxRate: current.fiscalSystem?.wealthTaxRate ?? null,
          taxEfficiency: current.fiscalSystem?.taxEfficiency ?? null,
        },
      }));
      setDraft({});
      void utils.countries.invalidate();
      void utils.mycountry.getCountryDashboard.invalidate();
      notify.success("Saved sector tariffs");
    },
    onError: (err: { message?: string }) => {
      notify.error("Could not save sector tariffs", err?.message ?? "Unknown error");
    },
  });

  const handleSave = () => {
    let nextExcise = state.fiscalSystem?.exciseTaxRates ?? null;
    for (const sector of changedSectors) {
      nextExcise = exciseWithSectorTariff(nextExcise, sector.key, draft[sector.key] ?? null);
    }
    if (nextExcise != null) {
      mutation.mutate({ countryId, exciseTaxRates: nextExcise });
    }
  };

  return (
    <EditorSection
      id="tariffs"
      title="Sector tariffs"
      description="Tune custom tariff schedules across recorded economic sectors, weighted by each sector's share of GDP."
      icon={<Globe />}
    >
      <Card variant="well" content="data" padding="md">
        <div className="sm:divide-separator/60 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-0 sm:divide-x">
          <Stat
            size="sm"
            label="Base import tariff"
            value={baseTariff != null ? `${baseTariff.toFixed(1)}%` : "Not set"}
            hint="Default starting rate for sectors"
            className="sm:pr-4"
          />
          <Stat
            size="sm"
            label="Weighted average tariff"
            value={averageTariff != null ? `${averageTariff.toFixed(1)}%` : "Not recorded"}
            hint="Weighted by recorded sector share"
            className="sm:px-4"
          />
          <Stat
            size="sm"
            label="Planned tariff yield"
            value={
              plannedYield != null ? `${formatCompactCurrency(plannedYield)} / yr` : "Not recorded"
            }
            hint={totalImports == null ? "Requires recorded imports share" : "On recorded imports"}
            className="sm:pl-4"
          />
        </div>
      </Card>

      {recordedSectors.length === 0 ? (
        <Card variant="well" padding="md">
          <EmptyState
            compact
            icon={<Globe />}
            title="No economic sectors recorded yet"
            message="Declare an economic Directive in MyCountry to establish sector shares, then tune sector tariffs here."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {recordedSectors.map((sector) => {
              const current = rateOf(sector);
              const hasOverride =
                draft[sector.key] !== undefined
                  ? draft[sector.key] !== null
                  : savedSectorTariffs[sector.key] !== undefined;
              return (
                <Card key={sector.id} variant="well" padding="md" className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn("size-2.5 shrink-0 rounded-full", ACCENT_BG[sector.accent])}
                      />
                      <span className="text-label text-subhead truncate font-medium capitalize">
                        {sector.label}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {hasOverride && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDraft((prev) => ({ ...prev, [sector.key]: null }))}
                          aria-label={`Reset ${sector.label} tariff to base`}
                          title="Reset to base import tariff"
                        >
                          <Undo className="size-3.5" />
                        </Button>
                      )}
                      <span className="text-label text-title-3 tabular-nums">
                        {current.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Slider
                      min={sector.min}
                      max={sector.max}
                      step={sector.step}
                      value={[current]}
                      onValueChange={([v]) =>
                        v !== undefined && setDraft((prev) => ({ ...prev, [sector.key]: v }))
                      }
                      aria-label={`${sector.label} tariff rate`}
                      className="w-full"
                    />
                    <RateInput
                      value={current}
                      min={sector.min}
                      max={sector.max}
                      step={sector.step}
                      onCommit={(v) => setDraft((prev) => ({ ...prev, [sector.key]: v }))}
                      aria-label={`${sector.label} tariff rate, percent`}
                    />
                  </div>

                  <div className="text-footnote flex items-center justify-between gap-2">
                    <span className="text-label-secondary">Share of GDP</span>
                    <span className="text-label font-medium tabular-nums">
                      {sector.defaultShare.toFixed(1)}%
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>

          <SaveButton
            section="tariffs"
            label="Save sector tariffs"
            dirty={dirty}
            invalid={false}
            pending={mutation.isPending}
            onSave={handleSave}
            onReset={() => setDraft({})}
          />
        </>
      )}
    </EditorSection>
  );
}

"use client";

import Link from "next/link";
import { ArrowUpRight, Coins, Globe as Globe2 } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import {
  economicRelationsOf,
  finiteOrNull,
  savedTariffRate,
} from "~/lib/economy/country-relations";
import { nationalRevenue, REVENUE_BASIS_NOTE } from "~/lib/economy/national-revenue";
import { parseSectorBreakdown } from "~/lib/economy/sector-breakdown";
import { ACCENT_BG, readSavedRates, TAX_CHANNELS } from "~/lib/economy/tax-channels";
import { editorHref } from "~/lib/mycountry/routes";
import { cn } from "~/lib/utils/cn";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import { api } from "~/trpc/react";
import { TaxRevenueProjections } from "./fiscal/TaxRevenueProjections";
import { SheetSection } from "./SheetSection";
import { readSectorTariffs } from "./trade-commerce/sector-tariffs";
import {
  ACCENT_BG as SECTOR_ACCENT_BG,
  sectorsFromRecorded,
} from "./trade-commerce/trade-commerce-types";
import { TradeImpactSummary } from "./trade-commerce/TradeImpactSummary";
import { TradePartnersManager } from "./trade-commerce/TradePartnersManager";

export function TaxesTelemetryView() {
  const { country } = useCountryData();
  const { fiscalSystem } = economicRelationsOf(country);
  const saved = readSavedRates(fiscalSystem);
  const revenue = nationalRevenue(country);

  return (
    <div className="space-y-4">
      <SheetSection
        title="National tax rates"
        icon={Coins}
        accessory={
          <Button asChild variant="outline" size="sm">
            <Link href={editorHref("taxes")}>
              Configure tax rates
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-label-secondary text-footnote">
              {revenue.basis
                ? REVENUE_BASIS_NOTE[revenue.basis]
                : "No national tax rates configured yet."}
            </p>
            <p className="text-label text-title-3 tabular-nums">
              {revenue.total != null ? `${formatCompactCurrency(revenue.total)} / yr` : "Not set"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TAX_CHANNELS.map((ch) => {
              const rate = revenue.rates[ch.key] ?? null;
              const yieldVal = revenue.yields.byChannel[ch.key] ?? null;
              const bracketed = saved[ch.key]?.bracketed ?? false;
              return (
                <Card key={ch.key} variant="well" padding="sm" className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn("size-2 shrink-0 rounded-full", ACCENT_BG[ch.accent])}
                      />
                      <span className="text-label text-footnote truncate font-medium">
                        {ch.label}
                      </span>
                    </div>
                    <span className="text-label text-subhead shrink-0 font-semibold tabular-nums">
                      {rate != null ? (
                        <>
                          {bracketed && (
                            <span className="text-label-secondary text-footnote mr-1 font-normal">
                              Top
                            </span>
                          )}
                          {rate.toFixed(1)}%
                        </>
                      ) : (
                        <span className="text-label-secondary text-footnote font-normal">
                          Not set
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="text-label-secondary text-footnote tabular-nums">
                    {yieldVal != null
                      ? `${formatCompactCurrency(yieldVal)} / yr`
                      : "No yield projected"}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </SheetSection>

      <TaxRevenueProjections yields={revenue.yields} />
    </div>
  );
}

export function TradeTelemetryView({ countryId }: { countryId: string }) {
  const { country } = useCountryData();
  const { data: diplomaticRelations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const { economicProfile: profile, fiscalSystem: fiscal } = economicRelationsOf(country);
  const baseTariff = savedTariffRate(fiscal?.exciseTaxRates);
  const taxEfficiency = finiteOrNull(fiscal?.taxEfficiency);
  const recordedSectors = sectorsFromRecorded(
    parseSectorBreakdown(profile?.sectorBreakdown),
    baseTariff ?? 0
  );
  const savedSectorTariffs = readSectorTariffs(fiscal?.exciseTaxRates);

  const gdp = finiteOrNull(country?.currentTotalGdp);
  const exportsPct = finiteOrNull(profile?.exportsGDPPercent);
  const importsPct = finiteOrNull(profile?.importsGDPPercent);
  const totalExports =
    gdp != null && gdp > 0 && exportsPct != null ? (gdp * exportsPct) / 100 : null;
  const totalImports =
    gdp != null && gdp > 0 && importsPct != null ? (gdp * importsPct) / 100 : null;
  const tradeBalance =
    totalExports != null && totalImports != null ? totalExports - totalImports : null;

  let weightedTariff = 0;
  let totalSectorShare = 0;
  for (const sector of recordedSectors) {
    const rate = savedSectorTariffs[sector.key] ?? sector.defaultTariff;
    weightedTariff += rate * sector.defaultShare;
    totalSectorShare += sector.defaultShare;
  }
  const plannedAverageTariff = totalSectorShare > 0 ? weightedTariff / totalSectorShare : null;
  const plannedTariffRevenue =
    plannedAverageTariff != null && totalImports != null
      ? totalImports * (plannedAverageTariff / 100) * (taxEfficiency ?? 1)
      : null;

  const tradePartners = (diplomaticRelations ?? []).map((rel) => ({
    countryId: rel.targetCountryId || rel.id,
    countryName: rel.targetCountryName || rel.targetCountry || "Diplomatic Partner",
    flagUrl: rel.targetCountryFlag ?? rel.flagUrl ?? null,
    tradeAgreement: rel.treaties?.some((t) => t.toLowerCase().includes("trade")) ?? false,
    tradeVolume: rel.tradeVolume ?? 0,
  }));

  return (
    <div className="space-y-4">
      <TradeImpactSummary
        plannedTariffRevenue={plannedTariffRevenue}
        plannedAverageTariff={plannedAverageTariff}
        revenueNetOfEfficiency={taxEfficiency != null}
        tradeBalance={tradeBalance}
        totalExports={totalExports}
        totalImports={totalImports}
      />

      <SheetSection
        title="Sector tariff schedule"
        icon={Globe2}
        accessory={
          <Button asChild variant="outline" size="sm">
            <Link href={editorHref("tariffs")}>
              Configure sector tariffs
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        }
      >
        {recordedSectors.length === 0 ? (
          <EmptyState
            compact
            icon={<Globe2 />}
            title="No economic sectors recorded yet"
            message="Declare an economic Directive to diversify output across sectors, then set sector tariffs in the editor."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recordedSectors.map((sector) => {
              const rate = savedSectorTariffs[sector.key] ?? sector.defaultTariff;
              return (
                <Card key={sector.id} variant="well" padding="sm" className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          SECTOR_ACCENT_BG[sector.accent]
                        )}
                      />
                      <span className="text-label text-footnote truncate font-medium capitalize">
                        {sector.label}
                      </span>
                    </div>
                    <span className="text-label text-subhead shrink-0 font-semibold tabular-nums">
                      {rate.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-label-secondary text-footnote tabular-nums">
                    {sector.defaultShare.toFixed(1)}% of GDP
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </SheetSection>

      <TradePartnersManager partners={tradePartners} />
    </div>
  );
}

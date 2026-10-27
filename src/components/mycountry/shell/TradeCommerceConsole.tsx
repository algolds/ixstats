"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Plus, InfoCircle, Globe } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { parseSectorBreakdown } from "~/lib/economy/sector-breakdown";
import {
  economicRelationsOf,
  finiteOrNull,
  savedTariffRate,
} from "~/lib/economy/country-relations";

import type { CustomSector } from "./trade-commerce/trade-commerce-types";
import { sectorsFromRecorded } from "./trade-commerce/trade-commerce-types";
import { TariffSectorSliderCard } from "./trade-commerce/TariffSectorSliderCard";
import { TradePartnersManager } from "./trade-commerce/TradePartnersManager";
import { TradeImpactSummary } from "./trade-commerce/TradeImpactSummary";
import { exciseWithSectorTariff, readSectorTariffs } from "./trade-commerce/sector-tariffs";
import { CustomSectorDialog } from "./trade-commerce/CustomSectorDialog";
import { RailCard, RailCount, RailRow } from "./rails/shared";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

/**
 * Trade & Commerce tab.
 *
 * Trade figures come from the nation's recorded exports/imports (% of GDP) and show "—" when
 * none are recorded. The sector tariff schedule is a planner: it is seeded from the recorded
 * sectors and the saved Fiscal Policy tariff rate. A recorded sector's rate is saved when a slider
 * is released (beside the overall tariff in `exciseTaxRates`); sectors added here stay in this
 * session. Trade agreement status is read from recorded treaties.
 */
export function TradeCommerceConsole({ countryId }: { countryId: string }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { country } = useCountryData();

  const [isAddSectorOpen, setIsAddSectorOpen] = useState(false);
  const [lockedSectors, setLockedSectors] = useState<Record<string, boolean>>({});

  const { data: diplomaticRelations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const { economicProfile: profile, fiscalSystem: fiscal } = economicRelationsOf(country);

  // Saved overall tariff (Fiscal Policy) — the planner's starting rate for every sector.
  const baseTariff = savedTariffRate(fiscal?.exciseTaxRates);
  const taxEfficiency = finiteOrNull(fiscal?.taxEfficiency);

  // Planner sectors: the nation's recorded sectors plus any added in this session (unsaved).
  const recordedSectors = useMemo(
    () => sectorsFromRecorded(parseSectorBreakdown(profile?.sectorBreakdown), baseTariff ?? 0),
    [profile?.sectorBreakdown, baseTariff]
  );
  const [addedSectors, setAddedSectors] = useState<CustomSector[]>([]);
  const sectors = useMemo(
    () => [...recordedSectors, ...addedSectors],
    [recordedSectors, addedSectors]
  );
  const [tariffs, setTariffs] = useState<Record<string, number>>({});

  // Saved per-sector rates, by sector key (recorded sectors only).
  const savedSectorTariffs = useMemo(
    () => readSectorTariffs(fiscal?.exciseTaxRates),
    [fiscal?.exciseTaxRates]
  );
  const rateOf = useCallback(
    (s: CustomSector) => tariffs[s.id] ?? savedSectorTariffs[s.key] ?? s.defaultTariff,
    [tariffs, savedSectorTariffs]
  );

  const saveMutation = api.economics.updateFiscalSystem.useMutation({
    onSuccess: () => {
      void utils.countries.getByIdWithEconomicData.invalidate();
    },
    onError: (err: { message?: string }) => {
      notify.error(`Failed to save sector tariff: ${err?.message ?? "Unknown error"}`);
    },
  });
  const mutateRef = useRef(saveMutation.mutate);
  useEffect(() => {
    mutateRef.current = saveMutation.mutate;
  }, [saveMutation.mutate]);
  // Latest exciseTaxRates we know of, so back-to-back sector saves merge into each other.
  const exciseRef = useRef<string | null | undefined>(fiscal?.exciseTaxRates);
  useEffect(() => {
    exciseRef.current = fiscal?.exciseTaxRates;
  }, [fiscal?.exciseTaxRates]);

  const persistTariff = useCallback(
    (sector: CustomSector, rate: number | null) => {
      if (!recordedSectors.some((s) => s.id === sector.id)) return; // session-only sector
      const next = exciseWithSectorTariff(exciseRef.current, sector.key, rate);
      exciseRef.current = next;
      mutateRef.current({ countryId, exciseTaxRates: next });
    },
    [countryId, recordedSectors]
  );

  const handleTariffChange = useCallback((sectorId: string, val: number) => {
    setTariffs((prev) => ({ ...prev, [sectorId]: val }));
  }, []);

  const handleTariffCommit = useCallback(
    (sector: CustomSector, val: number) => {
      setTariffs((prev) => ({ ...prev, [sector.id]: val }));
      persistTariff(sector, val);
    },
    [persistTariff]
  );

  const toggleLock = useCallback((sectorId: string) => {
    setLockedSectors((prev) => ({ ...prev, [sectorId]: !prev[sectorId] }));
  }, []);

  const resetTariff = useCallback(
    (sector: CustomSector) => {
      setTariffs((prev) => ({ ...prev, [sector.id]: sector.defaultTariff }));
      persistTariff(sector, null);
    },
    [persistTariff]
  );

  const handleAddSector = useCallback(
    (newSector: CustomSector) => {
      setAddedSectors((prev) => [...prev, newSector]);
      notify.success(`Added ${newSector.label} to the tariff planner (not saved)`);
    },
    [notify]
  );

  // Recorded trade figures — null when the nation hasn't recorded them.
  const gdp = finiteOrNull(country?.currentTotalGdp);
  const exportsPct = finiteOrNull(profile?.exportsGDPPercent);
  const importsPct = finiteOrNull(profile?.importsGDPPercent);
  const totalExports =
    gdp != null && gdp > 0 && exportsPct != null ? (gdp * exportsPct) / 100 : null;
  const totalImports =
    gdp != null && gdp > 0 && importsPct != null ? (gdp * importsPct) / 100 : null;
  const tradeBalance =
    totalExports != null && totalImports != null ? totalExports - totalImports : null;

  const { plannedAverageTariff, plannedTariffRevenue } = useMemo(() => {
    let weighted = 0;
    let totalShare = 0;
    sectors.forEach((s) => {
      const rate = rateOf(s);
      weighted += rate * s.defaultShare;
      totalShare += s.defaultShare;
    });
    const avg = totalShare > 0 ? weighted / totalShare : null;
    const revenue =
      avg != null && totalImports != null
        ? totalImports * (avg / 100) * (taxEfficiency ?? 1)
        : null;
    return { plannedAverageTariff: avg, plannedTariffRevenue: revenue };
  }, [sectors, rateOf, totalImports, taxEfficiency]);

  // Trade partners, with agreement status from recorded treaties.
  const tradePartners = useMemo(() => {
    if (!diplomaticRelations) return [];
    return diplomaticRelations.map((rel) => ({
      countryId: rel.targetCountryId || rel.id,
      countryName: rel.targetCountryName || rel.targetCountry || "Diplomatic Partner",
      flagUrl: rel.targetCountryFlag ?? rel.flagUrl ?? null,
      tradeAgreement: rel.treaties?.some((t) => t.toLowerCase().includes("trade")) ?? false,
      tradeVolume: rel.tradeVolume ?? 0,
    }));
  }, [diplomaticRelations]);

  return (
    <div className="space-y-6">
      {/* Top Macro Impact Cards */}
      <TradeImpactSummary
        plannedTariffRevenue={plannedTariffRevenue}
        plannedAverageTariff={plannedAverageTariff}
        revenueNetOfEfficiency={taxEfficiency != null}
        tradeBalance={tradeBalance}
        totalExports={totalExports}
        totalImports={totalImports}
      />

      {/* Sector Tariff Planner (recorded sectors save on release) */}
      <Card className="rounded-card">
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 p-4 pb-3">
          <div className="min-w-0 space-y-0.5">
            <h3 className="text-label text-headline flex flex-wrap items-center gap-2">
              Sector tariff planner
              {addedSectors.length > 0 && <Badge variant="warning">Added sectors not saved</Badge>}
            </h3>
            <p className="text-label-secondary text-footnote">
              Set tariffs by sector. Rates for recorded sectors save when you release a slider; they
              don&apos;t change your economy&apos;s tariff revenue.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddSectorOpen(true)}
            className="h-11 shrink-0 sm:h-8"
          >
            <Plus aria-hidden="true" />
            Add sector
          </Button>
        </CardHeader>

        <CardContent className="space-y-4 px-4 pb-4">
          <p className="text-label-secondary text-footnote flex items-start gap-2">
            <InfoCircle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Your saved tariff is the <strong className="text-label">Import tariff</strong> in the
              Taxes tab
              {baseTariff != null ? ` (currently ${baseTariff}%)` : " (none saved yet)"}. Sectors
              start at that rate and are weighted by their recorded share of GDP.
            </span>
          </p>

          {sectors.length === 0 ? (
            <p className="text-label-secondary border-separator rounded-row text-footnote border border-dashed py-8 text-center">
              No economic sectors are recorded for this nation. Add one here to sketch a tariff
              schedule.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {sectors.map((sec) => (
                <TariffSectorSliderCard
                  key={sec.id}
                  sector={sec}
                  currentTariff={rateOf(sec)}
                  isLocked={!!lockedSectors[sec.id]}
                  onTariffChange={(val) => handleTariffChange(sec.id, val)}
                  onTariffCommit={(val) => handleTariffCommit(sec, val)}
                  onToggleLock={() => toggleLock(sec.id)}
                  onReset={() => resetTariff(sec)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bilateral Trade Partners Section */}
      <TradePartnersManager partners={tradePartners} />

      {/* Custom Sector Modal — mounted on open so it starts from the current saved tariff */}
      {isAddSectorOpen && (
        <CustomSectorDialog
          isOpen
          defaultTariff={baseTariff ?? 0}
          onClose={() => setIsAddSectorOpen(false)}
          onAddSector={handleAddSector}
        />
      )}
    </div>
  );
}

export function TradeCommerceInsights({ countryId }: { countryId: string }) {
  const { country } = useCountryData();
  const { data: diplomaticRelations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const { economicProfile } = economicRelationsOf(country);
  const recordedSectorCount = parseSectorBreakdown(economicProfile?.sectorBreakdown).length;

  const partnerCount = diplomaticRelations?.length ?? 0;
  const ftaCount =
    diplomaticRelations?.filter((r) => r.treaties?.some((t) => t.toLowerCase().includes("trade")))
      ?.length ?? 0;

  return (
    <RailCard
      title="Trade & commerce"
      icon={Globe}
      accessory={<RailCount>{partnerCount} partners</RailCount>}
    >
      <div className="grid grid-cols-2 gap-2">
        <RailRow className="p-2">
          <span className="text-label-secondary text-footnote block">Free trade pacts</span>
          <p className="text-label text-title-3 mt-0.5 tabular-nums">{ftaCount}</p>
        </RailRow>
        <RailRow className="p-2">
          <span className="text-label-secondary text-footnote block">Recorded sectors</span>
          <p className="text-label text-title-3 mt-0.5 tabular-nums">
            {recordedSectorCount > 0 ? recordedSectorCount : "—"}
          </p>
        </RailRow>
      </div>
    </RailCard>
  );
}

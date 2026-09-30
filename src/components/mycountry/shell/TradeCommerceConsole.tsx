"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Plus, InfoCircle } from "iconoir-react";
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
import { CustomSectorDialog } from "./trade-commerce/CustomSectorDialog";

export { type CustomSector, type AccentColor } from "./trade-commerce/trade-commerce-types";

/**
 * Trade & Commerce tab.
 *
 * Trade figures come from the nation's recorded exports/imports (% of GDP) and show "—" when
 * none are recorded. The sector tariff schedule is a planner: it is seeded from the recorded
 * sectors and the saved Fiscal Policy tariff rate, but its edits live only in this component and
 * are labelled as not saved. Trade agreement status is read from recorded treaties.
 */
export function TradeCommerceConsole({ countryId }: { countryId: string }) {
  const notify = useNotify();
  const { country } = useCountryData();

  const [isAddSectorOpen, setIsAddSectorOpen] = useState(false);
  const [lockedSectors, setLockedSectors] = useState<Record<string, boolean>>({});

  const { data: diplomaticRelations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const { economicProfile: profile, fiscalSystem: fiscal } = economicRelationsOf(country);
  const currencySymbol = country?.nationalIdentity?.currencySymbol || "$";

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

  const handleTariffChange = useCallback((sectorId: string, val: number) => {
    setTariffs((prev) => ({ ...prev, [sectorId]: val }));
  }, []);

  const toggleLock = useCallback((sectorId: string) => {
    setLockedSectors((prev) => ({ ...prev, [sectorId]: !prev[sectorId] }));
  }, []);

  const resetTariff = useCallback((sector: CustomSector) => {
    setTariffs((prev) => {
      const next = { ...prev };
      delete next[sector.id];
      return next;
    });
  }, []);

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
      const rate = tariffs[s.id] ?? s.defaultTariff;
      weighted += rate * s.defaultShare;
      totalShare += s.defaultShare;
    });
    const avg = totalShare > 0 ? weighted / totalShare : null;
    const revenue =
      avg != null && totalImports != null
        ? totalImports * (avg / 100) * (taxEfficiency ?? 1)
        : null;
    return { plannedAverageTariff: avg, plannedTariffRevenue: revenue };
  }, [sectors, tariffs, totalImports, taxEfficiency]);

  // Trade partners, with agreement status from recorded treaties.
  const tradePartners = useMemo(() => {
    if (!diplomaticRelations) return [];
    return diplomaticRelations.map((rel) => ({
      countryId: rel.targetCountryId || rel.id,
      countryName: rel.targetCountryName || rel.targetCountry || "Diplomatic Partner",
      flagUrl: rel.targetCountryFlag ?? rel.flagUrl ?? null,
      status: rel.relationship || rel.status || "Formal",
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
        currencySymbol={currencySymbol}
      />

      {/* Sector Tariff Planner (not saved) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold">
              Sector Tariff Planner
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                Not saved
              </span>
            </h3>
            <p className="text-muted-foreground text-xs">
              Try out tariffs by sector. Changes here reset when you leave the page and don&apos;t
              change your economy.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddSectorOpen(true)}
            className="shrink-0 gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Sector
          </Button>
        </div>

        <div className="border-border/40 bg-muted/20 text-muted-foreground flex items-start gap-2 rounded-lg border p-3 text-xs">
          <InfoCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Your saved tariff is the <strong className="text-foreground">Tariff rate</strong> in the
            Fiscal Policy tab
            {baseTariff != null ? ` (currently ${baseTariff}%)` : " (none saved yet)"}. Sectors
            start at that rate and are weighted by their recorded share of GDP.
          </span>
        </div>

        {sectors.length === 0 ? (
          <div className="border-border/50 text-muted-foreground rounded-xl border border-dashed py-8 text-center text-xs">
            No economic sectors recorded. Record them in the Country Editor, or add one here to
            sketch a tariff schedule.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sectors.map((sec) => (
              <TariffSectorSliderCard
                key={sec.id}
                sector={sec}
                currentTariff={tariffs[sec.id] ?? sec.defaultTariff}
                isLocked={!!lockedSectors[sec.id]}
                onTariffChange={(val) => handleTariffChange(sec.id, val)}
                onToggleLock={() => toggleLock(sec.id)}
                onReset={() => resetTariff(sec)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bilateral Trade Partners Section */}
      <TradePartnersManager partners={tradePartners} currencySymbol={currencySymbol} />

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
    <div className="border-border/40 bg-card/60 space-y-2 rounded-xl border p-3 backdrop-blur-sm">
      <div className="text-foreground flex items-center justify-between text-xs font-semibold">
        <span>Trade & Commerce</span>
        <span className="text-muted-foreground font-mono text-xs">{partnerCount} Partners</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-background/50 border-border/30 rounded-lg border p-2">
          <span className="text-muted-foreground block text-xs">Free Trade Pacts</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{ftaCount}</span>
        </div>
        <div className="bg-background/50 border-border/30 rounded-lg border p-2">
          <span className="text-muted-foreground block text-xs">Recorded Sectors</span>
          <span className="text-foreground font-bold">
            {recordedSectorCount > 0 ? recordedSectorCount : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

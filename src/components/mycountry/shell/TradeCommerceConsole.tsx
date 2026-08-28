"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Plus } from "iconoir-react";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

import type { CustomSector } from "./trade-commerce/trade-commerce-types";
import { DEFAULT_SECTORS, parseSectorBreakdownJson } from "./trade-commerce/trade-commerce-types";
import { TariffSectorSliderCard } from "./trade-commerce/TariffSectorSliderCard";
import { TradePartnersManager } from "./trade-commerce/TradePartnersManager";
import { TradeImpactSummary } from "./trade-commerce/TradeImpactSummary";
import { CustomSectorDialog } from "./trade-commerce/CustomSectorDialog";

export { type CustomSector, type AccentColor } from "./trade-commerce/trade-commerce-types";

export function TradeCommerceConsole({ countryId }: { countryId: string }) {
  const notify = useNotify();
  const { country } = useCountryData();

  const [isAddSectorOpen, setIsAddSectorOpen] = useState(false);
  const [lockedSectors, setLockedSectors] = useState<Record<string, boolean>>({});

  // Fetch economy configuration and diplomatic relationships
  const { data: econConfig } = api.economics.getEconomyConfiguration.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const { data: diplomaticRelations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  // Parse or initialize sectors
  const [customSectors, setCustomSectors] = useState<CustomSector[]>(DEFAULT_SECTORS);
  const [tariffs, setTariffs] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    DEFAULT_SECTORS.forEach((s) => {
      init[s.id] = s.defaultTariff;
    });
    return init;
  });

  const [agreements, setAgreements] = useState<Record<string, boolean>>({});

  const handleTariffChange = useCallback((sectorId: string, val: number) => {
    setTariffs((prev) => ({ ...prev, [sectorId]: val }));
  }, []);

  const toggleLock = useCallback((sectorId: string) => {
    setLockedSectors((prev) => ({ ...prev, [sectorId]: !prev[sectorId] }));
  }, []);

  const resetTariff = useCallback((sector: CustomSector) => {
    setTariffs((prev) => ({ ...prev, [sector.id]: sector.defaultTariff }));
  }, []);

  const handleAddSector = useCallback(
    (newSector: CustomSector) => {
      setCustomSectors((prev) => [...prev, newSector]);
      setTariffs((prev) => ({ ...prev, [newSector.id]: newSector.defaultTariff }));
      notify.success(`Declared export sector: ${newSector.label}`);
    },
    [notify]
  );

  const toggleAgreement = useCallback((targetCountryId: string) => {
    setAgreements((prev) => ({ ...prev, [targetCountryId]: !prev[targetCountryId] }));
  }, []);

  // Compute aggregate trade metrics
  const totalExports = useMemo(() => {
    return (country as any)?.gdp ? (country as any).gdp * 0.28 : 50_000_000_000;
  }, [country]);

  const totalImports = useMemo(() => {
    return totalExports * 0.92;
  }, [totalExports]);

  const { averageTariff, totalTariffRevenue } = useMemo(() => {
    let weightedTariff = 0;
    let totalShare = 0;
    customSectors.forEach((s) => {
      const rate = tariffs[s.id] ?? s.defaultTariff;
      weightedTariff += rate * (s.defaultShare / 100);
      totalShare += s.defaultShare;
    });
    const avg = totalShare > 0 ? (weightedTariff / totalShare) * 100 : 4.0;
    const revenue = totalImports * (avg / 100) * 0.85;
    return { averageTariff: avg, totalTariffRevenue: revenue };
  }, [customSectors, tariffs, totalImports]);

  const tradeBalance = totalExports - totalImports;

  // Format trade partners list
  const tradePartners = useMemo(() => {
    if (!diplomaticRelations) return [];
    return diplomaticRelations.map((rel: any) => ({
      countryId: rel.targetCountry?.id || rel.id,
      countryName: rel.targetCountry?.name || "Diplomatic Partner",
      flagUrl: rel.targetCountry?.flagUrl,
      status: rel.relationshipType || "Formal",
      tradeAgreement:
        agreements[rel.targetCountry?.id || rel.id] ?? rel.hasFreeTradeAgreement ?? false,
    }));
  }, [diplomaticRelations, agreements]);

  return (
    <div className="space-y-6">
      {/* Top Macro Impact Cards */}
      <TradeImpactSummary
        totalTariffRevenue={totalTariffRevenue}
        averageTariff={averageTariff}
        tradeBalance={tradeBalance}
        totalExports={totalExports}
        totalImports={totalImports}
        currencySymbol={(country as any)?.currencySymbol || "$"}
      />

      {/* Sector Tariffs Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-foreground text-sm font-semibold">Sector Tariff Schedules</h3>
            <p className="text-muted-foreground text-xs">
              Adjust protective tariffs across strategic trade sectors.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddSectorOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Sector
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {customSectors.map((sec) => (
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
      </div>

      {/* Bilateral Trade Partners Section */}
      <TradePartnersManager partners={tradePartners} onToggleAgreement={toggleAgreement} />

      {/* Custom Sector Modal */}
      <CustomSectorDialog
        isOpen={isAddSectorOpen}
        onClose={() => setIsAddSectorOpen(false)}
        onAddSector={handleAddSector}
      />
    </div>
  );
}

export function TradeCommerceInsights({ countryId }: { countryId: string }) {
  const { data: diplomaticRelations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const partnerCount = diplomaticRelations?.length ?? 0;
  const ftaCount =
    (diplomaticRelations as any[])?.filter((r: any) => r.hasFreeTradeAgreement)?.length ?? 0;

  return (
    <div className="border-border/40 bg-card/60 space-y-2 rounded-xl border p-3 backdrop-blur-sm">
      <div className="text-foreground flex items-center justify-between text-xs font-semibold">
        <span>Trade & Commerce</span>
        <span className="text-muted-foreground font-mono text-[10px]">{partnerCount} Partners</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-background/50 border-border/30 rounded-lg border p-2">
          <span className="text-muted-foreground block text-[10px]">Free Trade Pacts</span>
          <span className="font-bold text-emerald-400">{ftaCount}</span>
        </div>
        <div className="bg-background/50 border-border/30 rounded-lg border p-2">
          <span className="text-muted-foreground block text-[10px]">Active Sectors</span>
          <span className="text-foreground font-bold">{DEFAULT_SECTORS.length}</span>
        </div>
      </div>
    </div>
  );
}

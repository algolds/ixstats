// src/components/wiki-os/shared/ActiveCountryUnifiedWidget.tsx
// Active Country context widget displaying flag, status, and detail popovers.

"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useUserCountry } from "~/hooks/useUserCountry";
import { useSidebar } from "~/components/dashboard/sidebar/DashboardSidebarLayout";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { CountryActionsMenu } from "~/components/mycountry/dossier/CountryActionsMenu";

export interface ActiveCountryData {
  id?: string;
  name?: string;
  flagUrl?: string | null;
  flagEmoji?: string | null;
  continent?: string | null;
  currentPopulation?: number | null;
  currentGdpPerCapita?: number | null;
  currentTotalGdp?: number | null;
  population?: number | null;
  gdp?: number | null;
  vitalityIndex?: number | null;
  [key: string]: unknown;
}

interface ActiveCountryUnifiedWidgetProps {
  country: ActiveCountryData | null | undefined;
  transitionStyle?: React.CSSProperties;
  isLocalHoverExpanded?: boolean;
}

export function ActiveCountryUnifiedWidget({
  country,
  transitionStyle,
  isLocalHoverExpanded = false,
}: ActiveCountryUnifiedWidgetProps) {
  const { isCollapsed: sidebarCollapsed, isHovered } = useSidebar();
  const isCollapsed = sidebarCollapsed && !isHovered;
  const isRowCollapsed = isCollapsed && !isLocalHoverExpanded;
  const { country: myCountry, userProfile } = useUserCountry();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const activeCountry = country || myCountry;

  // Click outside handler
  useEffect(() => {
    if (!popoverOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [popoverOpen]);

  // Query activity rings to fetch live stats & vitality
  const { data: rings } = api.countries.getActivityRingsData.useQuery(
    { countryId: activeCountry?.id ?? "" },
    { enabled: !!activeCountry?.id && (popoverOpen || !isCollapsed), staleTime: 60 * 1000 }
  );

  if (!activeCountry) return null;

  const formatGdp = (n: number) => {
    if (!n) return "...";
    if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}T`;
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    return n.toLocaleString();
  };

  const viewerCountryId = userProfile?.countryId ?? undefined;
  const isOwnCountry = myCountry?.id === activeCountry.id;
  const countryName = activeCountry.name ?? "Active Country";

  const popVal =
    "currentPopulation" in activeCountry && activeCountry.currentPopulation != null
      ? Number(activeCountry.currentPopulation)
      : "calculatedStats" in activeCountry &&
          (activeCountry as { calculatedStats?: { currentPopulation?: number } }).calculatedStats
            ?.currentPopulation != null
        ? Number(
            (activeCountry as { calculatedStats?: { currentPopulation?: number } }).calculatedStats
              ?.currentPopulation
          )
        : "population" in activeCountry &&
            (activeCountry as { population?: number }).population != null
          ? Number((activeCountry as { population?: number }).population)
          : null;

  const gdpCapVal =
    "currentGdpPerCapita" in activeCountry && activeCountry.currentGdpPerCapita != null
      ? Number(activeCountry.currentGdpPerCapita)
      : "calculatedStats" in activeCountry &&
          (activeCountry as { calculatedStats?: { currentGdpPerCapita?: number } }).calculatedStats
            ?.currentGdpPerCapita != null
        ? Number(
            (activeCountry as { calculatedStats?: { currentGdpPerCapita?: number } }).calculatedStats
              ?.currentGdpPerCapita
          )
        : null;

  const totalGdpVal =
    "currentTotalGdp" in activeCountry && activeCountry.currentTotalGdp != null
      ? Number(activeCountry.currentTotalGdp)
      : "calculatedStats" in activeCountry &&
          (activeCountry as { calculatedStats?: { currentTotalGdp?: number } }).calculatedStats
            ?.currentTotalGdp != null
        ? Number(
            (activeCountry as { calculatedStats?: { currentTotalGdp?: number } }).calculatedStats
              ?.currentTotalGdp
          )
        : "gdp" in activeCountry && (activeCountry as { gdp?: number }).gdp != null
          ? Number((activeCountry as { gdp?: number }).gdp)
          : null;

  return (
    <div className="relative w-full" ref={popoverRef}>
      <div
        className={cn(
          "group relative flex items-center rounded-xl px-2.5 py-1 transition-all duration-300 ease-in-out outline-none",
          isLocalHoverExpanded
            ? "z-50 w-max border border-[var(--wikios-border)] bg-[var(--wikios-card-bg)] pr-4 shadow-lg backdrop-blur-md"
            : "hover:bg-foreground/5 w-full border-transparent bg-transparent"
        )}
      >
        <button
          onClick={() => {
            if (isCollapsed) {
              setPopoverOpen((prev) => !prev);
            } else {
              setActionsMenuOpen(true);
            }
          }}
          className={cn(
            "wikios-sidebar-icon-box relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/5 shadow-md transition-all active:scale-95",
            popoverOpen ? "border-amber-500/50 bg-amber-500/15" : "hover:border-amber-500/30"
          )}
          title={`Country Context: ${countryName} ${isCollapsed ? "(Click for details)" : "(Click for actions)"}`}
          type="button"
        >
          <UnifiedCountryFlag countryName={countryName} size="sm" showTooltip={false} />
        </button>

        <button
          onClick={() => setActionsMenuOpen(true)}
          className={cn(
            "flex-1 overflow-hidden text-left whitespace-nowrap transition-all duration-300 ease-in-out outline-none",
            isRowCollapsed ? "pointer-events-none w-0 opacity-0" : "w-auto pl-3 opacity-100"
          )}
          style={transitionStyle}
          type="button"
        >
          <span className="block truncate text-xs font-semibold text-[var(--wikios-text-muted)] group-hover:text-[var(--wikios-text)]">
            {countryName}
          </span>
          <span className="block text-[9px] leading-tight text-[var(--wikios-text-dim)]">
            {isOwnCountry ? "MyCountry" : "MyCountry Actions"}
          </span>
        </button>
      </div>

      {isCollapsed && popoverOpen && (
        <div className="animate-in fade-in slide-in-from-left-2 absolute bottom-0 left-[calc(100%+12px)] z-50 w-60 rounded-xl border border-amber-500/20 bg-[var(--wikios-surface)]/95 p-3.5 shadow-2xl backdrop-blur-xl duration-150">
          {/* Header */}
          <div className="mb-2.5 flex items-center gap-2.5 border-b border-white/5 pb-2.5">
            <div className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-sm">
              <UnifiedCountryFlag countryName={countryName} size="sm" showTooltip={false} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-foreground truncate text-xs leading-tight font-bold">
                {countryName}
              </h4>
              <p className="text-muted-foreground text-[9px] leading-tight">
                {activeCountry.continent ? String(activeCountry.continent) : ""}{" "}
                {isOwnCountry ? "(MyCountry)" : "(MyCountry Actions)"}
              </p>
            </div>
          </div>

          {/* Base Stats */}
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Population:</span>
              <span className="text-foreground font-semibold">
                {popVal != null ? Math.round(popVal).toLocaleString() : "..."}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GDP per Capita:</span>
              <span className="text-foreground font-semibold">
                {gdpCapVal != null ? `$${Math.round(gdpCapVal).toLocaleString()}` : "..."}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total GDP:</span>
              <span className="text-foreground font-semibold">
                {totalGdpVal != null ? `$${formatGdp(totalGdpVal)}` : "..."}
              </span>
            </div>

            {rings && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GDP Growth:</span>
                  <span
                    className={cn(
                      "font-semibold",
                      parseFloat(rings.economicMetrics.growthRate) >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    )}
                  >
                    {rings.economicMetrics.growthRate}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Govt Approval:</span>
                  <span className="text-foreground font-semibold">
                    {rings.governmentMetrics.approval}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Vitality Summary */}
          {rings && (
            <div className="mt-2.5 border-t border-white/5 pt-2.5">
              <div className="mb-1.5 text-[9px] font-bold tracking-wider text-[var(--wikios-text-dim)] uppercase">
                Vitality Indices
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                <div className="bg-foreground/[0.04] flex justify-between rounded px-1.5 py-1">
                  <span className="text-muted-foreground">Econ:</span>
                  <span className="font-bold text-green-400">{rings.economicVitality}</span>
                </div>
                <div className="bg-foreground/[0.04] flex justify-between rounded px-1.5 py-1">
                  <span className="text-muted-foreground">Well:</span>
                  <span className="font-bold text-blue-400">{rings.populationWellbeing}</span>
                </div>
                <div className="bg-foreground/[0.04] flex justify-between rounded px-1.5 py-1">
                  <span className="text-muted-foreground">Diplo:</span>
                  <span className="font-bold text-purple-400">{rings.diplomaticStanding}</span>
                </div>
                <div className="bg-foreground/[0.04] flex justify-between rounded px-1.5 py-1">
                  <span className="text-muted-foreground">Gov:</span>
                  <span className="font-bold text-amber-400">{rings.governmentalEfficiency}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions Button */}
          <div className="mt-3">
            <button
              onClick={() => {
                setPopoverOpen(false);
                setActionsMenuOpen(true);
              }}
              className="flex w-full items-center justify-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300 transition-all hover:bg-amber-500/20 active:scale-[0.98]"
              type="button"
            >
              {isOwnCountry ? "Manage Country" : "Country Actions"}
            </button>
          </div>
        </div>
      )}

      <CountryActionsMenu
        targetCountryId={activeCountry.id ?? ""}
        targetCountryName={countryName}
        viewerCountryId={viewerCountryId}
        isOpen={actionsMenuOpen}
        onClose={() => setActionsMenuOpen(false)}
        isOwnCountry={isOwnCountry}
      />
    </div>
  );
}

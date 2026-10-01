"use client";
// src/components/wiki-os/shared/ActiveCountryUnifiedWidget.tsx
// Active Country context widget displaying flag, status, and detail popovers.

import { useState, useEffect, useRef } from "react";
import { cn, formatCurrency } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useUserCountry } from "~/hooks/useUserCountry";
import { useSidebar } from "~/components/dashboard/sidebar/DashboardSidebarLayout";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
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
            (activeCountry as { calculatedStats?: { currentGdpPerCapita?: number } })
              .calculatedStats?.currentGdpPerCapita
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
          "group rounded-row relative flex items-center px-2.5 py-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 ease-in-out outline-none",
          isLocalHoverExpanded
            ? "border-separator bg-surface shadow-floating z-50 w-max border pr-4"
            : "hover:bg-fill-4 w-full border-transparent bg-transparent"
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
            "wikios-sidebar-icon-box rounded-row border-yellow/20 bg-yellow/5 shadow-card relative flex h-9 w-9 shrink-0 items-center justify-center border transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]",
            popoverOpen ? "border-yellow/50 bg-yellow/15" : "hover:border-yellow/30"
          )}
          title={`Country Context: ${countryName} ${isCollapsed ? "(Click for details)" : "(Click for actions)"}`}
          type="button"
        >
          <UnifiedCountryFlag countryName={countryName} size="sm" showTooltip={false} />
        </button>

        <button
          onClick={() => setActionsMenuOpen(true)}
          className={cn(
            "flex-1 overflow-hidden text-left whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 ease-in-out outline-none",
            isRowCollapsed ? "pointer-events-none w-0 opacity-0" : "w-auto pl-3 opacity-100"
          )}
          style={transitionStyle}
          type="button"
        >
          <span className="text-caption text-label-secondary group-hover:text-label block truncate font-semibold">
            {countryName}
          </span>
          <span className="text-footnote text-label-secondary block leading-tight">
            {isOwnCountry ? "MyCountry" : "MyCountry Actions"}
          </span>
        </button>
      </div>

      {isCollapsed && popoverOpen && (
        <div className="animate-in fade-in slide-in-from-left-2 rounded-row border-yellow/20 bg-surface shadow-floating absolute bottom-0 left-[calc(100%+12px)] z-50 w-60 border p-3.5 duration-150">
          {/* Header */}
          <div className="border-separator mb-2.5 flex items-center gap-2.5 border-b pb-2.5">
            <div className="rounded-control-sm relative flex shrink-0 items-center justify-center overflow-hidden">
              <UnifiedCountryFlag countryName={countryName} size="sm" showTooltip={false} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-label text-caption truncate leading-tight font-semibold">
                {countryName}
              </h4>
              <p className="text-label-secondary text-footnote leading-tight">
                {activeCountry.continent ? String(activeCountry.continent) : ""}{" "}
                {isOwnCountry ? "(MyCountry)" : "(MyCountry Actions)"}
              </p>
            </div>
          </div>

          {/* Base Stats */}
          <div className="text-footnote space-y-1.5">
            <div className="flex justify-between">
              <span className="text-label-secondary">Population:</span>
              <span className="text-label font-semibold">
                {popVal != null ? Math.round(popVal).toLocaleString() : "..."}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-label-secondary">GDP per Capita:</span>
              <span className="text-label font-semibold">
                {gdpCapVal != null ? `$${Math.round(gdpCapVal).toLocaleString()}` : "..."}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-label-secondary">Total GDP:</span>
              <span className="text-label font-semibold">
                {totalGdpVal != null ? formatCurrency(totalGdpVal) : "..."}
              </span>
            </div>

            {rings && (
              <>
                <div className="flex justify-between">
                  <span className="text-label-secondary">GDP Growth:</span>
                  <span
                    className={cn(
                      "font-semibold",
                      parseFloat(rings.economicMetrics.growthRate) >= 0 ? "text-green" : "text-red"
                    )}
                  >
                    {rings.economicMetrics.growthRate}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-label-secondary">Govt Approval:</span>
                  <span className="text-label font-semibold">
                    {rings.governmentMetrics.approval}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Vitality Summary */}
          {rings && (
            <div className="border-separator mt-2.5 border-t pt-2.5">
              <div className="text-subhead text-label-secondary mb-1.5">Vitality Indices</div>
              <div className="text-footnote grid grid-cols-2 gap-1.5">
                <div className="bg-fill-4 rounded-control-sm flex justify-between px-1.5 py-1">
                  <span className="text-label-secondary">Econ:</span>
                  <span className="text-green font-semibold">{rings.economicVitality}</span>
                </div>
                <div className="bg-fill-4 rounded-control-sm flex justify-between px-1.5 py-1">
                  <span className="text-label-secondary">Well:</span>
                  <span className="text-tint font-semibold">{rings.populationWellbeing}</span>
                </div>
                <div className="bg-fill-4 rounded-control-sm flex justify-between px-1.5 py-1">
                  <span className="text-label-secondary">Diplo:</span>
                  <span className="text-teal font-semibold">{rings.diplomaticStanding ?? "—"}</span>
                </div>
                <div className="bg-fill-4 rounded-control-sm flex justify-between px-1.5 py-1">
                  <span className="text-label-secondary">Gov:</span>
                  <span className="text-indigo font-semibold">
                    {rings.governmentalEfficiency ?? "—"}
                  </span>
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
              className="rounded-control-sm border-yellow/20 bg-yellow/10 text-caption text-yellow hover:bg-yellow/20 flex w-full items-center justify-center gap-1 border px-2 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
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

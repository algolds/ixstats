// src/components/wikios/shared/ActiveCountryUnifiedWidget.tsx
// Active Country context widget displaying flag, status, and detail popovers.

"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useUserCountry } from "~/hooks/useUserCountry";
import { useSidebar } from "~/components/dashboard/DashboardSidebarLayout";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { CountryActionsMenu } from "~/components/countries/CountryActionsMenu";

interface ActiveCountryUnifiedWidgetProps {
  country: any;
}

export function ActiveCountryUnifiedWidget({ country }: ActiveCountryUnifiedWidgetProps) {
  const { isCollapsed } = useSidebar();
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

  return (
    <div className="relative w-full" ref={popoverRef}>
      <div className="flex w-full items-center px-2.5 py-1 rounded-xl hover:bg-white/5 transition-all duration-200 group">
        <button
          onClick={() => {
            if (isCollapsed) {
              setPopoverOpen((prev) => !prev);
            } else {
              setActionsMenuOpen(true);
            }
          }}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl border shadow-md transition-all active:scale-95 shrink-0",
            popoverOpen
              ? "rail-glow-gold border-amber-500/40 bg-amber-500/10 text-amber-400"
              : "rail-glow-gold border-amber-500/20 bg-amber-500/5 text-amber-400 hover:scale-110"
          )}
          title={`Country Context: ${activeCountry.name} ${isCollapsed ? "(Click for details)" : "(Click for actions)"}`}
          type="button"
        >
          <UnifiedCountryFlag countryName={activeCountry.name} size="sm" showTooltip={false} />
        </button>

        <button
          onClick={() => setActionsMenuOpen(true)}
          className={cn(
            "text-left transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden flex-1 outline-none",
            isCollapsed ? "w-0 opacity-0 pointer-events-none" : "w-auto opacity-100 pl-3"
          )}
          type="button"
        >
          <span className="text-xs font-semibold text-[var(--wikios-text-muted)] group-hover:text-[var(--wikios-text)] block truncate">
            {activeCountry.name}
          </span>
          <span className="text-[9px] text-[var(--wikios-text-dim)] block leading-tight">
            {isOwnCountry ? "My Country" : "Active Page"}
          </span>
        </button>
      </div>

      {isCollapsed && popoverOpen && (
        <div className="animate-in fade-in slide-in-from-left-2 absolute bottom-0 left-[calc(100%+12px)] z-50 w-60 rounded-xl border border-amber-500/20 bg-[var(--wikios-surface)]/95 p-3.5 shadow-2xl backdrop-blur-xl duration-150">
          {/* Header */}
          <div className="mb-2.5 flex items-center gap-2.5 border-b border-white/5 pb-2.5">
            <div className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-sm">
              <UnifiedCountryFlag
                countryName={activeCountry.name}
                size="sm"
                showTooltip={false}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-foreground truncate text-xs leading-tight font-bold">
                {activeCountry.name}
              </h4>
              <p className="text-muted-foreground text-[9px] leading-tight">
                {activeCountry.continent} {isOwnCountry ? "(My Country)" : "(Active Page)"}
              </p>
            </div>
          </div>

          {/* Base Stats */}
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Population:</span>
              <span className="text-foreground font-semibold">
                {Math.round(activeCountry.currentPopulation).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GDP per Capita:</span>
              <span className="text-foreground font-semibold">
                ${Math.round(activeCountry.currentGdpPerCapita).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total GDP:</span>
              <span className="text-foreground font-semibold">
                ${formatGdp(activeCountry.currentTotalGdp)}
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
                <div className="flex justify-between rounded bg-white/5 px-1.5 py-1">
                  <span className="text-muted-foreground">Econ:</span>
                  <span className="font-bold text-green-400">{rings.economicVitality}</span>
                </div>
                <div className="flex justify-between rounded bg-white/5 px-1.5 py-1">
                  <span className="text-muted-foreground">Well:</span>
                  <span className="font-bold text-blue-400">{rings.populationWellbeing}</span>
                </div>
                <div className="flex justify-between rounded bg-white/5 px-1.5 py-1">
                  <span className="text-muted-foreground">Diplo:</span>
                  <span className="font-bold text-purple-400">{rings.diplomaticStanding}</span>
                </div>
                <div className="flex justify-between rounded bg-white/5 px-1.5 py-1">
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
        targetCountryId={activeCountry.id}
        targetCountryName={activeCountry.name}
        viewerCountryId={viewerCountryId}
        isOpen={actionsMenuOpen}
        onClose={() => setActionsMenuOpen(false)}
        isOwnCountry={isOwnCountry}
      />
    </div>
  );
}

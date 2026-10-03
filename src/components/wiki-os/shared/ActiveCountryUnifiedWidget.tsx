"use client";

import { useState, useRef, useCallback, type ReactNode } from "react";
import { cn, formatCurrency } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";
import { useUserCountry } from "~/hooks/useUserCountry";
import { useSidebar } from "~/components/dashboard/sidebar/DashboardSidebarLayout";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { CountryActionsMenu } from "~/components/mycountry/dossier/CountryActionsMenu";
import { Button } from "~/components/ui/button";
import { useOutsideClick } from "~/hooks/use-outside-click";

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

/** Numeric stat from the country itself, else its calculatedStats, else a legacy top-level key. */
function readStat(country: ActiveCountryData, key: string, legacyKey?: string): number | null {
  const calculated = country.calculatedStats as Record<string, unknown> | undefined;
  const value = country[key] ?? calculated?.[key] ?? (legacyKey ? country[legacyKey] : undefined);
  return value != null ? Number(value) : null;
}

function StatRow({
  label,
  value,
  valueClass = "text-label",
}: {
  label: string;
  value: ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-label-secondary">{label}</span>
      <span className={cn("font-semibold", valueClass)}>{value}</span>
    </div>
  );
}

interface ActiveCountryUnifiedWidgetProps {
  country: ActiveCountryData | null | undefined;
  transitionStyle?: React.CSSProperties;
  isLocalHoverExpanded?: boolean;
}

function CountryDetailsPopover({
  country,
  countryName,
  isOwnCountry,
  rings,
  onOpenActions,
}: {
  country: ActiveCountryData;
  countryName: string;
  isOwnCountry: boolean;
  rings: RouterOutputs["countries"]["getActivityRingsData"] | undefined;
  onOpenActions: () => void;
}) {
  const popVal = readStat(country, "currentPopulation", "population");
  const gdpCapVal = readStat(country, "currentGdpPerCapita");
  const totalGdpVal = readStat(country, "currentTotalGdp", "gdp");

  return (
    <div className="animate-in fade-in slide-in-from-left-2 rounded-row border-yellow/20 bg-surface shadow-floating absolute bottom-0 left-[calc(100%+12px)] z-50 w-60 border p-4 duration-150">
      <div className="border-separator mb-2 flex items-center gap-2 border-b pb-3">
        <div className="rounded-control-sm relative flex shrink-0 items-center justify-center overflow-hidden">
          <UnifiedCountryFlag countryName={countryName} size="sm" showTooltip={false} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-label text-caption truncate leading-tight font-semibold">
            {countryName}
          </h4>
          <p className="text-label-secondary text-footnote leading-tight">
            {country.continent ? String(country.continent) : ""}{" "}
            {isOwnCountry ? "(MyCountry)" : "(MyCountry Actions)"}
          </p>
        </div>
      </div>

      <div className="text-footnote space-y-2">
        <StatRow
          label="Population:"
          value={popVal != null ? Math.round(popVal).toLocaleString() : "..."}
        />
        <StatRow
          label="GDP per Capita:"
          value={gdpCapVal != null ? `$${Math.round(gdpCapVal).toLocaleString()}` : "..."}
        />
        <StatRow
          label="Total GDP:"
          value={totalGdpVal != null ? formatCurrency(totalGdpVal) : "..."}
        />

        {rings && (
          <>
            <StatRow
              label="GDP Growth:"
              value={rings.economicMetrics.growthRate}
              valueClass={
                parseFloat(rings.economicMetrics.growthRate) >= 0 ? "text-green" : "text-red"
              }
            />
            <StatRow label="Govt Approval:" value={rings.governmentMetrics.approval} />
          </>
        )}
      </div>

      {rings && (
        <div className="border-separator mt-2 border-t pt-3">
          <div className="text-subhead text-label-secondary mb-2">Vitality indices</div>
          <div className="text-footnote grid grid-cols-2 gap-2">
            {(
              [
                ["Econ:", rings.economicVitality, "text-green"],
                ["Well:", rings.populationWellbeing, "text-tint"],
                ["Diplo:", rings.diplomaticStanding ?? "—", "text-teal"],
                ["Gov:", rings.governmentalEfficiency ?? "—", "text-indigo"],
              ] as const
            ).map(([label, value, color]) => (
              <div
                key={label}
                className="bg-fill-4 rounded-control-sm flex justify-between px-2 py-1"
              >
                <span className="text-label-secondary">{label}</span>
                <span className={`${color} font-semibold`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={onOpenActions}
          className="bg-yellow/10 text-yellow hover:bg-yellow/20 w-full"
        >
          {isOwnCountry ? "Manage country" : "Country actions"}
        </Button>
      </div>
    </div>
  );
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

  const closePopover = useCallback(() => setPopoverOpen(false), []);
  useOutsideClick(popoverRef, closePopover);

  // Query activity rings to fetch live stats & vitality
  const { data: rings } = api.countries.getActivityRingsData.useQuery(
    { countryId: activeCountry?.id ?? "" },
    { enabled: !!activeCountry?.id && (popoverOpen || !isCollapsed), staleTime: 60 * 1000 }
  );

  if (!activeCountry) return null;

  const viewerCountryId = userProfile?.countryId ?? undefined;
  const isOwnCountry = myCountry?.id === activeCountry.id;
  const countryName = activeCountry.name ?? "Active Country";

  return (
    <div className="relative w-full" ref={popoverRef}>
      <div
        className={cn(
          "group rounded-row relative flex items-center px-3 py-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 ease-in-out outline-none",
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
            "wikios-sidebar-icon-box rounded-row border-yellow/20 bg-yellow/5 shadow-card relative flex h-9 w-9 shrink-0 items-center justify-center border transition-[color,background-color,border-color,box-shadow,opacity,transform]",
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
        <CountryDetailsPopover
          country={activeCountry as ActiveCountryData}
          countryName={countryName}
          isOwnCountry={isOwnCountry}
          rings={rings}
          onOpenActions={() => {
            setPopoverOpen(false);
            setActionsMenuOpen(true);
          }}
        />
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

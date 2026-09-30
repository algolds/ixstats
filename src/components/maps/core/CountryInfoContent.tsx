"use client";

/**
 * CountryInfoContent — Shared content between desktop panel and mobile sheet.
 * Renders the tab bar and tab bodies (Overview, Info, Geography).
 */

import dynamic from "next/dynamic";
import type { SelectedCountry } from "./IxWorldMap";
import type { useCountryInfoPanelState } from "./hooks/useCountryInfoPanelState";
import { CountryOverviewTab } from "./components/CountryOverviewTab";
import { CountryInfoTab } from "./components/CountryInfoTab";
import { UnclaimedTerritoryView } from "./components/UnclaimedTerritoryView";
import { formatCompactCurrency, formatCompactNumber } from "~/lib/utils/format-utils";
import { Skeleton } from "~/components/ui/skeleton";

function PanelTab({
  label,
  active,
  accent,
  onSelect,
}: {
  label: string;
  active: boolean;
  accent: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={`focus-visible:ring-ring relative px-3 py-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset ${
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {active && <span className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full ${accent}`} />}
    </button>
  );
}

const GeoProfileContent = dynamic(
  () => import("./GeoProfileContent").then((m) => ({ default: m.GeoProfileContent })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3 py-2" aria-busy="true" aria-label="Loading geography">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-4 w-2/3 rounded" />
        <Skeleton className="h-4 w-1/2 rounded" />
      </div>
    ),
  }
);

type PanelState = ReturnType<typeof useCountryInfoPanelState>;

interface CountryInfoContentProps {
  country: SelectedCountry;
  state: PanelState;
  onGeographyFilter?: (filter: { type: "continent" | "region"; value: string } | null) => void;
  onEditMap?: () => void;
}

export function CountryInfoContent({
  country,
  state,
  onGeographyFilter,
  onEditMap,
}: CountryInfoContentProps) {
  return (
    <>
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Country details"
        className="border-border/50 flex shrink-0 border-b px-4"
      >
        <PanelTab
          label="Overview"
          active={state.activeTab === "overview"}
          accent="bg-primary"
          onSelect={() => state.setActiveTab("overview")}
        />
        <PanelTab
          label="Info"
          active={state.activeTab === "info"}
          accent="bg-amber-500"
          onSelect={() => state.setActiveTab("info")}
        />
        {state.hasGeoTab && (
          <PanelTab
            label="Geography"
            active={state.activeTab === "geography"}
            accent="bg-emerald-500"
            onSelect={() => state.setActiveTab("geography")}
          />
        )}
      </div>

      {/* Body */}
      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {state.activeTab === "info" ? (
          <CountryInfoTab
            wikiRichIntro={state.wikiRichIntro}
            wikiSections={state.wikiSections ?? []}
            wikiImages={state.wikiImages ?? []}
            displayName={state.displayName}
            introExpanded={state.introExpanded}
            setIntroExpanded={state.setIntroExpanded}
            setLightboxSrc={state.setLightboxSrc}
          />
        ) : state.activeTab === "geography" && state.hasGeoTab && country.countryId ? (
          <GeoProfileContent countryId={country.countryId} countryName={country.displayName} />
        ) : !country.countryId ? (
          <UnclaimedTerritoryView
            country={country}
            wikiRichIntro={state.wikiRichIntro}
            introExpanded={state.introExpanded}
            setIntroExpanded={state.setIntroExpanded}
          />
        ) : state.isLoading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading country details">
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-6 w-32 rounded" />
          </div>
        ) : state.summary ? (
          <CountryOverviewTab
            country={country}
            summary={state.summary}
            sovereignty={state.sovereignty}
            neighbors={state.neighbors}
            wikiRichIntro={state.wikiRichIntro}
            isOwner={state.isOwner}
            onNeighborClick={state.handleNeighborClick}
            onGeographyFilter={onGeographyFilter}
            onEditMap={onEditMap}
            setActiveTab={state.setActiveTab}
            setActiveModal={state.setActiveModal}
          />
        ) : (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Details for this country aren&apos;t available right now.
          </p>
        )}
      </div>
    </>
  );
}

/** Compact peek content for the mobile bottom sheet. */
export function CountryPeekContent({ state }: { state: PanelState }) {
  return (
    <div className="flex items-center gap-3">
      {/* Flag */}
      {state.flagUrl ? (
        <img
          src={state.flagUrl}
          alt=""
          className="border-border h-8 w-12 rounded-sm border object-cover"
        />
      ) : (
        <div className="border-border bg-muted h-8 w-12 rounded-sm border" />
      )}

      {/* Name + stats */}
      <div className="min-w-0 flex-1">
        <h3 className="text-foreground truncate text-sm font-semibold">{state.displayName}</h3>
        {state.summary && (
          <div className="text-muted-foreground flex gap-3 text-xs">
            <span>
              GDP:{" "}
              {formatCompactCurrency(state.summary.totalGdp ?? (state.summary as any).gdp, "—")}
            </span>
            <span>Pop: {formatCompactNumber(state.summary.population, "—")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

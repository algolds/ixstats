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

const GeoProfileContent = dynamic(
  () => import("./GeoProfileContent").then((m) => ({ default: m.GeoProfileContent })),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center py-12">
        <div className="border-muted-foreground/20 h-5 w-5 animate-spin rounded-full border-2 border-t-emerald-500" />
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
      <div className="border-border/50 flex border-b px-4">
        <button
          onClick={() => state.setActiveTab("overview")}
          className={`relative px-3 py-2 text-xs font-medium transition-colors ${
            state.activeTab === "overview"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Overview
          {state.activeTab === "overview" && (
            <span className="bg-primary absolute inset-x-0 bottom-0 h-0.5 rounded-full" />
          )}
        </button>
        <button
          onClick={() => state.setActiveTab("info")}
          className={`relative px-3 py-2 text-xs font-medium transition-colors ${
            state.activeTab === "info"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Info
          {state.activeTab === "info" && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-amber-500" />
          )}
        </button>
        {state.hasGeoTab && (
          <button
            onClick={() => state.setActiveTab("geography")}
            className={`relative px-3 py-2 text-xs font-medium transition-colors ${
              state.activeTab === "geography"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Geography
            {state.activeTab === "geography" && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-emerald-500" />
            )}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(100% - 90px)" }}>
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
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-muted h-14 animate-pulse rounded-lg" />
              ))}
            </div>
            <div className="bg-muted h-6 w-32 animate-pulse rounded" />
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
        ) : null}
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
            <span>GDP: {formatCompact(state.summary.gdp)}</span>
            <span>Pop: {formatCompact(state.summary.population)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatCompact(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

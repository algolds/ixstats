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
import { FacetTabs } from "~/components/ui/facet";

const COUNTRY_TABS = [
  { id: "overview", label: "Overview" },
  { id: "info", label: "Info" },
];

const GeoProfileContent = dynamic(
  () => import("./GeoProfileContent").then((m) => ({ default: m.GeoProfileContent })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3 py-2" aria-busy="true" aria-label="Loading geography">
        <Skeleton className="rounded-control h-24 w-full" />
        <Skeleton className="h-4 w-2/3 rounded-xs" />
        <Skeleton className="h-4 w-1/2 rounded-xs" />
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
      <div className="border-separator shrink-0 border-b px-4 py-2">
        <FacetTabs
          tabs={
            state.hasGeoTab
              ? [...COUNTRY_TABS, { id: "geography", label: "Geography" }]
              : COUNTRY_TABS
          }
          activeTab={state.activeTab}
          onChange={(id) => state.setActiveTab(id as PanelState["activeTab"])}
          size="sm"
          tone="neutral"
          showTexture={false}
          className="w-full"
        />
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
                <Skeleton key={i} className="rounded-control h-14" />
              ))}
            </div>
            <Skeleton className="rounded-control-sm h-6 w-32" />
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
          <p className="text-label-secondary text-body py-8 text-center">
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
          className="border-separator rounded-control-sm h-8 w-12 border object-cover"
        />
      ) : (
        <div className="border-separator bg-fill-3 rounded-control-sm h-8 w-12 border" />
      )}

      {/* Name + stats */}
      <div className="min-w-0 flex-1">
        <h3 className="text-label text-headline truncate">{state.displayName}</h3>
        {state.summary && (
          <div className="text-label-secondary text-footnote flex gap-3">
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

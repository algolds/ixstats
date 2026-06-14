"use client";

/**
 * CountryInfoPanel - Slide-out panel for country details on the map.
 *
 * Desktop: Right-side panel. Mobile: Bottom sheet.
 * Shows economic data (clickable for modals), wiki intro, wiki sections TOC,
 * media gallery, sovereignty, and neighbors.
 */

import { memo } from "react";
import { X } from "lucide-react";
import type { SelectedCountry } from "./IxWorldMap";
import { SwipeableBottomSheet } from "./SwipeableBottomSheet";

// Lazy import modals and geo profile to avoid bloating the initial map bundle
import dynamic from "next/dynamic";

// Extracted subcomponents, hooks, and helpers
import { useCountryInfoPanelState } from "~/components/maps/core/hooks/useCountryInfoPanelState";
import { CountryOverviewTab } from "~/components/maps/core/components/CountryOverviewTab";
import { CountryInfoTab } from "~/components/maps/core/components/CountryInfoTab";
import { UnclaimedTerritoryView } from "~/components/maps/core/components/UnclaimedTerritoryView";
import { ImageLightbox } from "~/components/maps/core/components/ImageLightbox";

const GdpDetailsModal = dynamic(
  () => import("~/components/modals/GdpDetailsModal").then((m) => ({ default: m.GdpDetailsModal })),
  { ssr: false }
);
const PopulationDetailsModal = dynamic(
  () =>
    import("~/components/modals/PopulationDetailsModal").then((m) => ({
      default: m.PopulationDetailsModal,
    })),
  { ssr: false }
);
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

interface CountryInfoPanelProps {
  country: SelectedCountry;
  onClose: () => void;
  onNeighborClick?: (neighbor: {
    featureId: string;
    countryId: string | null;
    displayName: string;
    centroidLng?: number;
    centroidLat?: number;
  }) => void;
  onGeographyFilter?: (filter: { type: "continent" | "region"; value: string } | null) => void;
  onEditMap?: () => void;
}

export const CountryInfoPanel = memo(function CountryInfoPanel({
  country,
  onClose,
  onNeighborClick,
  onGeographyFilter,
  onEditMap,
}: CountryInfoPanelProps) {
  const state = useCountryInfoPanelState({
    country,
    onNeighborClick,
  });

  const panelContent = (
    <>
      {/* Header */}
      <div className="border-border/50 flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2.5 overflow-hidden">
          {state.flagUrl ? (
            <img
              src={state.flagUrl}
              alt=""
              className="border-border h-6 w-9 rounded-sm border object-cover"
            />
          ) : (
            <div
              className="border-border h-6 w-9 rounded-sm border"
              style={{ backgroundColor: country.fillColor }}
            />
          )}
          <h3 className="text-foreground truncate text-base font-semibold">{state.displayName}</h3>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded-full p-1.5 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

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
        {/* Info tab — wiki content */}
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
          /* Unclaimed territory */
          <UnclaimedTerritoryView
            country={country}
            wikiRichIntro={state.wikiRichIntro}
            introExpanded={state.introExpanded}
            setIntroExpanded={state.setIntroExpanded}
          />
        ) : state.isLoading ? (
          /* Loading skeleton */
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

  return (
    <>
      {/* Desktop: Right-side panel */}
      <div
        className="absolute top-0 right-0 z-20 hidden h-full w-96 sm:block"
        style={{ animation: "slideInRight 0.25s ease-out" }}
      >
        <div className="bg-card h-full shadow-xl">{panelContent}</div>
      </div>

      {/* Mobile: Swipeable bottom sheet */}
      <SwipeableBottomSheet onClose={onClose}>{panelContent}</SwipeableBottomSheet>

      {/* Image lightbox */}
      {state.lightboxSrc && (
        <ImageLightbox src={state.lightboxSrc} onClose={() => state.setLightboxSrc(null)} />
      )}

      {/* Metric detail modals */}
      {state.activeModal === "gdp" && state.summary && (
        <GdpDetailsModal
          isOpen
          onClose={() => state.setActiveModal(null)}
          countryId={state.summary.id}
          countryName={state.summary.name}
        />
      )}
      {state.activeModal === "population" && state.summary && (
        <PopulationDetailsModal
          isOpen
          onClose={() => state.setActiveModal(null)}
          countryId={state.summary.id}
          countryName={state.summary.name}
        />
      )}

      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
});

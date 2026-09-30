"use client";

/**
 * CountryInfoPanel - Slide-out panel for country details on the map.
 *
 * Desktop: Right-side panel. Mobile: Snap bottom sheet.
 * Shows economic data (clickable for modals), wiki intro, wiki sections TOC,
 * media gallery, sovereignty, and neighbors.
 */

import { memo } from "react";
import { Xmark as X } from "iconoir-react";
import type { SelectedCountry } from "./IxWorldMap";
import { SnapBottomSheet } from "./SnapBottomSheet";
import { useIsMobile } from "~/hooks/useIsMobile";
import { Button } from "~/components/ui/button";
import { FacetContainer } from "~/components/ui/facet-container";
import { CountryInfoContent, CountryPeekContent } from "./CountryInfoContent";

// Lazy import modals and geo profile to avoid bloating the initial map bundle
import dynamic from "next/dynamic";

// Extracted subcomponents, hooks, and helpers
import { useCountryInfoPanelState } from "~/components/maps/core/hooks/useCountryInfoPanelState";
import { ImageLightbox } from "~/components/maps/core/components/ImageLightbox";

const GdpDetailsModal = dynamic(
  () =>
    import("~/components/mycountry/shared/modals/metric-details/GdpDetailsModal").then((m) => ({
      default: m.GdpDetailsModal,
    })),
  { ssr: false }
);
const PopulationDetailsModal = dynamic(
  () =>
    import("~/components/mycountry/shared/modals/metric-details/PopulationDetailsModal").then(
      (m) => ({
        default: m.PopulationDetailsModal,
      })
    ),
  { ssr: false }
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
  const isMobile = useIsMobile();
  const state = useCountryInfoPanelState({
    country,
    onNeighborClick,
  });

  const desktopContent = (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      role="complementary"
      aria-label={`${state.displayName} details`}
      className="absolute top-0 right-0 z-20 hidden h-full w-96 sm:block"
      style={{ animation: "slideInRight 0.25s ease-out" }}
    >
      <FacetContainer depth={2} className="flex h-full flex-col rounded-none">
        {/* Header */}
        <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-3">
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
            <h3 className="text-foreground truncate text-base font-semibold">
              {state.displayName}
            </h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close country panel"
            title="Close (Esc)"
            className="text-muted-foreground h-8 w-8 shrink-0 rounded-full"
          >
            <X aria-hidden />
          </Button>
        </div>

        <CountryInfoContent
          country={country}
          state={state}
          onGeographyFilter={onGeographyFilter}
          onEditMap={onEditMap}
        />
      </FacetContainer>
    </div>
  );

  return (
    <>
      {/* Desktop View */}
      {!isMobile && desktopContent}

      {/* Mobile View */}
      {isMobile && (
        <SnapBottomSheet onClose={onClose} peekContent={<CountryPeekContent state={state} />}>
          <CountryInfoContent
            country={country}
            state={state}
            onGeographyFilter={onGeographyFilter}
            onEditMap={onEditMap}
          />
        </SnapBottomSheet>
      )}

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

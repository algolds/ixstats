"use client";

import { memo } from "react";
import { Xmark as X } from "iconoir-react";
import type { NeighborTarget, SelectedCountry } from "./IxWorldMap";
import { SnapBottomSheet } from "./SnapBottomSheet";
import { useIsMobile } from "~/hooks/useIsMobile";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import { CountryInfoContent, CountryPeekContent } from "./CountryInfoContent";

import dynamic from "next/dynamic";

import { useCountryInfoPanelState } from "~/components/maps/core/hooks/useCountryInfoPanelState";
import { ImageLightbox } from "~/components/maps/core/components/ImageLightbox";

// Lazy so the metric modals stay out of the initial map bundle
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
  onNeighborClick?: (neighbor: NeighborTarget) => void;
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
      <FacetMaterial layer="chrome" className="flex h-full flex-col rounded-none">
        <div className="border-separator flex shrink-0 items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 overflow-hidden">
            {state.flagUrl ? (
              <img
                src={state.flagUrl}
                alt=""
                className="border-separator rounded-control-sm h-6 w-9 border object-cover"
              />
            ) : (
              <div
                className="border-separator rounded-control-sm h-6 w-9 border"
                style={{ backgroundColor: country.fillColor }}
              />
            )}
            <h3 className="text-label text-title-3 truncate">{state.displayName}</h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close country panel"
            title="Close (Esc)"
            className="text-label-secondary h-8 w-8 shrink-0 rounded-full"
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
      </FacetMaterial>
    </div>
  );

  return (
    <>
      {!isMobile && desktopContent}

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

      {state.lightboxSrc && (
        <ImageLightbox src={state.lightboxSrc} onClose={() => state.setLightboxSrc(null)} />
      )}

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

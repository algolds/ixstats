"use client";

import type { RefObject } from "react";
import type { useMapPinInfo } from "~/hooks/useMapPinInfo";
import { CountryInfoPanel } from "../CountryInfoPanel";
import { FeatureInfoPanel } from "../FeatureInfoPanel";
import { StoryPinModal } from "../StoryPinModal";
import { RouteInfoPanel } from "../RouteInfoPanel";
import MapPinInfoPanel from "../MapPinInfoPanel";
import type { IxWorldMapRef } from "../IxWorldMap";
import type { useMapState } from "../hooks/useMapState";

type MapState = ReturnType<typeof useMapState>;
type MapPin = ReturnType<typeof useMapPinInfo>;

export interface MapInfoPanelsProps {
  state: MapState;
  pin: MapPin;
  mapRef: RefObject<IxWorldMapRef | null>;
  countryPanelOpen: boolean;
  featurePanelOpen: boolean;
  canEdit: boolean;
}

/** The map's info panels: dropped pin, selected country / feature, story pin modal, route. */
export function MapInfoPanels({
  state,
  pin,
  mapRef,
  countryPanelOpen,
  featurePanelOpen,
  canEdit,
}: MapInfoPanelsProps) {
  const { selectedCountry, selectedFeature, storyPinModalId, selectedRouteId } = state;
  return (
    <>
      {pin.isPinToolActive && pin.pinPosition && (
        <MapPinInfoPanel
          pinPosition={pin.pinPosition}
          clientResult={pin.clientResult}
          serverResult={pin.serverResult}
          isServerLoading={pin.isServerLoading}
          onClose={pin.clearPin}
        />
      )}

      {countryPanelOpen && selectedCountry && (
        <CountryInfoPanel
          key={selectedCountry.featureId}
          country={selectedCountry}
          onClose={state.handleClosePanel}
          onNeighborClick={state.handleNeighborClick}
          onGeographyFilter={state.setGeographyFilter}
          onEditMap={state.handleEditMap}
        />
      )}

      {featurePanelOpen && selectedFeature && (
        <FeatureInfoPanel
          feature={selectedFeature}
          onClose={() => state.setSelectedFeature(null)}
          onOpenStoryModal={(pinId) => {
            state.setStoryPinModalId(pinId);
            state.setSelectedFeature(null);
          }}
        />
      )}

      {storyPinModalId && (
        <StoryPinModal
          pinId={storyPinModalId}
          onClose={() => state.setStoryPinModalId(null)}
          onFlyTo={(lng, lat) => mapRef.current?.flyTo(lng, lat, 8)}
          onNavigateToPin={state.setStoryPinModalId}
        />
      )}

      {selectedRouteId && !state.isEditing && (
        <RouteInfoPanel
          routeId={selectedRouteId}
          onClose={() => state.setSelectedRouteId(null)}
          canEdit={canEdit}
        />
      )}
    </>
  );
}

'use client';

import { useState, useCallback } from 'react';
import GoogleMapContainer from '~/components/maps/GoogleMapContainer';
import GoogleSearchBar from '~/components/maps/GoogleSearchBar';
import GoogleInfoWindow from '~/components/maps/GoogleInfoWindow';
import GoogleMapControls from '~/components/maps/GoogleMapControls';

export default function MapsPage() {
  const [selectedCountry, setSelectedCountry] = useState<{
    id: string;
    name: string;
    position: { x: number; y: number };
  } | null>(null);
  const [mapType, setMapType] = useState<'map' | 'climate' | 'terrain'>('map');

  const handleCountryClick = useCallback((countryId: string, countryName: string, position: { x: number; y: number }) => {
    if (countryId) {
      setSelectedCountry({ id: countryId, name: countryName, position });
    } else {
      setSelectedCountry(null);
    }
  }, []);

  const handleCountrySelect = useCallback((countryId: string, countryName: string) => {
    // When selected from search, position in center of screen
    const position = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    setSelectedCountry({ id: countryId, name: countryName, position });
  }, []);

  const handleCloseInfo = useCallback(() => {
    setSelectedCountry(null);
  }, []);

  const handleZoomIn = useCallback(() => {
    (window as any).__mapZoomIn?.();
  }, []);

  const handleZoomOut = useCallback(() => {
    (window as any).__mapZoomOut?.();
  }, []);

  return (
    <div className="relative h-screen w-full bg-gray-100">
      {/* Map Container */}
      <GoogleMapContainer
        onCountryClick={handleCountryClick}
        selectedCountryId={selectedCountry?.id}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        mapType={mapType}
      />

      {/* Search Bar */}
      <GoogleSearchBar onCountrySelect={handleCountrySelect} />

      {/* Map Controls */}
      <GoogleMapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        mapType={mapType}
        onMapTypeChange={setMapType}
      />

      {/* Info Window */}
      {selectedCountry && selectedCountry.id && (
        <GoogleInfoWindow
          countryId={selectedCountry.id}
          countryName={selectedCountry.name}
          position={selectedCountry.position}
          onClose={handleCloseInfo}
        />
      )}

      {/* Google Maps Attribution Style */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded text-xs text-gray-600">
          IxStats Maps © 2025
        </div>
      </div>
    </div>
  );
}

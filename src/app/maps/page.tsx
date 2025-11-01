'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import GoogleMapContainer from '~/components/maps/GoogleMapContainer';
import GoogleSearchBar from '~/components/maps/GoogleSearchBar';
import GoogleInfoWindow from '~/components/maps/GoogleInfoWindow';
import GoogleMapControls from '~/components/maps/GoogleMapControls';
import GoogleHamburgerMenu, { loadMapSettings, getDefaultMapSettings } from '~/components/maps/GoogleHamburgerMenu';
import MapScale from '~/components/maps/measurement/MapScale';
import { DistanceMeasurement, type MeasurementResult } from '~/components/maps/measurement';
import type { ProjectionType } from '~/types/maps';

export default function MapsPage() {
  // Country selection state
  const [selectedCountry, setSelectedCountry] = useState<{
    id: string;
    name: string;
    position: { x: number; y: number };
  } | null>(null);

  // Hamburger menu state
  const [menuOpen, setMenuOpen] = useState(false);

  // Layer visibility state
  const [layers, setLayers] = useState({
    boundaries: true,
    subdivisions: true,
    cities: true,
    pois: true,
  });

  // Measurement tools state
  const [measurementMode, setMeasurementMode] = useState<'distance' | 'area' | null>(null);
  const [showScale, setShowScale] = useState(true);
  const [measurementResults, setMeasurementResults] = useState<MeasurementResult[]>([]);

  // View options state
  const [showLabels, setShowLabels] = useState(true);
  const [showBorders, setShowBorders] = useState(true);
  const [mapType, setMapType] = useState<'map' | 'climate' | 'terrain'>('map');
  const [projection, setProjection] = useState<ProjectionType>('globe');

  // Map instance ref
  const mapInstanceRef = useRef<any>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = loadMapSettings();
    if (savedSettings) {
      setLayers(savedSettings.layers);
      setShowScale(savedSettings.showScale);
      setShowLabels(savedSettings.showLabels);
      setShowBorders(savedSettings.showBorders);
      setMapType(savedSettings.mapType);
      if (savedSettings.projection) {
        setProjection(savedSettings.projection);
      }
      // Don't restore measurement mode - it should always start as null
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'ixstats-map-settings',
        JSON.stringify({
          layers,
          showScale,
          showLabels,
          showBorders,
          mapType,
          projection,
        })
      );
    }
  }, [layers, showScale, showLabels, showBorders, mapType, projection]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // ESC - Close menu or cancel measurement
      if (e.key === 'Escape') {
        if (menuOpen) {
          setMenuOpen(false);
        } else if (measurementMode) {
          setMeasurementMode(null);
        }
      }

      // M - Toggle menu
      if (e.key === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setMenuOpen((prev) => !prev);
      }

      // D - Distance measurement
      if (e.key === 'd' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setMeasurementMode((prev) => (prev === 'distance' ? null : 'distance'));
      }

      // A - Area measurement
      if (e.key === 'a' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setMeasurementMode((prev) => (prev === 'area' ? null : 'area'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen, measurementMode]);

  const handleCountryClick = useCallback(
    (countryId: string, countryName: string, position: { x: number; y: number }) => {
      if (countryId) {
        setSelectedCountry({ id: countryId, name: countryName, position });
      } else {
        setSelectedCountry(null);
      }
    },
    []
  );

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

  const handleMapReady = useCallback((map: any) => {
    mapInstanceRef.current = map;
    // Also expose globally for search bar
    (window as any).__mainMapInstance = map;
  }, []);

  const handleMeasurementComplete = useCallback((result: MeasurementResult) => {
    setMeasurementResults((prev) => [...prev, result]);

    // Show toast notification
    if (result.type === 'distance') {
      toast.success(
        `Distance: ${result.distanceKm?.toFixed(2)} km / ${result.distanceMi?.toFixed(2)} mi`
      );
    } else if (result.type === 'area') {
      toast.success(
        `Area: ${result.areaKm2?.toFixed(2)} km² / ${result.areaMi2?.toFixed(2)} mi²`
      );
    }

    // Auto-clear measurement mode after completion
    setMeasurementMode(null);
  }, []);

  const handleClearMeasurement = useCallback((index: number) => {
    setMeasurementResults((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearAllMeasurements = useCallback(() => {
    setMeasurementResults([]);
    toast.success('All measurements cleared');
  }, []);

  const handleMenuOpen = useCallback(() => {
    setMenuOpen(true);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const handleLayerToggle = useCallback((layer: string, visible: boolean) => {
    setLayers((prev) => ({ ...prev, [layer]: visible }));
  }, []);

  const handleProjectionChange = useCallback((newProjection: ProjectionType) => {
    setProjection(newProjection);
    toast.success(`Switched to ${newProjection} projection`);
  }, []);

  return (
    <div className="relative h-screen w-full bg-gray-100">
      {/* Toast Notifications */}
      <Toaster position="top-right" />

      {/* Map Container */}
      <GoogleMapContainer
        onCountryClick={handleCountryClick}
        selectedCountryId={selectedCountry?.id}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        mapType={mapType}
        projection={projection}
        onProjectionChange={handleProjectionChange}
        onMapReady={handleMapReady}
      />

      {/* Search Bar */}
      <GoogleSearchBar
        onCountrySelect={handleCountrySelect}
        onMenuClick={handleMenuOpen}
      />

      {/* Hamburger Menu */}
      <GoogleHamburgerMenu
        isOpen={menuOpen}
        onClose={handleMenuClose}
        layers={layers}
        onLayerToggle={handleLayerToggle}
        measurementMode={measurementMode}
        onMeasurementModeChange={setMeasurementMode}
        showScale={showScale}
        onShowScaleChange={setShowScale}
        mapType={mapType}
        onMapTypeChange={setMapType}
        projection={projection}
        onProjectionChange={handleProjectionChange}
        showLabels={showLabels}
        onShowLabelsChange={setShowLabels}
        showBorders={showBorders}
        onShowBordersChange={setShowBorders}
      />

      {/* Map Controls */}
      <GoogleMapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        mapType={mapType}
        onMapTypeChange={setMapType}
      />

      {/* Map Scale */}
      {showScale && mapInstanceRef.current && (
        <MapScale
          map={mapInstanceRef.current}
          position="bottom-left"
          showImperial={true}
          showMetric={true}
          currentProjection={projection}
        />
      )}

      {/* Distance Measurement Tool */}
      {measurementMode && mapInstanceRef.current && (
        <DistanceMeasurement
          map={mapInstanceRef.current}
          active={measurementMode !== null}
          onComplete={handleMeasurementComplete}
        />
      )}

      {/* Measurement Results Panel */}
      {measurementResults.length > 0 && (
        <div className="absolute bottom-24 right-4 z-10 w-80">
          <div className="bg-white/95 backdrop-blur-xl rounded-lg border border-gray-200 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Measurements ({measurementResults.length})
              </h3>
              <button
                onClick={handleClearAllMeasurements}
                className="text-xs text-red-600 hover:text-red-700 transition-colors"
              >
                Clear All
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {measurementResults.map((result, index) => (
                <div
                  key={index}
                  className="bg-white/50 rounded p-2 text-sm border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize text-gray-800">
                      {result.type}
                    </span>
                    <button
                      onClick={() => handleClearMeasurement(index)}
                      className="text-red-600 hover:text-red-700 transition-colors"
                      title="Remove measurement"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {result.type === 'distance' && (
                    <div className="text-gray-600 mt-1">
                      <div>{result.distanceKm?.toFixed(2)} km</div>
                      <div className="text-xs text-gray-500">
                        {result.distanceMi?.toFixed(2)} mi
                      </div>
                    </div>
                  )}

                  {result.type === 'area' && (
                    <>
                      <div className="text-gray-600 mt-1">
                        <div className="font-medium">
                          Area: {result.areaKm2?.toFixed(2)} km²
                        </div>
                        <div className="text-xs text-gray-500">
                          {result.areaMi2?.toFixed(2)} mi²
                        </div>
                      </div>
                      <div className="text-gray-600 mt-1 pt-1 border-t border-gray-200">
                        <div className="text-xs">
                          Perimeter: {result.distanceKm?.toFixed(2)} km
                        </div>
                        <div className="text-xs text-gray-500">
                          {result.distanceMi?.toFixed(2)} mi
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
          IxMaps™
        </div>
      </div>
    </div>
  );
}

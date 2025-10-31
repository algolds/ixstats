/**
 * CityPlacement Component Usage Example
 *
 * This file demonstrates how to integrate the CityPlacement component
 * with a map interface for city marker placement.
 */

"use client";

import React, { useState } from "react";
import { CityPlacement } from "./CityPlacement";

// Example integration with a map component
export function CityPlacementExample() {
  const [placedCities, setPlacedCities] = useState<any[]>([]);

  // Example country bounds (replace with actual country bounds)
  const countryBounds = {
    minLat: 35.0,
    maxLat: 42.0,
    minLng: -10.0,
    maxLng: -5.0,
  };

  const handleCityPlaced = (city: any) => {
    console.log("City placed:", city);
    setPlacedCities((prev) => [...prev, city]);
  };

  const handleCityUpdated = (city: any) => {
    console.log("City updated:", city);
    setPlacedCities((prev) =>
      prev.map((c) => (c.id === city.id ? city : c))
    );
  };

  const handleCityDeleted = (cityId: string) => {
    console.log("City deleted:", cityId);
    setPlacedCities((prev) => prev.filter((c) => c.id !== cityId));
  };

  return (
    <div className="flex h-screen">
      {/* Map Container (replace with actual map component) */}
      <div className="flex-1 bg-slate-800">
        <div className="flex h-full items-center justify-center text-white">
          Map Component Goes Here
          <br />
          (MapLibre GL JS, Leaflet, etc.)
        </div>
      </div>

      {/* City Placement Sidebar */}
      <div className="w-96 bg-slate-900">
        <CityPlacement
          countryId="example-country-id"
          countryBounds={countryBounds}
          onCityPlaced={handleCityPlaced}
          onCityUpdated={handleCityUpdated}
          onCityDeleted={handleCityDeleted}
        />
      </div>
    </div>
  );
}

/**
 * Usage with Leaflet.js:
 *
 * import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
 * import L from 'leaflet';
 *
 * function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
 *   useMapEvents({
 *     click: (e) => {
 *       onMapClick(e.latlng.lat, e.latlng.lng);
 *     },
 *   });
 *   return null;
 * }
 *
 * function CityPlacementMap() {
 *   const [selectedCoords, setSelectedCoords] = useState<{lat: number, lng: number} | null>(null);
 *
 *   return (
 *     <div className="flex h-screen">
 *       <div className="flex-1">
 *         <MapContainer center={[38.5, -7.5]} zoom={7}>
 *           <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
 *           <MapClickHandler onMapClick={(lat, lng) => setSelectedCoords({ lat, lng })} />
 *           {selectedCoords && (
 *             <Marker position={[selectedCoords.lat, selectedCoords.lng]}>
 *               <Popup>Selected Location</Popup>
 *             </Marker>
 *           )}
 *         </MapContainer>
 *       </div>
 *       <div className="w-96">
 *         <CityPlacement
 *           countryId="country-123"
 *           countryBounds={{ minLat: 35, maxLat: 42, minLng: -10, maxLng: -5 }}
 *         />
 *       </div>
 *     </div>
 *   );
 * }
 */

/**
 * Usage with MapLibre GL JS:
 *
 * import maplibregl from 'maplibre-gl';
 * import { useEffect, useRef } from 'react';
 *
 * function CityPlacementMapLibre() {
 *   const mapContainer = useRef<HTMLDivElement>(null);
 *   const map = useRef<maplibregl.Map | null>(null);
 *
 *   useEffect(() => {
 *     if (!mapContainer.current) return;
 *
 *     map.current = new maplibregl.Map({
 *       container: mapContainer.current,
 *       style: 'https://demotiles.maplibre.org/style.json',
 *       center: [-7.5, 38.5],
 *       zoom: 7,
 *     });
 *
 *     map.current.on('click', (e) => {
 *       console.log('Clicked at:', e.lngLat);
 *       // Pass coordinates to CityPlacement component
 *     });
 *
 *     return () => {
 *       map.current?.remove();
 *     };
 *   }, []);
 *
 *   return (
 *     <div className="flex h-screen">
 *       <div ref={mapContainer} className="flex-1" />
 *       <div className="w-96">
 *         <CityPlacement countryId="country-123" />
 *       </div>
 *     </div>
 *   );
 * }
 */

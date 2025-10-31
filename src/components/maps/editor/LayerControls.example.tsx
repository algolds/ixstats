/**
 * LayerControls Usage Example
 *
 * This file demonstrates how to integrate the LayerControls component
 * into a map editor interface.
 */

"use client";

import React, { useState } from "react";
import { LayerControls } from "./LayerControls";

/**
 * Example Map Editor with Layer Controls
 *
 * Shows how to manage layer state and integrate the LayerControls component
 * with your map rendering logic.
 */
export function MapEditorWithLayerControls() {
  // Layer visibility state
  const [layers, setLayers] = useState({
    boundaries: true,
    subdivisions: true,
    cities: true,
    pois: true,
  });

  // Subdivision level filtering (1-5)
  const [subdivisionLevels, setSubdivisionLevels] = useState<number[]>([1, 2, 3, 4, 5]);

  // City type filtering
  const [cityTypes, setCityTypes] = useState<string[]>(["capital", "city", "town", "village"]);

  // POI category filtering
  const [poiCategories, setPoiCategories] = useState<string[]>([
    "civilian_cultural",
    "military_defense",
    "natural_features",
    "infrastructure_transport",
    "commercial_economic",
    "government_services",
  ]);

  // Layer opacity (0-100)
  const [opacity, setOpacity] = useState<Record<string, number>>({
    boundaries: 100,
    subdivisions: 85,
    cities: 100,
    pois: 90,
  });

  /**
   * Handle layer visibility toggle
   */
  const handleLayerToggle = (layer: keyof typeof layers, visible: boolean) => {
    setLayers((prev) => ({
      ...prev,
      [layer]: visible,
    }));

    // Update map rendering based on layer visibility
    console.log(`Layer ${layer} is now ${visible ? "visible" : "hidden"}`);
  };

  /**
   * Handle subdivision level changes
   */
  const handleSubdivisionLevelChange = (levels: number[]) => {
    setSubdivisionLevels(levels);
    console.log("Active subdivision levels:", levels);

    // Filter subdivisions based on selected levels
    // Example: filterSubdivisions(levels)
  };

  /**
   * Handle city type changes
   */
  const handleCityTypeChange = (types: string[]) => {
    setCityTypes(types);
    console.log("Active city types:", types);

    // Filter cities based on selected types
    // Example: filterCities(types)
  };

  /**
   * Handle POI category changes
   */
  const handlePoiCategoryChange = (categories: string[]) => {
    setPoiCategories(categories);
    console.log("Active POI categories:", categories);

    // Filter POIs based on selected categories
    // Example: filterPOIs(categories)
  };

  /**
   * Handle layer opacity changes
   */
  const handleOpacityChange = (layer: string, value: number) => {
    setOpacity((prev) => ({
      ...prev,
      [layer]: value,
    }));

    // Update map layer opacity
    console.log(`Layer ${layer} opacity set to ${value}%`);
    // Example: updateLayerOpacity(layer, value / 100)
  };

  return (
    <div className="relative h-screen w-screen">
      {/* Map Container */}
      <div className="h-full w-full bg-gray-100">
        {/* Your map rendering component goes here */}
        <MapCanvas
          layers={layers}
          subdivisionLevels={subdivisionLevels}
          cityTypes={cityTypes}
          poiCategories={poiCategories}
          opacity={opacity}
        />
      </div>

      {/* Layer Controls Panel */}
      <LayerControls
        layers={layers}
        onLayerToggle={handleLayerToggle}
        subdivisionLevel={subdivisionLevels}
        onSubdivisionLevelChange={handleSubdivisionLevelChange}
        cityTypes={cityTypes}
        onCityTypeChange={handleCityTypeChange}
        poiCategories={poiCategories}
        onPoiCategoryChange={handlePoiCategoryChange}
        opacity={opacity}
        onOpacityChange={handleOpacityChange}
      />
    </div>
  );
}

/**
 * Mock Map Canvas Component
 * Replace this with your actual map rendering component
 */
function MapCanvas({
  layers,
  subdivisionLevels,
  cityTypes,
  poiCategories,
  opacity,
}: {
  layers: { boundaries: boolean; subdivisions: boolean; cities: boolean; pois: boolean };
  subdivisionLevels: number[];
  cityTypes: string[];
  poiCategories: string[];
  opacity: Record<string, number>;
}) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="glass-panel max-w-md rounded-lg p-6">
        <h2 className="mb-4 text-xl font-bold text-gray-900">Map Canvas (Demo)</h2>

        <div className="space-y-3 text-sm">
          <div>
            <div className="font-semibold text-gray-700">Active Layers:</div>
            <div className="ml-2 text-gray-600">
              {Object.entries(layers)
                .filter(([, visible]) => visible)
                .map(([name]) => name)
                .join(", ") || "None"}
            </div>
          </div>

          {layers.subdivisions && (
            <div>
              <div className="font-semibold text-gray-700">Subdivision Levels:</div>
              <div className="ml-2 text-gray-600">
                {subdivisionLevels.length > 0 ? subdivisionLevels.join(", ") : "None"}
              </div>
            </div>
          )}

          {layers.cities && (
            <div>
              <div className="font-semibold text-gray-700">City Types:</div>
              <div className="ml-2 text-gray-600">
                {cityTypes.length > 0 ? cityTypes.join(", ") : "None"}
              </div>
            </div>
          )}

          {layers.pois && (
            <div>
              <div className="font-semibold text-gray-700">POI Categories:</div>
              <div className="ml-2 text-gray-600">
                {poiCategories.length > 0 ? `${poiCategories.length} selected` : "None"}
              </div>
            </div>
          )}

          <div>
            <div className="font-semibold text-gray-700">Opacity Settings:</div>
            <div className="ml-2 space-y-1 text-gray-600">
              {Object.entries(opacity).map(([layer, value]) => (
                <div key={layer}>
                  {layer}: {value}%
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Integration Tips:
 *
 * 1. **State Management**
 *    - Use the example state structure above as a starting point
 *    - Consider using a reducer for complex state management
 *    - Persist settings to localStorage for user preferences
 *
 * 2. **Map Integration**
 *    - Pass layer visibility to your map rendering component
 *    - Filter data based on subdivision levels, city types, and POI categories
 *    - Apply opacity using CSS or map library opacity settings
 *
 * 3. **Performance**
 *    - Debounce opacity changes if rendering is expensive
 *    - Memoize filtered data to avoid unnecessary recalculations
 *    - Use React.memo for the LayerControls component
 *
 * 4. **User Experience**
 *    - Save user preferences to localStorage
 *    - Add keyboard shortcuts for common actions
 *    - Consider adding preset layer configurations
 *
 * 5. **Accessibility**
 *    - The component includes full ARIA labels and keyboard navigation
 *    - Ensure your map canvas also has proper accessibility attributes
 *    - Test with screen readers and keyboard-only navigation
 *
 * Example with localStorage persistence:
 *
 * ```typescript
 * // Save preferences
 * const savePreferences = () => {
 *   localStorage.setItem('mapLayerPreferences', JSON.stringify({
 *     layers,
 *     subdivisionLevels,
 *     cityTypes,
 *     poiCategories,
 *     opacity,
 *   }));
 * };
 *
 * // Load preferences
 * const loadPreferences = () => {
 *   const saved = localStorage.getItem('mapLayerPreferences');
 *   if (saved) {
 *     const prefs = JSON.parse(saved);
 *     setLayers(prefs.layers);
 *     setSubdivisionLevels(prefs.subdivisionLevels);
 *     setCityTypes(prefs.cityTypes);
 *     setPoiCategories(prefs.poiCategories);
 *     setOpacity(prefs.opacity);
 *   }
 * };
 *
 * // Use in effect
 * useEffect(() => {
 *   loadPreferences();
 * }, []);
 * ```
 */

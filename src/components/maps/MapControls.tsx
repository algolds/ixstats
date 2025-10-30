'use client';

import { useState } from 'react';
import { Globe, Layers, Search, ChevronDown } from 'lucide-react';
import type { Map as MaplibreMap } from 'maplibre-gl';

interface MapControlsProps {
  map: MaplibreMap | null;
}

const PROJECTIONS = [
  { id: 'naturalEarth', name: 'Natural Earth' },
  { id: 'mercator', name: 'Mercator' },
  { id: 'equalEarth', name: 'Equal Earth' },
  { id: 'globe', name: 'Globe 3D' },
];

const TOGGLE_LAYERS = [
  { id: 'lakes-fill', name: 'Water Bodies' },
  { id: 'country-labels', name: 'Country Labels' },
];

export default function MapControls({ map }: MapControlsProps) {
  const [currentProjection, setCurrentProjection] = useState('naturalEarth');
  const [showProjectionMenu, setShowProjectionMenu] = useState(false);
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showSearchMenu, setShowSearchMenu] = useState(false);
  const [layerStates, setLayerStates] = useState<Record<string, boolean>>({
    'lakes-fill': true,
    'country-labels': true,
  });

  const handleProjectionChange = (projectionId: string) => {
    setCurrentProjection(projectionId);
    setShowProjectionMenu(false);
    if (map) {
      map.setProjection({ type: projectionId as any });
    }
  };

  const handleLayerToggle = (layerId: string) => {
    const newState = !layerStates[layerId];
    setLayerStates(prev => ({ ...prev, [layerId]: newState }));

    if (map && map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', newState ? 'visible' : 'none');
    }
  };

  const closeAllMenus = () => {
    setShowProjectionMenu(false);
    setShowLayerMenu(false);
    setShowSearchMenu(false);
  };

  const currentProj = PROJECTIONS.find(p => p.id === currentProjection);

  return (
    <>
      {/* Google Maps-style controls - Top Left */}
      <div className="absolute left-4 top-4 z-[1000] flex gap-2">
        {/* Projection Switcher */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProjectionMenu(!showProjectionMenu);
              setShowLayerMenu(false);
              setShowSearchMenu(false);
            }}
            className="bg-white hover:bg-gray-50 shadow-md rounded px-3 py-2 flex items-center gap-2 transition-colors border border-gray-200"
            title="Change Projection"
          >
            <Globe className="h-4 w-4 text-gray-700" />
            <span className="text-sm font-medium text-gray-700">{currentProj?.name}</span>
            <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${showProjectionMenu ? 'rotate-180' : ''}`} />
          </button>

          {showProjectionMenu && (
            <div className="absolute left-0 top-full mt-2 bg-white rounded shadow-lg overflow-hidden min-w-[160px] border border-gray-200">
              {PROJECTIONS.map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => handleProjectionChange(proj.id)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                    proj.id === currentProjection ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                  }`}
                >
                  {proj.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Layer Toggles */}
        <div className="relative">
          <button
            onClick={() => {
              setShowLayerMenu(!showLayerMenu);
              setShowProjectionMenu(false);
              setShowSearchMenu(false);
            }}
            className="bg-white hover:bg-gray-50 shadow-md rounded px-3 py-2 flex items-center gap-2 transition-colors border border-gray-200"
            title="Toggle Layers"
          >
            <Layers className="h-4 w-4 text-gray-700" />
            <span className="text-sm font-medium text-gray-700">Layers</span>
            <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${showLayerMenu ? 'rotate-180' : ''}`} />
          </button>

          {showLayerMenu && (
            <div className="absolute left-0 top-full mt-2 bg-white rounded shadow-lg overflow-hidden min-w-[180px] border border-gray-200">
              {TOGGLE_LAYERS.map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => handleLayerToggle(layer.id)}
                  className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <span className="text-sm text-gray-700">{layer.name}</span>
                  <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
                    layerStates[layer.id]
                      ? 'bg-blue-600 border-blue-600'
                      : 'bg-white border-gray-300'
                  }`}>
                    {layerStates[layer.id] && (
                      <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M10 3L4.5 8.5L2 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
              <div className="border-t border-gray-200 px-4 py-2 bg-gray-50">
                <p className="text-xs text-gray-500">Terrain and borders always visible</p>
              </div>
            </div>
          )}
        </div>

        {/* Country Search */}
        <div className="relative">
          <button
            onClick={() => {
              setShowSearchMenu(!showSearchMenu);
              setShowProjectionMenu(false);
              setShowLayerMenu(false);
            }}
            className="bg-white hover:bg-gray-50 shadow-md rounded px-3 py-2 flex items-center gap-2 transition-colors border border-gray-200"
            title="Search Countries"
          >
            <Search className="h-4 w-4 text-gray-700" />
            <span className="text-sm font-medium text-gray-700">Search</span>
          </button>

          {showSearchMenu && (
            <div className="absolute left-0 top-full mt-2 bg-white rounded shadow-lg overflow-hidden min-w-[280px] border border-gray-200 p-3">
              <input
                type="text"
                placeholder="Search countries..."
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              <div className="mt-2 text-xs text-gray-500">
                Type to search for countries
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invisible overlay to close menus */}
      {(showProjectionMenu || showLayerMenu || showSearchMenu) && (
        <div
          className="fixed inset-0 z-[999]"
          onClick={closeAllMenus}
        />
      )}
    </>
  );
}

'use client';

import { memo } from 'react';
import { Plus, Minus } from 'lucide-react';

interface GoogleMapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  mapType: 'map' | 'climate' | 'terrain';
  onMapTypeChange: (type: 'map' | 'climate' | 'terrain') => void;
}

function GoogleMapControls({
  onZoomIn,
  onZoomOut,
  mapType,
  onMapTypeChange,
}: GoogleMapControlsProps) {
  return (
    <>
      {/* Map Type Switcher */}
      <div className="absolute top-4 right-4 z-20">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden flex">
          <button
            onClick={() => onMapTypeChange('map')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mapType === 'map'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Map
          </button>
          <button
            onClick={() => onMapTypeChange('climate')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${
              mapType === 'climate'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Climate
          </button>
          <button
            onClick={() => onMapTypeChange('terrain')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${
              mapType === 'terrain'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Terrain
          </button>
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-24 right-4 z-20">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <button
            onClick={onZoomIn}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors border-b border-gray-200"
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4 text-gray-700" />
          </button>
          <button
            onClick={onZoomOut}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors"
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4 text-gray-700" />
          </button>
        </div>
      </div>
    </>
  );
}

GoogleMapControls.displayName = 'GoogleMapControls';

export default memo(GoogleMapControls);

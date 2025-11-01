'use client';

import { memo } from 'react';
import { X } from 'lucide-react';
import { api } from '~/trpc/react';
import { formatNumber } from '~/lib/ixearth-constants';

interface GoogleInfoWindowProps {
  countryId: string;
  countryName: string;
  position: { x: number; y: number };
  onClose: () => void;
}

function GoogleInfoWindow({
  countryId,
  countryName,
  position,
  onClose,
}: GoogleInfoWindowProps) {
  const { data: country, isLoading } = api.countries.getByIdBasic.useQuery(
    { id: countryId },
    { staleTime: 300000 } // Cache for 5 minutes - info window data rarely changes
  );

  return (
    <div
      className="absolute z-30 pointer-events-auto"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)',
      }}
    >
      {/* Arrow pointing to location */}
      <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-white" />

      {/* Info Window Card */}
      <div className="bg-white rounded-lg shadow-xl w-80 overflow-hidden">
        {/* Header */}
        <div className="relative">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded-full transition-colors z-10"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>

          {isLoading && (
            <div className="p-4">
              <div className="h-6 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
            </div>
          )}

          {country && (
            <>
              {/* Country Name & Flag */}
              <div className="p-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-2 pr-8">
                  {country.name}
                </h2>
                {country.flagUrl && (
                  <img
                    src={country.flagUrl}
                    alt={`${country.name} flag`}
                    className="h-12 w-auto rounded shadow"
                  />
                )}
              </div>

              {/* Stats Grid */}
              <div className="px-4 pb-4 space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-600">Population</span>
                  <span className="text-gray-900 font-medium">
                    {formatNumber(country.currentPopulation)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-600">Area</span>
                  <span className="text-gray-900 font-medium">
                    {country.landArea ? `${formatNumber(country.landArea)} sq mi` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-600">GDP per Capita</span>
                  <span className="text-gray-900 font-medium">
                    {country.currentGdpPerCapita != null ? `$${formatNumber(Math.round(country.currentGdpPerCapita))}` : 'N/A'}
                  </span>
                </div>
                {country.continent && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Continent</span>
                    <span className="text-gray-900 font-medium">{country.continent}</span>
                  </div>
                )}
              </div>

              {/* View Details Link */}
              <a
                href={`/countries/${country.slug ?? country.id}`}
                className="block px-4 py-3 text-blue-600 hover:bg-blue-50 transition-colors text-sm font-medium border-t border-gray-100"
              >
                View details →
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

GoogleInfoWindow.displayName = 'GoogleInfoWindow';

export default memo(GoogleInfoWindow);

// src/app/admin/_components/ImportPreviewDialog.tsx
"use client";

import { useState } from "react";
import { X, AlertTriangle, Plus, RefreshCw, CheckCircle, ArrowRight, ChevronDown, ChevronUp, Info } from "lucide-react";
import type { BaseCountryData } from "~/types/ixstats";

interface ImportChange {
  type: 'new' | 'update';
  country: BaseCountryData; // This now includes continent, region, etc.
  existingData?: any;
  changes?: Array<{
    field: string;
    oldValue: any;
    newValue: any;
    fieldLabel: string;
  }>;
}

interface ImportPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (replaceExisting: boolean) => void;
  changes: ImportChange[];
  isLoading: boolean;
}

const fieldLabels: Record<string, string> = {
  'country': 'Country Name',
  'continent': 'Continent',
  'region': 'Region',
  'governmentType': 'Government Type',
  'religion': 'Religion',
  'leader': 'Leader',
  'population': 'Population',
  'gdpPerCapita': 'GDP per Capita',
  'landArea': 'Land Area (km²)',
  'areaSqMi': 'Area (sq mi)',
  'maxGdpGrowthRate': 'Max GDP Growth Rate',
  'adjustedGdpGrowth': 'Adjusted GDP Growth',
  'populationGrowthRate': 'Population Growth Rate',
  'projected2040Population': '2040 Population',
  'projected2040Gdp': '2040 GDP',
  'projected2040GdpPerCapita': '2040 GDP p.c.',
  'actualGdpGrowth': 'Actual GDP Growth'
};

const formatDisplayValue = (value: any, fieldKey: string): string => {
  if (value === null || value === undefined) return 'N/A';
  
  if (typeof value === 'number') {
    if (fieldKey.toLowerCase().includes('population')) {
      return value.toLocaleString();
    }
    if (fieldKey.toLowerCase().includes('gdp') && !fieldKey.toLowerCase().includes('rate') && !fieldKey.toLowerCase().includes('growth')) {
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (fieldKey.toLowerCase().includes('rate') || fieldKey.toLowerCase().includes('growth')) {
      return `${(value * 100).toFixed(2)}%`;
    }
    if (fieldKey.toLowerCase().includes('area')) {
        return `${value.toLocaleString()} ${fieldKey.toLowerCase().includes('sqmi') ? 'sq mi' : 'km²'}`;
    }
    return value.toLocaleString();
  }
  return String(value);
};


export function ImportPreviewDialog({
  isOpen,
  onClose,
  onConfirm,
  changes,
  isLoading
}: ImportPreviewDialogProps) {
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  if (!isOpen) return null;

  const newCountries = changes.filter(c => c.type === 'new');
  const updatedCountries = changes.filter(c => c.type === 'update');

  const toggleExpandCountry = (countryName: string) => {
    setExpandedCountry(expandedCountry === countryName ? null : countryName);
  };
  
  const renderCountryDetails = (data: BaseCountryData) => {
    return (
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {Object.entries(data).map(([key, value]) => {
          if (key === 'country') return null; // Already shown as title
          const label = fieldLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          return (
            <div key={key} className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">{label}:</span>
              <span className="text-gray-800 dark:text-gray-200 font-medium text-right truncate" title={String(value)}>
                {formatDisplayValue(value, key)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Import Preview - {changes.length} Countries Found
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close dialog"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-grow scrollbar-thin">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
              <div className="flex items-center">
                <Plus className="h-6 w-6 text-green-600 dark:text-green-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    New Countries to Add
                  </p>
                  <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                    {newCountries.length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
              <div className="flex items-center">
                <RefreshCw className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Countries to Update
                  </p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                    {updatedCountries.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* New Countries Section */}
          {newCountries.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                <Plus className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                New Countries ({newCountries.length})
              </h3>
              <div className="space-y-3">
                {newCountries.map((change) => (
                  <div key={change.country.country} className="bg-green-50 dark:bg-green-900/10 rounded-lg p-3 border border-green-200 dark:border-green-800">
                    <button 
                      onClick={() => toggleExpandCountry(change.country.country)}
                      className="w-full flex justify-between items-center text-left"
                    >
                      <span className="font-medium text-green-900 dark:text-green-100">
                        {change.country.country}
                      </span>
                      {expandedCountry === change.country.country ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {expandedCountry === change.country.country && renderCountryDetails(change.country)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Updated Countries Section */}
          {updatedCountries.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                Updated Countries ({updatedCountries.length})
              </h3>
              <div className="space-y-3">
                {updatedCountries.map((change) => (
                  <div key={change.country.country} className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                     <button 
                      onClick={() => toggleExpandCountry(change.country.country)}
                      className="w-full flex justify-between items-center text-left mb-2"
                    >
                      <span className="font-medium text-blue-900 dark:text-blue-100">
                        {change.country.country}
                      </span>
                       {expandedCountry === change.country.country ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {expandedCountry === change.country.country && (
                      <>
                        {change.changes && change.changes.length > 0 ? (
                          <div className="space-y-2 text-xs">
                            {change.changes.map((fieldChange, fieldIndex) => (
                              <div key={fieldIndex} className="grid grid-cols-3 gap-2 items-center">
                                <span className="text-gray-500 dark:text-gray-400 truncate" title={fieldChange.fieldLabel}>
                                  {fieldChange.fieldLabel}:
                                </span>
                                <span className="text-gray-600 dark:text-gray-300 bg-red-50 dark:bg-red-900/20 p-1 rounded truncate" title={String(fieldChange.oldValue)}>
                                  {formatDisplayValue(fieldChange.oldValue, fieldChange.field)}
                                </span>
                                <div className="flex items-center">
                                  <ArrowRight className="h-3 w-3 text-gray-400 dark:text-gray-500 mx-1" />
                                  <span className="text-blue-800 dark:text-blue-200 font-medium bg-green-50 dark:bg-green-900/20 p-1 rounded truncate" title={String(fieldChange.newValue)}>
                                    {formatDisplayValue(fieldChange.newValue, fieldChange.field)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                           <p className="text-sm text-gray-500 dark:text-gray-400">No specific field changes detected, but file data might differ subtly or involve new fields.</p>
                        )}
                         <div className="mt-3 pt-2 border-t border-blue-200 dark:border-blue-700">
                           <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Full Proposed Data:</h4>
                           {renderCountryDetails(change.country)}
                         </div>
                       </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
           {changes.length === 0 && (
            <div className="text-center py-10">
              <Info className="h-10 w-10 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
              <p className="text-gray-700 dark:text-gray-300">No changes to import.</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">The uploaded file does not contain new countries or updates to existing ones based on current data.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-900">
          {updatedCountries.length > 0 && (
            <div className="mb-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmReplace}
                  onChange={(e) => setConfirmReplace(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Confirm updating {updatedCountries.length} existing countries with new data from the file.
                </span>
              </label>
            </div>
          )}
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus-ring"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(updatedCountries.length > 0 ? confirmReplace : false)}
              disabled={isLoading || (updatedCountries.length > 0 && !confirmReplace) || changes.length === 0}
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center focus-ring"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Import {changes.length > 0 ? `${changes.length} ${changes.length === 1 ? "Country" : "Countries"}` : "Data"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// src/app/admin/_components/ImportPreviewDialog.tsx
"use client";

import { useState } from "react";
import { X, AlertTriangle, Plus, RefreshCw, CheckCircle, ArrowRight } from "lucide-react";
import type { BaseCountryData } from "~/types/ixstats";

interface ImportChange {
  type: 'new' | 'update';
  country: BaseCountryData;
  existingData?: any; // Current country data from DB
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

export function ImportPreviewDialog({
  isOpen,
  onClose,
  onConfirm,
  changes,
  isLoading
}: ImportPreviewDialogProps) {
  const [confirmReplace, setConfirmReplace] = useState(false);

  if (!isOpen) return null;

  const newCountries = changes.filter(c => c.type === 'new');
  const updatedCountries = changes.filter(c => c.type === 'update');

  const formatValue = (value: any, field: string): string => {
    if (value === null || value === undefined) return 'N/A';
    
    if (field.includes('population') || field.includes('Population')) {
      return typeof value === 'number' ? value.toLocaleString() : value;
    }
    
    if (field.includes('gdp') || field.includes('GDP') || field.includes('growth') || field.includes('Growth')) {
      return typeof value === 'number' ? 
        (field.includes('rate') || field.includes('Rate') || field.includes('growth') || field.includes('Growth')) 
          ? `${(value * 100).toFixed(2)}%` 
          : `$${value.toLocaleString()}` 
        : value;
    }
    
    if (field.includes('area') || field.includes('Area')) {
      return typeof value === 'number' ? `${value.toLocaleString()} km²` : value;
    }
    
    return String(value);
  };

  const getFieldLabel = (field: string): string => {
    const fieldLabels: Record<string, string> = {
      'population': 'Population',
      'gdpPerCapita': 'GDP per Capita',
      'landArea': 'Land Area',
      'maxGdpGrowthRate': 'Max GDP Growth Rate',
      'adjustedGdpGrowth': 'Adjusted GDP Growth',
      'populationGrowthRate': 'Population Growth Rate',
      'projected2040Population': '2040 Population Projection',
      'projected2040Gdp': '2040 GDP Projection',
      'projected2040GdpPerCapita': '2040 GDP per Capita Projection',
      'actualGdpGrowth': 'Actual GDP Growth'
    };
    return fieldLabels[field] || field;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Import Preview - {changes.length} Countries Found
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="flex items-center">
                <Plus className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    New Countries
                  </p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {newCountries.length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-center">
                <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Updated Countries
                  </p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {updatedCountries.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* New Countries */}
          {newCountries.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                <Plus className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                New Countries ({newCountries.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {newCountries.map((change, index) => (
                  <div key={index} className="bg-green-50 dark:bg-green-900/10 rounded-lg p-3 border border-green-200 dark:border-green-800">
                    <div className="font-medium text-green-900 dark:text-green-100">
                      {change.country.country}
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Pop: {formatValue(change.country.population, 'population')} |
                      GDP p.c.: {formatValue(change.country.gdpPerCapita, 'gdpPerCapita')} |
                      Area: {formatValue(change.country.landArea, 'landArea')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Updated Countries */}
          {updatedCountries.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                Updated Countries ({updatedCountries.length})
              </h3>
              <div className="space-y-3">
                {updatedCountries.map((change, index) => (
                  <div key={index} className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <div className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                      {change.country.country}
                    </div>
                    {change.changes && change.changes.length > 0 && (
                      <div className="space-y-2">
                        {change.changes.slice(0, 5).map((fieldChange, fieldIndex) => (
                          <div key={fieldIndex} className="flex items-center text-sm">
                            <span className="text-blue-700 dark:text-blue-300 font-medium min-w-[140px]">
                              {fieldChange.fieldLabel}:
                            </span>
                            <span className="text-gray-600 dark:text-gray-400">
                              {formatValue(fieldChange.oldValue, fieldChange.field)}
                            </span>
                            <ArrowRight className="h-3 w-3 text-gray-400 mx-2" />
                            <span className="text-blue-800 dark:text-blue-200 font-medium">
                              {formatValue(fieldChange.newValue, fieldChange.field)}
                            </span>
                          </div>
                        ))}
                        {change.changes.length > 5 && (
                          <div className="text-xs text-blue-600 dark:text-blue-400">
                            ... and {change.changes.length - 5} more changes
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning for updates */}
          {updatedCountries.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Existing Data Will Be Updated
                  </h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    {updatedCountries.length} countries already exist and will be updated with new data.
                    Historical data and DM inputs will be preserved.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-900">
          {updatedCountries.length > 0 && (
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={confirmReplace}
                  onChange={(e) => setConfirmReplace(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  I confirm that I want to update existing countries with new data
                </span>
              </label>
            </div>
          )}
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(updatedCountries.length > 0 ? confirmReplace : false)}
              disabled={isLoading || (updatedCountries.length > 0 && !confirmReplace)}
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Import {changes.length} Countries
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
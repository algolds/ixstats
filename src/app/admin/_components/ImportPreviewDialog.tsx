// src/app/admin/_components/ImportPreviewDialog.tsx
"use client";

import { useState } from "react";
import {
  X,
  AlertTriangle,
  Plus,
  RefreshCw,
  CheckCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2, // Added Loader2
  Clock,
} from "lucide-react";
import type { BaseCountryData } from "~/types/ixstats";
import { IxTime } from "~/lib/ixtime";

interface ImportChange {
  type: "new" | "update";
  country: BaseCountryData;
  existingData?: BaseCountryData;
  changes?: Array<{
    field: string;
    oldValue: string | number | null;
    newValue: string | number | null;
    fieldLabel: string;
  }>;
}

interface ImportPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (replaceExisting: boolean, syncEpoch?: boolean, targetEpoch?: number) => void;
  changes: ImportChange[];
  isLoading: boolean;
}

const fieldLabels: Record<string, string> = {
  country: "Country Name",
  continent: "Continent",
  region: "Region",
  governmentType: "Government Type",
  religion: "Religion",
  leader: "Leader",
  population: "Population",
  gdpPerCapita: "GDP per Capita",
  landArea: "Land Area (km²)",
  areaSqMi: "Area (sq mi)",
  maxGdpGrowthRate: "Max GDP Growth Rate",
  adjustedGdpGrowth: "Adjusted GDP Growth",
  populationGrowthRate: "Population Growth Rate",
  projected2040Population: "2040 Population",
  projected2040Gdp: "2040 GDP",
  projected2040GdpPerCapita: "2040 GDP p.c.",
  actualGdpGrowth: "Actual GDP Growth",
};

const formatDisplayValue = (value: any, fieldKey: string): string => {
  if (value === null || value === undefined) return "N/A";

  if (typeof value === "number") {
    if (fieldKey.toLowerCase().includes("population")) {
      return value.toLocaleString();
    }
    if (
      fieldKey.toLowerCase().includes("gdp") &&
      !fieldKey.toLowerCase().includes("rate") &&
      !fieldKey.toLowerCase().includes("growth")
    ) {
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (fieldKey.toLowerCase().includes("rate") || fieldKey.toLowerCase().includes("growth")) {
      return `${(value * 100).toFixed(2)}%`;
    }
    if (fieldKey.toLowerCase().includes("area")) {
      return `${value.toLocaleString()} ${fieldKey.toLowerCase().includes("sqmi") ? "sq mi" : "km²"}`;
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
  isLoading,
}: ImportPreviewDialogProps) {
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [syncEpoch, setSyncEpoch] = useState(false);
  const [targetEpoch, setTargetEpoch] = useState<number>(IxTime.getInGameEpoch());

  if (!isOpen) return null;

  const newCountries = changes.filter((c) => c.type === "new");
  const updatedCountries = changes.filter((c) => c.type === "update");

  const toggleExpandCountry = (countryName: string) => {
    setExpandedCountry(expandedCountry === countryName ? null : countryName);
  };

  const renderCountryDetails = (data: BaseCountryData) => {
    return (
      <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {Object.entries(data).map(([key, value]) => {
          if (key === "country") return null; // Already shown as title
          const label =
            fieldLabels[key] ||
            key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
          return (
            <div key={key} className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">{label}:</span>
              <span
                className="truncate text-right font-medium text-gray-800 dark:text-gray-200"
                title={String(value)}
              >
                {formatDisplayValue(value, key)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xl">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-white/10 bg-slate-800/95 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <h2 className="text-xl font-semibold text-white">
            Import Preview - {changes.length} Countries Found
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 transition-colors hover:text-white"
            aria-label="Close dialog"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="scrollbar-thin flex-grow overflow-y-auto p-6">
          {/* Summary */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-700 dark:bg-green-900/20">
              <div className="flex items-center">
                <Plus className="mr-3 h-6 w-6 text-green-600 dark:text-green-400" />
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

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/20">
              <div className="flex items-center">
                <RefreshCw className="mr-3 h-6 w-6 text-blue-600 dark:text-blue-400" />
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
              <h3 className="mb-3 flex items-center text-lg font-medium text-gray-900 dark:text-white">
                <Plus className="mr-2 h-5 w-5 text-green-600 dark:text-green-400" />
                New Countries ({newCountries.length})
              </h3>
              <div className="space-y-3">
                {newCountries.map((change) => (
                  <div
                    key={change.country.country}
                    className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/10"
                  >
                    <button
                      onClick={() => toggleExpandCountry(change.country.country)}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <span className="font-medium text-green-900 dark:text-green-100">
                        {change.country.country}
                      </span>
                      {expandedCountry === change.country.country ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    {expandedCountry === change.country.country &&
                      renderCountryDetails(change.country)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Updated Countries Section */}
          {updatedCountries.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 flex items-center text-lg font-medium text-gray-900 dark:text-white">
                <RefreshCw className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
                Updated Countries ({updatedCountries.length})
              </h3>
              <div className="space-y-3">
                {updatedCountries.map((change) => (
                  <div
                    key={change.country.country}
                    className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/10"
                  >
                    <button
                      onClick={() => toggleExpandCountry(change.country.country)}
                      className="mb-2 flex w-full items-center justify-between text-left"
                    >
                      <span className="font-medium text-blue-900 dark:text-blue-100">
                        {change.country.country}
                      </span>
                      {expandedCountry === change.country.country ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    {expandedCountry === change.country.country && (
                      <>
                        {change.changes && change.changes.length > 0 ? (
                          <div className="space-y-2 text-xs">
                            {change.changes.map((fieldChange, fieldIndex) => (
                              <div key={fieldIndex} className="grid grid-cols-3 items-center gap-2">
                                <span
                                  className="truncate text-gray-500 dark:text-gray-400"
                                  title={fieldChange.fieldLabel}
                                >
                                  {fieldChange.fieldLabel}:
                                </span>
                                <span
                                  className="truncate rounded bg-red-50 p-1 text-gray-600 dark:bg-red-900/20 dark:text-gray-300"
                                  title={String(fieldChange.oldValue)}
                                >
                                  {formatDisplayValue(fieldChange.oldValue, fieldChange.field)}
                                </span>
                                <div className="flex items-center">
                                  <ArrowRight className="mx-1 h-3 w-3 text-gray-400 dark:text-gray-500" />
                                  <span
                                    className="truncate rounded bg-green-50 p-1 font-medium text-blue-800 dark:bg-green-900/20 dark:text-blue-200"
                                    title={String(fieldChange.newValue)}
                                  >
                                    {formatDisplayValue(fieldChange.newValue, fieldChange.field)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            No specific field changes detected, but file data might differ subtly or
                            involve new fields.
                          </p>
                        )}
                        <div className="mt-3 border-t border-blue-200 pt-2 dark:border-blue-700">
                          <h4 className="mb-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                            Full Proposed Data:
                          </h4>
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
            <div className="py-10 text-center">
              <Info className="mx-auto mb-2 h-10 w-10 text-gray-400 dark:text-gray-500" />
              <p className="text-gray-700 dark:text-gray-300">No changes to import.</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                The uploaded file does not contain new countries or updates to existing ones based
                on current data.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-900">
          {/* Epoch Sync Section */}
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
            <div className="flex items-start space-x-3">
              <Clock className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
              <div className="flex-1">
                <h4 className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                  Epoch Time Synchronization
                </h4>
                <p className="mb-3 text-xs text-amber-700 dark:text-amber-300">
                  Sync the game epoch with your imported data to ensure accurate tracking. This
                  aligns the baseline calculation date with your roster data.
                </p>

                <label className="mb-3 flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={syncEpoch}
                    onChange={(e) => setSyncEpoch(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                    Sync epoch time with imported data
                  </span>
                </label>

                {syncEpoch && (
                  <div className="ml-6 space-y-2">
                    <div className="text-xs text-amber-700 dark:text-amber-300">
                      <p>
                        <strong>Current Epoch:</strong>{" "}
                        {IxTime.formatIxTime(IxTime.getInGameEpoch())}
                      </p>
                      <p>
                        <strong>Target Epoch:</strong> {IxTime.formatIxTime(targetEpoch)}
                      </p>
                      <p>
                        <strong>Time Difference:</strong>{" "}
                        {IxTime.getYearsElapsed(IxTime.getInGameEpoch(), targetEpoch).toFixed(1)}{" "}
                        years
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <label className="text-xs text-amber-700 dark:text-amber-300">
                        Target Year:
                      </label>
                      <input
                        type="number"
                        value={new Date(targetEpoch).getFullYear()}
                        onChange={(e) => {
                          const year = parseInt(e.target.value);
                          if (!isNaN(year)) {
                            const newEpoch = IxTime.createGameTime(year, 1, 1);
                            setTargetEpoch(newEpoch);
                          }
                        }}
                        className="w-20 rounded border border-amber-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-amber-600 dark:bg-gray-800 dark:text-gray-100"
                        min="2020"
                        max="2100"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {updatedCountries.length > 0 && (
            <div className="mb-4">
              <label className="flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={confirmReplace}
                  onChange={(e) => setConfirmReplace(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Confirm updating {updatedCountries.length} existing countries with new data from
                  the file.
                </span>
              </label>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              type="button"
              className="focus-ring rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                onConfirm(
                  updatedCountries.length > 0 ? confirmReplace : false,
                  syncEpoch,
                  syncEpoch ? targetEpoch : undefined
                )
              }
              disabled={
                isLoading ||
                (updatedCountries.length > 0 && !confirmReplace) ||
                changes.length === 0
              }
              className="focus-ring flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Import{" "}
                  {changes.length > 0
                    ? `${changes.length} ${changes.length === 1 ? "Country" : "Countries"}`
                    : "Data"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

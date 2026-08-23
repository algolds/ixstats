// src/app/admin/_components/ImportPreviewDialog.tsx
"use client";

import { useState } from "react";
import { Xmark as X, Plus, Refresh as RefreshCw, CheckCircle, ArrowRight, NavArrowDown as ChevronDown, NavArrowUp as ChevronUp, InfoCircle as Info, SystemRestart as Loader2, Clock } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
              <span className="text-muted-foreground">{label}:</span>
              <span
                className="text-foreground truncate text-right font-medium"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="border-border/50 bg-card flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border shadow-2xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b p-6">
          <h2 className="text-foreground text-xl font-semibold">
            Import Preview - {changes.length} Countries Found
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="grow scrollbar-thin overflow-y-auto p-6">
          {/* Summary */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
              <div className="flex items-center">
                <Plus className="mr-3 h-6 w-6 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-700">New Countries to Add</p>
                  <p className="text-3xl font-bold text-green-800">{newCountries.length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
              <div className="flex items-center">
                <RefreshCw className="mr-3 h-6 w-6 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-700">Countries to Update</p>
                  <p className="text-3xl font-bold text-blue-800">{updatedCountries.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* New Countries Section */}
          {newCountries.length > 0 && (
            <div className="mb-6">
              <h3 className="text-foreground mb-3 flex items-center text-lg font-medium">
                <Plus className="mr-2 h-5 w-5 text-green-600" />
                New Countries ({newCountries.length})
              </h3>
              <div className="space-y-3">
                {newCountries.map((change) => (
                  <div
                    key={change.country.country}
                    className="rounded-lg border border-green-500/20 bg-green-500/10 p-3"
                  >
                    <button
                      onClick={() => toggleExpandCountry(change.country.country)}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <span className="font-medium text-green-800">{change.country.country}</span>
                      {expandedCountry === change.country.country ? (
                        <ChevronUp className="text-muted-foreground h-4 w-4" />
                      ) : (
                        <ChevronDown className="text-muted-foreground h-4 w-4" />
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
              <h3 className="text-foreground mb-3 flex items-center text-lg font-medium">
                <RefreshCw className="mr-2 h-5 w-5 text-blue-600" />
                Updated Countries ({updatedCountries.length})
              </h3>
              <div className="space-y-3">
                {updatedCountries.map((change) => (
                  <div
                    key={change.country.country}
                    className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4"
                  >
                    <button
                      onClick={() => toggleExpandCountry(change.country.country)}
                      className="mb-2 flex w-full items-center justify-between text-left"
                    >
                      <span className="font-medium text-blue-800">{change.country.country}</span>
                      {expandedCountry === change.country.country ? (
                        <ChevronUp className="text-muted-foreground h-4 w-4" />
                      ) : (
                        <ChevronDown className="text-muted-foreground h-4 w-4" />
                      )}
                    </button>
                    {expandedCountry === change.country.country && (
                      <>
                        {change.changes && change.changes.length > 0 ? (
                          <div className="space-y-2 text-xs">
                            {change.changes.map((fieldChange, fieldIndex) => (
                              <div
                                key={fieldIndex}
                                className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2 lg:grid-cols-3"
                              >
                                <span
                                  className="text-muted-foreground truncate"
                                  title={fieldChange.fieldLabel}
                                >
                                  {fieldChange.fieldLabel}:
                                </span>
                                <span
                                  className="text-muted-foreground truncate rounded bg-red-500/10 p-1"
                                  title={String(fieldChange.oldValue)}
                                >
                                  {formatDisplayValue(fieldChange.oldValue, fieldChange.field)}
                                </span>
                                <div className="flex items-center">
                                  <ArrowRight className="text-muted-foreground mx-1 h-3 w-3" />
                                  <span
                                    className="truncate rounded bg-green-500/10 p-1 font-medium text-blue-700"
                                    title={String(fieldChange.newValue)}
                                  >
                                    {formatDisplayValue(fieldChange.newValue, fieldChange.field)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">
                            No specific field changes detected, but file data might differ subtly or
                            involve new fields.
                          </p>
                        )}
                        <div className="mt-3 border-t border-blue-500/20 pt-2">
                          <h4 className="mb-1 text-xs font-semibold text-blue-700">
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
              <Info className="text-muted-foreground mx-auto mb-2 h-10 w-10" />
              <p className="text-foreground">No changes to import.</p>
              <p className="text-muted-foreground text-sm">
                The uploaded file does not contain new countries or updates to existing ones based
                on current data.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-border bg-muted/50 border-t p-6">
          {/* Epoch Sync Section */}
          <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
            <div className="flex items-start space-x-3">
              <Clock className="mt-0.5 h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <h4 className="mb-2 text-sm font-medium text-amber-700">
                  Epoch Time Synchronization
                </h4>
                <p className="mb-3 text-xs text-amber-600">
                  Sync the game epoch with your imported data to ensure accurate tracking. This
                  aligns the baseline calculation date with your roster data.
                </p>

                <label className="mb-3 flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={syncEpoch}
                    onChange={(e) => setSyncEpoch(e.target.checked)}
                    className="border-border h-4 w-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="ml-2 text-sm font-medium text-amber-700">
                    Sync epoch time with imported data
                  </span>
                </label>

                {syncEpoch && (
                  <div className="ml-6 space-y-2">
                    <div className="text-xs text-amber-600">
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
                      <label className="text-xs text-amber-600">Target Year:</label>
                      <Input
                        type="number"
                        value={new Date(targetEpoch).getFullYear()}
                        onChange={(e) => {
                          const year = parseInt(e.target.value);
                          if (!isNaN(year)) {
                            const newEpoch = IxTime.createGameTime(year, 1, 1);
                            setTargetEpoch(newEpoch);
                          }
                        }}
                        className="w-20 text-xs"
                        min={2020}
                        max={2100}
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
                  className="border-border h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-muted-foreground ml-2 text-sm">
                  Confirm updating {updatedCountries.length} existing countries with new data from
                  the file.
                </span>
              </label>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
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
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

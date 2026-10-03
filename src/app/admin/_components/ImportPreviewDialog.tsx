"use client";
// src/app/admin/_components/ImportPreviewDialog.tsx

import { useState } from "react";
import {
  Plus,
  Refresh as RefreshCw,
  CheckCircle,
  ArrowRight,
  NavArrowDown as ChevronDown,
  NavArrowUp as ChevronUp,
  InfoCircle as Info,
  SystemRestart as Loader2,
  Clock,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
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
      <div className="text-footnote mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {Object.entries(data).map(([key, value]) => {
          if (key === "country") return null; // Already shown as title
          const label =
            fieldLabels[key] ||
            key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
          return (
            <div key={key} className="flex justify-between">
              <span className="text-label-secondary">{label}:</span>
              <span className="text-label truncate text-right font-medium" title={String(value)}>
                {formatDisplayValue(value, key)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-4xl flex-col gap-0 p-0 sm:max-w-4xl">
        {/* Header */}
        <DialogHeader className="border-separator border-b p-6">
          <DialogTitle>Import Preview - {changes.length} Countries Found</DialogTitle>
          <DialogDescription className="sr-only">
            Review the countries this import adds and updates before confirming.
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="grow scrollbar-thin overflow-y-auto p-6">
          {/* Summary */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-control border-green/20 bg-green/10 border p-4">
              <div className="flex items-center">
                <Plus className="text-green mr-3 h-6 w-6" />
                <div>
                  <p className="text-body text-green font-medium">New countries to add</p>
                  <p className="text-large-title text-green">{newCountries.length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-control border-blue/20 bg-blue/10 border p-4">
              <div className="flex items-center">
                <RefreshCw className="text-blue mr-3 h-6 w-6" />
                <div>
                  <p className="text-body text-blue font-medium">Countries to update</p>
                  <p className="text-large-title text-blue">{updatedCountries.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* New Countries Section */}
          {newCountries.length > 0 && (
            <div className="mb-6">
              <h3 className="text-label text-title-3 mb-3 flex items-center">
                <Plus className="text-green mr-2 h-5 w-5" />
                New Countries ({newCountries.length})
              </h3>
              <div className="space-y-3">
                {newCountries.map((change) => (
                  <div
                    key={change.country.country}
                    className="rounded-control border-green/20 bg-green/10 border p-3"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpandCountry(change.country.country)}
                      aria-expanded={expandedCountry === change.country.country}
                      className="text-green w-full justify-between px-2 text-left"
                    >
                      {change.country.country}
                      {expandedCountry === change.country.country ? (
                        <ChevronUp aria-hidden className="text-label-secondary h-4 w-4" />
                      ) : (
                        <ChevronDown aria-hidden className="text-label-secondary h-4 w-4" />
                      )}
                    </Button>
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
              <h3 className="text-label text-title-3 mb-3 flex items-center">
                <RefreshCw className="text-blue mr-2 h-5 w-5" />
                Updated Countries ({updatedCountries.length})
              </h3>
              <div className="space-y-3">
                {updatedCountries.map((change) => (
                  <div
                    key={change.country.country}
                    className="rounded-control border-blue/20 bg-blue/10 border p-4"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpandCountry(change.country.country)}
                      aria-expanded={expandedCountry === change.country.country}
                      className="text-blue mb-2 w-full justify-between px-2 text-left"
                    >
                      {change.country.country}
                      {expandedCountry === change.country.country ? (
                        <ChevronUp aria-hidden className="text-label-secondary h-4 w-4" />
                      ) : (
                        <ChevronDown aria-hidden className="text-label-secondary h-4 w-4" />
                      )}
                    </Button>
                    {expandedCountry === change.country.country && (
                      <>
                        {change.changes && change.changes.length > 0 ? (
                          <div className="text-footnote space-y-2">
                            {change.changes.map((fieldChange, fieldIndex) => (
                              <div
                                key={fieldIndex}
                                className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2 lg:grid-cols-3"
                              >
                                <span
                                  className="text-label-secondary truncate"
                                  title={fieldChange.fieldLabel}
                                >
                                  {fieldChange.fieldLabel}:
                                </span>
                                <span
                                  className="text-label-secondary rounded-control-sm bg-red/10 truncate p-1"
                                  title={String(fieldChange.oldValue)}
                                >
                                  {formatDisplayValue(fieldChange.oldValue, fieldChange.field)}
                                </span>
                                <div className="flex items-center">
                                  <ArrowRight className="text-label-secondary mx-1 h-3 w-3" />
                                  <span
                                    className="rounded-control-sm bg-green/10 text-blue truncate p-1 font-medium"
                                    title={String(fieldChange.newValue)}
                                  >
                                    {formatDisplayValue(fieldChange.newValue, fieldChange.field)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-label-secondary text-body">
                            No specific field changes detected, but file data might differ subtly or
                            involve new fields.
                          </p>
                        )}
                        <div className="border-blue/20 mt-3 border-t pt-2">
                          <h4 className="text-caption text-blue mb-1">Full Proposed Data:</h4>
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
              <Info className="text-label-secondary mx-auto mb-2 h-10 w-10" />
              <p className="text-label">No changes to import.</p>
              <p className="text-label-secondary text-body">
                The uploaded file does not contain new countries or updates to existing ones based
                on current data.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-separator bg-fill-3 border-t p-6">
          {/* Epoch Sync Section */}
          <div className="rounded-control border-yellow/20 bg-yellow/10 mb-4 border p-4">
            <div className="flex items-start space-x-3">
              <Clock className="text-yellow mt-0.5 h-5 w-5" />
              <div className="flex-1">
                <h4 className="text-body text-yellow mb-2 font-medium">
                  Epoch time synchronization
                </h4>
                <p className="text-footnote text-yellow mb-3">
                  Sync the game epoch with your imported data to ensure accurate tracking. This
                  aligns the baseline calculation date with your roster data.
                </p>

                <label className="mb-3 flex cursor-pointer items-center">
                  <Checkbox
                    checked={syncEpoch}
                    onCheckedChange={(checked) => setSyncEpoch(checked === true)}
                  />
                  <span className="text-body text-yellow ml-2 font-medium">
                    Sync epoch time with imported data
                  </span>
                </label>

                {syncEpoch && (
                  <div className="ml-6 space-y-2">
                    <div className="text-footnote text-yellow">
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
                      <label className="text-footnote text-yellow">Target Year:</label>
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
                        className="rounded-control-sm md:text-footnote h-(--control-height-sm) w-20"
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
                <Checkbox
                  checked={confirmReplace}
                  onCheckedChange={(checked) => setConfirmReplace(checked === true)}
                />
                <span className="text-label-secondary text-body ml-2">
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
      </DialogContent>
    </Dialog>
  );
}

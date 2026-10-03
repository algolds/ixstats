"use client";

import { useState, useMemo, useEffect } from "react";
import { Xmark as X, Plus, SystemRestart } from "iconoir-react";
import { ComparisonCharts } from "./charts/ComparisonCharts";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { IxTime } from "~/lib/ixtime";
import { useNotify } from "~/hooks/useNotify";
import type { CountryWithEconomicData } from "~/types/ixstats";

import type { ComparisonCountry } from "~/types/country-comparison";

interface CountryComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableCountries: Array<{
    id: string;
    name: string;
    continent?: string | null;
    economicTier: string;
  }>;
  onCountrySelect?: (countryId: string) => void;
}

const CHART_COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

export function CountryComparisonModal({
  isOpen,
  onClose,
  availableCountries,
  onCountrySelect,
}: CountryComparisonModalProps) {
  const notify = useNotify();
  const [selectedCountries, setSelectedCountries] = useState<ComparisonCountry[]>([]);
  const [countrySearchOpen, setCountrySearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [loadingCountries, setLoadingCountries] = useState<Set<string>>(new Set());

  // Clear modal state when it closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedCountries([]);
      setSearchValue("");
      setLoadingCountries(new Set());
    }
  }, [isOpen]);

  // Filter available countries for search
  const filteredCountries = useMemo(() => {
    const selectedIds = new Set(selectedCountries.map((c) => c.id));
    return availableCountries
      .filter((country) => !selectedIds.has(country.id))
      .filter(
        (country) =>
          searchValue === "" || country.name.toLowerCase().includes(searchValue.toLowerCase())
      );
  }, [availableCountries, selectedCountries, searchValue]);

  // Add country to comparison
  const addCountry = async (countryId: string) => {
    const country = availableCountries.find((c) => c.id === countryId);
    if (!country || selectedCountries.length >= 8 || loadingCountries.has(countryId)) return;

    setLoadingCountries((prev) => new Set(prev).add(countryId));

    try {
      // Use direct fetch to tRPC endpoint with GET request for query
      const params = new URLSearchParams({
        batch: "1",
        input: JSON.stringify({
          "0": {
            json: { id: countryId },
          },
        }),
      });

      const response = await fetch(`/api/trpc/countries.getByIdWithEconomicData?${params}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const countryData = result[0]?.result?.data?.json as CountryWithEconomicData;

      if (countryData) {
        // Use properties directly from countryData, not calculatedStats
        const newCountry: ComparisonCountry = {
          id: countryData.id,
          name: countryData.name,
          currentPopulation: countryData.currentPopulation || countryData.baselinePopulation || 0,
          currentGdpPerCapita:
            countryData.currentGdpPerCapita || countryData.baselineGdpPerCapita || 0,
          currentTotalGdp:
            countryData.currentTotalGdp ||
            countryData.currentPopulation * countryData.currentGdpPerCapita ||
            0,
          populationGrowthRate: countryData.populationGrowthRate || 0,
          adjustedGdpGrowth: countryData.adjustedGdpGrowth || 0,
          economicTier: countryData.economicTier || country.economicTier,
          populationTier: countryData.populationTier || "Unknown",
          populationDensity: countryData.populationDensity,
          gdpDensity: countryData.gdpDensity,
          landArea: countryData.landArea,
          continent: countryData.continent || country.continent,
          color: CHART_COLORS[selectedCountries.length] || "#8b5cf6",
        };

        setSelectedCountries((prev) => [...prev, newCountry]);
        notify.success(`${countryData.name || country.name} added to comparison`);
      } else {
        throw new Error("No country data returned");
      }
    } catch (error) {
      console.error("Error fetching country data for comparison:", error);
      notify.error(`Failed to load data for ${country.name}.`);
    } finally {
      setLoadingCountries((prev) => {
        const newSet = new Set(prev);
        newSet.delete(countryId);
        return newSet;
      });
      setCountrySearchOpen(false);
      setSearchValue("");
    }
  };

  // Remove country from comparison
  const removeCountry = (countryId: string) => {
    const countryToRemove = selectedCountries.find((c) => c.id === countryId);
    const newCountries = selectedCountries
      .filter((c) => c.id !== countryId)
      .map((country, index) => ({
        ...country,
        color: CHART_COLORS[index] || "#8b5cf6",
      }));
    setSelectedCountries(newCountries);
    if (countryToRemove) {
      notify.success(`${countryToRemove.name} removed from comparison`);
    }
  };

  // Handle country selection from modal
  const handleCountrySelect = (countryId: string) => {
    if (onCountrySelect) {
      onCountrySelect(countryId);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-label flex items-center gap-2">
            Compare countries
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-full flex-col gap-4">
          {/* Country Selection */}
          <div className="flex flex-wrap items-center gap-2">
            <Popover open={countrySearchOpen} onOpenChange={setCountrySearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" disabled={selectedCountries.length >= 8}>
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Add country ({selectedCountries.length}/8)
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-80"
                align="start"
                onOpenAutoFocus={(e) => {
                  e.preventDefault();
                  const target = e.currentTarget as HTMLElement;
                  const input = target.querySelector(
                    '[data-slot="command-input"]'
                  ) as HTMLInputElement;
                  if (input) {
                    input.focus({ preventScroll: true });
                  }
                }}
              >
                <Command className="text-label bg-transparent">
                  <CommandInput
                    placeholder="Search countries"
                    value={searchValue}
                    onValueChange={setSearchValue}
                    className="bg-background text-label border-separator focus:border-border-primary"
                  />
                  <CommandEmpty className="text-label-secondary">No countries found.</CommandEmpty>
                  <CommandGroup className="max-h-60 overflow-auto">
                    {filteredCountries.map((country) => (
                      <CommandItem
                        key={country.id}
                        onSelect={() => void addCountry(country.id)}
                        className="text-label hover:bg-fill-3 hover:text-label focus:bg-fill-3 focus:text-label cursor-pointer transition-colors"
                        disabled={loadingCountries.has(country.id)}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span>{country.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-footnote">
                              {country.economicTier}
                            </Badge>
                            {loadingCountries.has(country.id) && (
                              <SystemRestart
                                aria-label="Loading"
                                className="text-label-secondary h-3 w-3 animate-spin"
                              />
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>

            {selectedCountries.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCountries([]);
                  notify.success("All countries cleared from comparison");
                }}
              >
                Clear all
              </Button>
            )}
          </div>

          {/* Selected Countries Display */}
          {selectedCountries.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedCountries.map((country) => (
                <div
                  key={country.id}
                  className="bg-fill-3 text-label-secondary hover:bg-fill-2 hover:text-label border-separator rounded-control-sm flex items-center gap-2 px-3 py-1 transition-colors"
                  style={{ borderLeft: `3px solid ${country.color}` }}
                >
                  <span className="text-body font-medium">{country.name}</span>
                  <Badge variant="outline" className="text-footnote">
                    {country.economicTier}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCountry(country.id)}
                    className="hover:bg-destructive hover:text-destructive-foreground h-4 w-4 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Comparison Charts */}
          <div className="min-h-0 flex-1">
            <ComparisonCharts
              countries={selectedCountries}
              onCountriesChangeAction={setSelectedCountries}
              availableCountries={availableCountries}
              currentIxTime={IxTime.getCurrentIxTime()}
              isLoading={false}
            />
          </div>

          {/* Action Buttons */}
          <div className="border-separator flex justify-end gap-2 border-t pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="text-label border-separator hover:bg-fill-3 hover:text-label"
            >
              Close
            </Button>
            {selectedCountries.length === 1 && selectedCountries[0] && (
              <Button
                onClick={() => {
                  const country = selectedCountries[0];
                  if (country) {
                    handleCountrySelect(country.id);
                  }
                }}
                className="bg-tint text-on-tint hover:bg-tint/90"
              >
                View details
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

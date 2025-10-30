"use client";

import { useState, useMemo, useEffect } from "react";
import { X, Plus, Minus, BarChart3, TrendingUp, Users, DollarSign } from "lucide-react";
import { ComparisonCharts } from "./charts/ComparisonCharts";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
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
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import type { CountryWithEconomicData, CalculatedStats } from "~/types/ixstats";

// Define the type for countries that can be compared
export interface ComparisonCountry {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  populationGrowthRate: number;
  adjustedGdpGrowth: number;
  economicTier: string;
  populationTier: string;
  populationDensity?: number | null;
  gdpDensity?: number | null;
  landArea?: number | null;
  continent?: string | null;
  color: string;
}

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
        toast.success(`${countryData.name || country.name} added to comparison`);
      } else {
        throw new Error("No country data returned");
      }
    } catch (error) {
      console.error("Error fetching country data for comparison:", error);
      toast.error(`Failed to load data for ${country.name}. Using basic information.`);
      // Fallback to basic data if API fails
      const fallbackCountry: ComparisonCountry = {
        id: country.id,
        name: country.name,
        currentPopulation: 0,
        currentGdpPerCapita: 0,
        currentTotalGdp: 0,
        populationGrowthRate: 0,
        adjustedGdpGrowth: 0,
        economicTier: country.economicTier,
        populationTier: "Unknown",
        continent: country.continent,
        color: CHART_COLORS[selectedCountries.length] || "#8b5cf6",
      };
      setSelectedCountries((prev) => [...prev, fallbackCountry]);
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
      toast.success(`${countryToRemove.name} removed from comparison`);
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
      <DialogContent className="bg-background text-foreground border-border max-h-[90vh] max-w-6xl overflow-hidden backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <BarChart3 className="text-primary h-5 w-5" />
            Compare Countries
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-full flex-col gap-4">
          {/* Country Selection */}
          <div className="flex flex-wrap items-center gap-2">
            <Popover open={countrySearchOpen} onOpenChange={setCountrySearchOpen}>
              <PopoverTrigger>
                <Button variant="outline" size="sm" disabled={selectedCountries.length >= 8}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Country ({selectedCountries.length}/8)
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="bg-background text-foreground border-border w-80 backdrop-blur-md"
                align="start"
              >
                <Command className="text-foreground bg-transparent">
                  <CommandInput
                    placeholder="Search countries..."
                    value={searchValue}
                    onValueChange={setSearchValue}
                    className="bg-background text-foreground border-border focus:border-border-primary"
                  />
                  <CommandEmpty className="text-muted-foreground">No countries found.</CommandEmpty>
                  <CommandGroup className="max-h-60 overflow-auto">
                    {filteredCountries.map((country) => (
                      <CommandItem
                        key={country.id}
                        onSelect={() => void addCountry(country.id)}
                        className="text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer transition-colors"
                        disabled={loadingCountries.has(country.id)}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span>{country.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {country.economicTier}
                            </Badge>
                            {loadingCountries.has(country.id) && (
                              <div className="border-border-current h-3 w-3 animate-spin rounded-full border-t-transparent" />
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
                  toast.success("All countries cleared from comparison");
                }}
              >
                Clear All
              </Button>
            )}
          </div>

          {/* Selected Countries Display */}
          {selectedCountries.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedCountries.map((country) => (
                <div
                  key={country.id}
                  className="bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground border-border flex items-center gap-2 rounded-md px-3 py-1 transition-colors"
                  style={{ borderLeft: `3px solid ${country.color}` }}
                >
                  <span className="text-sm font-medium">{country.name}</span>
                  <Badge variant="outline" className="text-xs">
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

          {/* Summary Statistics */}
          {selectedCountries.length > 0 && (
            <div className="border-border border-t pt-4">
              <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground text-sm">Countries</p>
                  <p className="text-lg font-semibold">{selectedCountries.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Total Population</p>
                  <p className="text-lg font-semibold">
                    {formatPopulation(
                      selectedCountries.reduce((sum, c) => sum + c.currentPopulation, 0)
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Total GDP</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(
                      selectedCountries.reduce((sum, c) => sum + c.currentTotalGdp, 0)
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Avg GDP/Capita</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(
                      selectedCountries.reduce((sum, c) => sum + c.currentGdpPerCapita, 0) /
                        selectedCountries.length
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="border-border flex justify-end gap-2 border-t pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="text-foreground border-border hover:bg-accent hover:text-accent-foreground"
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
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                View Details
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

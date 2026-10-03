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
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
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
];
const MAX_COUNTRIES = 8;
const colorAt = (index: number) => CHART_COLORS[index] || "#8b5cf6";

type AvailableCountry = CountryComparisonModalProps["availableCountries"][number];

function toComparisonCountry(
  data: CountryWithEconomicData,
  fallback: AvailableCountry,
  index: number
): ComparisonCountry {
  return {
    id: data.id,
    name: data.name,
    currentPopulation: data.currentPopulation || data.baselinePopulation || 0,
    currentGdpPerCapita: data.currentGdpPerCapita || data.baselineGdpPerCapita || 0,
    currentTotalGdp: data.currentTotalGdp || data.currentPopulation * data.currentGdpPerCapita || 0,
    populationGrowthRate: data.populationGrowthRate || 0,
    adjustedGdpGrowth: data.adjustedGdpGrowth || 0,
    economicTier: data.economicTier || fallback.economicTier,
    populationTier: data.populationTier || "Unknown",
    populationDensity: data.populationDensity,
    gdpDensity: data.gdpDensity,
    landArea: data.landArea,
    continent: data.continent || fallback.continent,
    color: colorAt(index),
  };
}

export function CountryComparisonModal({
  isOpen,
  onClose,
  availableCountries,
  onCountrySelect,
}: CountryComparisonModalProps) {
  const notify = useNotify();
  const utils = api.useUtils();
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

  const filteredCountries = useMemo(() => {
    const selectedIds = new Set(selectedCountries.map((c) => c.id));
    const query = searchValue.toLowerCase();
    return availableCountries.filter(
      (country) => !selectedIds.has(country.id) && country.name.toLowerCase().includes(query)
    );
  }, [availableCountries, selectedCountries, searchValue]);

  const addCountry = async (countryId: string) => {
    const country = availableCountries.find((c) => c.id === countryId);
    if (!country || selectedCountries.length >= MAX_COUNTRIES || loadingCountries.has(countryId)) {
      return;
    }

    setLoadingCountries((prev) => new Set(prev).add(countryId));
    try {
      const data = (await utils.countries.getByIdWithEconomicData.fetch({
        id: countryId,
      })) as CountryWithEconomicData | null;
      if (!data) throw new Error("No country data returned");

      setSelectedCountries((prev) => [
        ...prev,
        toComparisonCountry(data, country, selectedCountries.length),
      ]);
      notify.success(`${data.name || country.name} added to comparison`);
    } catch (error) {
      console.error("Error fetching country data for comparison:", error);
      notify.error(`Failed to load data for ${country.name}.`);
    } finally {
      setLoadingCountries((prev) => {
        const next = new Set(prev);
        next.delete(countryId);
        return next;
      });
      setCountrySearchOpen(false);
      setSearchValue("");
    }
  };

  const removeCountry = (countryId: string) => {
    const removed = selectedCountries.find((c) => c.id === countryId);
    setSelectedCountries(
      selectedCountries
        .filter((c) => c.id !== countryId)
        .map((country, index) => ({ ...country, color: colorAt(index) }))
    );
    if (removed) notify.success(`${removed.name} removed from comparison`);
  };

  const [onlyCountry] = selectedCountries.length === 1 ? selectedCountries : [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-label flex items-center gap-2">
            Compare countries
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-full flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Popover open={countrySearchOpen} onOpenChange={setCountrySearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedCountries.length >= MAX_COUNTRIES}
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Add country ({selectedCountries.length}/{MAX_COUNTRIES})
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-80"
                align="start"
                onOpenAutoFocus={(e) => {
                  e.preventDefault();
                  const input = (e.currentTarget as HTMLElement).querySelector<HTMLInputElement>(
                    '[data-slot="command-input"]'
                  );
                  input?.focus({ preventScroll: true });
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

          <div className="min-h-0 flex-1">
            <ComparisonCharts
              countries={selectedCountries}
              onCountriesChangeAction={setSelectedCountries}
              isLoading={false}
            />
          </div>

          <div className="border-separator flex justify-end gap-2 border-t pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="text-label border-separator hover:bg-fill-3 hover:text-label"
            >
              Close
            </Button>
            {onlyCountry && (
              <Button
                onClick={() => {
                  onCountrySelect?.(onlyCountry.id);
                  onClose();
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

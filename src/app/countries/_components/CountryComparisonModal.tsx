'use client';

import { useState, useMemo, useEffect } from 'react';
import { X, Plus, Minus, BarChart3, TrendingUp, Users, DollarSign } from 'lucide-react';
import { ComparisonCharts } from './charts/ComparisonCharts';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Input } from '~/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '~/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { IxTime } from '~/lib/ixtime';
import { formatCurrency, formatPopulation } from '~/lib/chart-utils';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import type { CountryWithEconomicData, CalculatedStats } from '~/types/ixstats';

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
  "#8b5cf6", "#06b6d4", "#84cc16", "#f97316", 
  "#ec4899", "#14b8a6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4"
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
    const selectedIds = new Set(selectedCountries.map(c => c.id));
    return availableCountries
      .filter(country => !selectedIds.has(country.id))
      .filter(country => 
        searchValue === "" || 
        country.name.toLowerCase().includes(searchValue.toLowerCase())
      );
  }, [availableCountries, selectedCountries, searchValue]);

  // Add country to comparison
  const addCountry = async (countryId: string) => {
    const country = availableCountries.find(c => c.id === countryId);
    if (!country || selectedCountries.length >= 8 || loadingCountries.has(countryId)) return;

    setLoadingCountries(prev => new Set(prev).add(countryId));

    try {
      // Use direct fetch to tRPC endpoint with GET request for query
      const params = new URLSearchParams({
        batch: '1',
        input: JSON.stringify({
          "0": {
            "json": { id: countryId }
          }
        })
      });
      
      const response = await fetch(`/api/trpc/countries.getByIdWithEconomicData?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
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
          currentGdpPerCapita: countryData.currentGdpPerCapita || countryData.baselineGdpPerCapita || 0,
          currentTotalGdp: countryData.currentTotalGdp || (countryData.currentPopulation * countryData.currentGdpPerCapita) || 0,
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

        setSelectedCountries(prev => [...prev, newCountry]);
        toast.success(`${countryData.name || country.name} added to comparison`);
      } else {
        throw new Error('No country data returned');
      }
    } catch (error) {
      console.error('Error fetching country data for comparison:', error);
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
      setSelectedCountries(prev => [...prev, fallbackCountry]);
    } finally {
      setLoadingCountries(prev => {
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
    const countryToRemove = selectedCountries.find(c => c.id === countryId);
    const newCountries = selectedCountries
      .filter(c => c.id !== countryId)
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Compare Countries
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-full gap-4">
          {/* Country Selection */}
          <div className="flex items-center gap-2 flex-wrap">
            <Popover open={countrySearchOpen} onOpenChange={setCountrySearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" disabled={selectedCountries.length >= 8}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Country ({selectedCountries.length}/8)
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="start">
                <Command>
                  <CommandInput 
                    placeholder="Search countries..." 
                    value={searchValue}
                    onValueChange={setSearchValue}
                  />
                  <CommandEmpty>No countries found.</CommandEmpty>
                  <CommandGroup className="max-h-60 overflow-auto">
                    {filteredCountries.map((country) => (
                      <CommandItem
                        key={country.id}
                        onSelect={() => void addCountry(country.id)}
                        className="cursor-pointer"
                        disabled={loadingCountries.has(country.id)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{country.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {country.economicTier}
                            </Badge>
                            {loadingCountries.has(country.id) && (
                              <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full" />
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
                  toast.success('All countries cleared from comparison');
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
                  className="flex items-center gap-2 bg-muted px-3 py-1 rounded-md"
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
                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Comparison Charts */}
          <div className="flex-1 min-h-0">
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
            <div className="border-t pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Countries</p>
                  <p className="text-lg font-semibold">{selectedCountries.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Population</p>
                  <p className="text-lg font-semibold">
                    {formatPopulation(selectedCountries.reduce((sum, c) => sum + c.currentPopulation, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total GDP</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(selectedCountries.reduce((sum, c) => sum + c.currentTotalGdp, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg GDP/Capita</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(selectedCountries.reduce((sum, c) => sum + c.currentGdpPerCapita, 0) / selectedCountries.length)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
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
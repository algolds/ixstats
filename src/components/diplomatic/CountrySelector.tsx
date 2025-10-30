"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { RiSearchLine, RiCheckLine } from "react-icons/ri";

interface CountrySelectorProps {
  hostCountryId: string;
  selectedCountries: string[];
  onCountryToggle: (countryId: string) => void;
  maxSelections?: number;
}

interface CountryData {
  id: string;
  name: string;
  economicTier: string;
}

export function CountrySelector({
  hostCountryId,
  selectedCountries,
  onCountryToggle,
  maxSelections = 20,
}: CountrySelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch all countries
  const { data: countriesData, isLoading } = api.countries.getAll.useQuery({
    limit: 200,
    offset: 0,
    search: debouncedSearch || undefined,
  });

  // Filter and sort countries
  const countries = useMemo(() => {
    const allCountries = (countriesData?.countries ?? []) as CountryData[];

    // Filter out the host country itself and sort by name
    return allCountries
      .filter((c) => c.id !== hostCountryId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [countriesData, hostCountryId]);

  // Economic tier badge styling
  const getEconomicTierBadgeClass = (tier: string): string => {
    const colorMap: Record<string, string> = {
      Advanced: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      Emerging: "bg-green-500/20 text-green-300 border-green-500/30",
      Developing: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    };
    return colorMap[tier] || "bg-gray-500/20 text-gray-300 border-gray-500/30";
  };

  // Country card component
  const CountryCard = ({ country }: { country: CountryData }) => {
    const isSelected = selectedCountries.includes(country.id);
    const isDisabled = !isSelected && selectedCountries.length >= maxSelections;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "glass-hierarchy-child rounded-lg p-4 transition-all duration-200",
          "border border-[--intel-gold]/20",
          isSelected && "ring-2 ring-[--intel-gold]/50 border-[--intel-gold]/50",
          !isDisabled && "hover:border-[--intel-gold]/40 cursor-pointer",
          isDisabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => !isDisabled && onCountryToggle(country.id)}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <div className="pt-1">
            <Checkbox
              checked={isSelected}
              disabled={isDisabled}
              onCheckedChange={() => !isDisabled && onCountryToggle(country.id)}
              className="pointer-events-none"
            />
          </div>

          {/* Flag */}
          <div className="flex-shrink-0">
            <UnifiedCountryFlag
              countryName={country.name}
              size="md"
              className="rounded shadow-sm"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Country Name */}
            <h4 className="font-bold text-white truncate">{country.name}</h4>

            {/* Economic Tier Badge */}
            <Badge className={cn("text-xs", getEconomicTierBadgeClass(country.economicTier))}>
              {country.economicTier}
            </Badge>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="glass-hierarchy-child rounded-lg p-4 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search countries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-black/20 border-[--intel-gold]/20 focus:border-[--intel-gold]/50"
          />
        </div>

        {/* Selection Counter */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">
            Selected: <span className="text-[--intel-gold] font-medium">{selectedCountries.length}</span> / {maxSelections}
          </span>
          {selectedCountries.length >= maxSelections && (
            <span className="text-yellow-400 flex items-center gap-1">
              <RiCheckLine />
              Maximum reached
            </span>
          )}
        </div>
      </div>

      {/* Country Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="glass-hierarchy-child rounded-lg p-4 h-32 animate-pulse bg-gray-800/50"
            />
          ))}
        </div>
      ) : countries.length === 0 ? (
        <div className="glass-hierarchy-child rounded-lg p-8 text-center">
          <RiSearchLine className="mx-auto h-12 w-12 text-gray-500 mb-3" />
          <p className="text-gray-400">No countries found</p>
          <p className="text-sm text-gray-500 mt-1">Try adjusting your search</p>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {countries.map((country) => (
              <CountryCard key={country.id} country={country} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

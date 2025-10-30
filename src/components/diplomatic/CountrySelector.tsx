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
          isSelected && "border-[--intel-gold]/50 ring-2 ring-[--intel-gold]/50",
          !isDisabled && "cursor-pointer hover:border-[--intel-gold]/40",
          isDisabled && "cursor-not-allowed opacity-50"
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
          <div className="min-w-0 flex-1 space-y-2">
            {/* Country Name */}
            <h4 className="truncate font-bold text-white">{country.name}</h4>

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
      <div className="glass-hierarchy-child space-y-4 rounded-lg p-4">
        {/* Search Input */}
        <div className="relative">
          <RiSearchLine className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search countries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-[--intel-gold]/20 bg-black/20 pl-10 focus:border-[--intel-gold]/50"
          />
        </div>

        {/* Selection Counter */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">
            Selected:{" "}
            <span className="font-medium text-[--intel-gold]">{selectedCountries.length}</span> /{" "}
            {maxSelections}
          </span>
          {selectedCountries.length >= maxSelections && (
            <span className="flex items-center gap-1 text-yellow-400">
              <RiCheckLine />
              Maximum reached
            </span>
          )}
        </div>
      </div>

      {/* Country Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="glass-hierarchy-child h-32 animate-pulse rounded-lg bg-gray-800/50 p-4"
            />
          ))}
        </div>
      ) : countries.length === 0 ? (
        <div className="glass-hierarchy-child rounded-lg p-8 text-center">
          <RiSearchLine className="mx-auto mb-3 h-12 w-12 text-gray-500" />
          <p className="text-gray-400">No countries found</p>
          <p className="mt-1 text-sm text-gray-500">Try adjusting your search</p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

// @ts-nocheck
"use client";

import React, { useState, useMemo } from "react";
import { ChevronUp, Globe, RotateCcw, Eye, X } from "lucide-react";
import { useDevCountryView } from "~/context/DevCountryViewContext";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

// Only render in development mode
const isDevelopment = process.env.NODE_ENV === "development";

export function DevCountryViewToolbar() {
  const {
    canUseDevView,
    viewCountryId,
    viewCountryName,
    isViewingOtherCountry,
    setViewCountry,
    clearViewCountry,
    actualCountryId,
    isToolbarExpanded,
    setToolbarExpanded,
  } = useDevCountryView();

  const [selectedCountryId, setSelectedCountryId] = useState<string>("");

  // Fetch country list for dropdown
  const { data: countriesData, isLoading: countriesLoading } = api.countries.getSelectList.useQuery(
    { limit: 500 },
    { enabled: canUseDevView && isToolbarExpanded }
  );

  // Get actual country name for display
  const { data: actualCountry } = api.countries.getByIdBasic.useQuery(
    { id: actualCountryId ?? "" },
    { enabled: !!actualCountryId && canUseDevView }
  );

  const countries = useMemo(() => {
    if (!countriesData?.items) return [];
    return countriesData.items.map((c) => ({
      id: c.id,
      name: c.name,
    }));
  }, [countriesData]);

  // Don't render if user can't use dev view or not in dev mode
  if (!isDevelopment || !canUseDevView) {
    return null;
  }

  const handleViewCountry = () => {
    if (!selectedCountryId) return;
    const country = countries.find((c) => c.id === selectedCountryId);
    setViewCountry(selectedCountryId, country?.name);
    setSelectedCountryId("");
  };

  // Collapsed state - small floating badge
  if (!isToolbarExpanded) {
    return (
      <button
        onClick={() => setToolbarExpanded(true)}
        className={cn(
          "fixed right-4 bottom-4 z-50",
          "flex items-center gap-2 px-3 py-2",
          "rounded-full shadow-lg",
          "transition-all duration-200 hover:scale-105",
          isViewingOtherCountry ? "bg-amber-500 text-amber-950" : "bg-slate-800 text-slate-200"
        )}
      >
        <Eye className="h-4 w-4" />
        <span className="text-xs font-semibold">
          {isViewingOtherCountry ? viewCountryName || "Other" : "DEV"}
        </span>
        <ChevronUp className="h-3 w-3" />
      </button>
    );
  }

  // Expanded state - full toolbar
  return (
    <div
      className={cn(
        "fixed right-4 bottom-4 z-50",
        "w-80 rounded-2xl shadow-2xl",
        "bg-white/95 dark:bg-slate-900/95",
        "backdrop-blur-xl",
        "border border-slate-200 dark:border-slate-700",
        "transition-all duration-300 ease-out"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            Country View Mode
          </span>
        </div>
        <button
          onClick={() => setToolbarExpanded(false)}
          className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4 p-4">
        {/* Current view status */}
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Currently viewing:
          </div>
          <div className="mt-1 flex items-center gap-2">
            {isViewingOtherCountry ? (
              <>
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  Other
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {viewCountryName || viewCountryId}
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  Own
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {actualCountry?.name || "Your Country"}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Country selector */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Switch to:
          </label>
          <Select
            value={selectedCountryId}
            onValueChange={setSelectedCountryId}
            disabled={countriesLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={countriesLoading ? "Loading..." : "Select a country"} />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {countries.map((country) => (
                <SelectItem key={country.id} value={country.id}>
                  {country.name}
                  {country.id === actualCountryId && (
                    <span className="ml-2 text-xs text-slate-400">(yours)</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleViewCountry}
            disabled={!selectedCountryId}
            className="flex-1"
            size="sm"
          >
            <Eye className="mr-2 h-4 w-4" />
            View
          </Button>
          <Button
            onClick={clearViewCountry}
            variant="outline"
            disabled={!isViewingOtherCountry}
            className="flex-1"
            size="sm"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>

        {/* Dev mode notice */}
        <div className="text-center text-xs text-slate-400">Development mode only</div>
      </div>
    </div>
  );
}

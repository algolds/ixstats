"use client";

import React, { useState, useMemo } from "react";
import { Globe, Undo as RotateCcw, Eye, NavArrowDown as ChevronDown, WarningTriangle as AlertTriangle } from "iconoir-react";
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

  const countries = useMemo<{ id: string; name: string }[]>(() => {
    if (!countriesData) return [];
    const list = Array.isArray(countriesData) ? countriesData : (countriesData as any).items ?? [];
    return list.map((c: any) => ({
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
    const country = countries.find((c: { id: string; name: string }) => c.id === selectedCountryId);
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
          "border backdrop-blur-md transition-all hover:scale-105",
          isViewingOtherCountry
            ? "border-amber-500 bg-amber-500/20 text-amber-300"
            : "border-blue-500 bg-blue-500/20 text-blue-300"
        )}
        title="Developer Country View"
      >
        <Eye className="h-4 w-4" />
        <span className="text-xs font-semibold">DEV</span>
        {isViewingOtherCountry && (
          <span className="max-w-[100px] truncate text-xs">{viewCountryName}</span>
        )}
      </button>
    );
  }

  // Expanded state - full toolbar
  return (
    <div
      className={cn(
        "fixed right-4 bottom-4 z-50 w-80",
        "rounded-xl p-4 shadow-2xl",
        "border backdrop-blur-xl transition-all",
        isViewingOtherCountry
          ? "border-amber-500/50 bg-slate-900/95"
          : "border-blue-500/30 bg-slate-900/95"
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye
            className={cn("h-5 w-5", isViewingOtherCountry ? "text-amber-400" : "text-blue-400")}
          />
          <span className="text-sm font-bold text-white">Dev Country View</span>
        </div>
        <button
          onClick={() => setToolbarExpanded(false)}
          className="text-slate-400 hover:text-white"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Current status */}
      <div className="mb-3 rounded-lg bg-slate-800/80 p-2 text-xs">
        <div className="text-slate-400">Current View:</div>
        <div className="font-semibold text-white">
          {isViewingOtherCountry ? (
            <span className="text-amber-400">
              {viewCountryName || viewCountryId} (Dev Override)
            </span>
          ) : (
            <span className="text-blue-400">
              {actualCountry?.name || "Your Own Country"} (Default)
            </span>
          )}
        </div>
      </div>

      {/* Warning banner when viewing other country */}
      {isViewingOtherCountry && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            You are viewing data as <strong>{viewCountryName}</strong>. Mutations will still affect
            your account.
          </span>
        </div>
      )}

      {/* Country selector */}
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-300">
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
              {countries.map((country: { id: string; name: string }) => (
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

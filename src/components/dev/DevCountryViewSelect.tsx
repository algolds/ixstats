"use client";

import React, { useMemo } from "react";
import { Eye, RotateCcw } from "lucide-react";
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

/**
 * Compact dev country view selector for embedding in headers
 * Only visible to system owners in development mode
 */
export function DevCountryViewSelect() {
  const {
    canUseDevView,
    viewCountryId,
    isViewingOtherCountry,
    setViewCountry,
    clearViewCountry,
    actualCountryId,
  } = useDevCountryView();

  // Fetch country list for dropdown
  const { data: countriesData, isLoading: countriesLoading } = api.countries.getSelectList.useQuery(
    { limit: 500 },
    { enabled: canUseDevView }
  );

  const countries = useMemo(() => {
    if (!countriesData?.items) return [];
    return countriesData.items.map((c) => ({
      id: c.id,
      name: c.name,
    }));
  }, [countriesData]);

  // Debug: log why we might not be showing
  console.log("[DevCountryViewSelect]", {
    isDevelopment,
    canUseDevView,
    viewCountryId,
    actualCountryId,
  });

  // Don't render if user can't use dev view or not in dev mode
  if (!isDevelopment || !canUseDevView) {
    return null;
  }

  const handleCountryChange = (countryId: string) => {
    if (countryId === "__reset__") {
      clearViewCountry();
      return;
    }
    const country = countries.find((c) => c.id === countryId);
    setViewCountry(countryId, country?.name);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-1",
        "border",
        isViewingOtherCountry
          ? "border-amber-500/50 bg-amber-500/10"
          : "border-blue-500/30 bg-blue-500/5"
      )}
    >
      <Eye className={cn("h-4 w-4", isViewingOtherCountry ? "text-amber-500" : "text-blue-500")} />
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">DEV:</span>

      <Select
        value={viewCountryId || "__own__"}
        onValueChange={handleCountryChange}
        disabled={countriesLoading}
      >
        <SelectTrigger
          className={cn(
            "h-7 w-40 border-0 bg-transparent text-xs",
            isViewingOtherCountry ? "text-amber-700 dark:text-amber-300" : ""
          )}
        >
          <SelectValue placeholder={countriesLoading ? "Loading..." : "Select country"} />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          <SelectItem value="__own__" className="text-xs">
            My Country (default)
          </SelectItem>
          <SelectItem value="__reset__" className="text-xs text-blue-600">
            <span className="flex items-center gap-1">
              <RotateCcw className="h-3 w-3" />
              Reset to My Country
            </span>
          </SelectItem>
          <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          {countries.map((country) => (
            <SelectItem key={country.id} value={country.id} className="text-xs">
              {country.name}
              {country.id === actualCountryId && (
                <span className="ml-1 text-slate-400">(yours)</span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isViewingOtherCountry && (
        <Button
          onClick={clearViewCountry}
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-amber-700 hover:bg-amber-500/20 hover:text-amber-900"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

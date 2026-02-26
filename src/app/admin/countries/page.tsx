// src/app/admin/countries/page.tsx
// Live country grid with drill-down detail sheet
"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { CountryGrid } from "./_components/CountryGrid";
import { CountryDetailSheet } from "./_components/CountryDetailSheet";
import { api } from "~/trpc/react";
import { Globe } from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";

export default function CountriesPage() {
  usePageTitle({ title: "Admin - Countries" });
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);

  const { data: systemStatus, isLoading } = api.admin.getSystemStatus.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Globe}
        title="Countries"
        description="Live country grid, monitoring, and analytics"
      />

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card-child rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-4">
          <span className="text-muted-foreground text-xs font-medium uppercase">
            Total Countries
          </span>
          {isLoading ? (
            <Skeleton className="mt-1 h-8 w-20" />
          ) : (
            <div className="text-foreground mt-1 text-2xl font-bold">
              {systemStatus?.countryCount ?? 0}
            </div>
          )}
        </div>
        <div className="glass-card-child rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4">
          <span className="text-muted-foreground text-xs font-medium uppercase">
            Last Calculation
          </span>
          {isLoading ? (
            <Skeleton className="mt-1 h-8 w-32" />
          ) : (
            <div className="text-foreground mt-1 text-lg font-bold">
              {systemStatus?.lastCalculation?.timestamp
                ? new Date(systemStatus.lastCalculation.timestamp).toLocaleTimeString()
                : "N/A"}
            </div>
          )}
        </div>
        <div className="glass-card-child rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-4">
          <span className="text-muted-foreground text-xs font-medium uppercase">
            Active Interventions
          </span>
          {isLoading ? (
            <Skeleton className="mt-1 h-8 w-20" />
          ) : (
            <div className="text-foreground mt-1 text-2xl font-bold">
              {systemStatus?.activeStorytellerEffects ?? 0}
            </div>
          )}
        </div>
      </div>

      {/* Country Grid */}
      <CountryGrid onSelectCountry={setSelectedCountryId} />

      {/* Detail Sheet */}
      <CountryDetailSheet
        countryId={selectedCountryId}
        onClose={() => setSelectedCountryId(null)}
      />
    </div>
  );
}

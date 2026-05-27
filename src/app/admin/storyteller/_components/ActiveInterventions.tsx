// src/app/admin/storyteller/_components/ActiveInterventions.tsx
// Manage running storyteller effect interventions across all countries
"use client";

import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { ScrollArea } from "~/components/ui/scroll-area";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { formatDistanceToNow } from "date-fns";
import { Zap, Clock, AlertTriangle } from "lucide-react";
import { useState } from "react";

export function ActiveInterventions() {
  // We need active storyteller effects - let's use the country grid which includes counts
  const { data: gridData, isLoading } = api.admin.getCountryGrid.useQuery(
    { sortBy: "name", sortOrder: "asc", limit: 200, offset: 0 },
    { refetchInterval: 30000, refetchOnWindowFocus: false }
  );

  // Filter to countries with active interventions
  const countriesWithInterventions = gridData?.rows.filter((r) => r.activeInterventions > 0) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (countriesWithInterventions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Zap className="text-muted-foreground mb-3 h-10 w-10" />
        <h3 className="text-foreground text-lg font-semibold">No Active Interventions</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          All storyteller effects are currently inactive. Create a world event to generate
          interventions.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          <h3 className="text-foreground text-lg font-semibold">Active Interventions</h3>
          <Badge variant="outline" className="border-amber-500/20 text-amber-600">
            {countriesWithInterventions.reduce((sum, c) => sum + c.activeInterventions, 0)} total
          </Badge>
        </div>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-2">
          {countriesWithInterventions.map((country) => (
            <CountryInterventionRow key={country.id} country={country} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function CountryInterventionRow({
  country,
}: {
  country: {
    id: string;
    name: string;
    flag: string | null;
    economicTier: string | null;
    activeInterventions: number;
  };
}) {
  const [expanded, setExpanded] = useState(false);

  // Fetch detailed storyteller effects when expanded
  const { data: detail } = api.admin.getCountryDetail.useQuery(
    { countryId: country.id },
    { enabled: expanded, refetchOnWindowFocus: false }
  );

  const effects =
    detail?.country?.storytellerEffects?.filter((d: { isActive: boolean }) => d.isActive) ?? [];

  return (
    <div className="glass-surface border-border/30 hover:border-border/60 rounded-xl border shadow-sm transition-all duration-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-3">
          <UnifiedCountryFlag countryName={country.name} flagUrl={country.flag} size="sm" />
          <div>
            <span className="text-foreground font-medium">{country.name}</span>
            <span className="text-muted-foreground ml-2 text-xs">{country.economicTier}</span>
          </div>
        </div>
        <Badge
          variant="outline"
          className="border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        >
          <AlertTriangle className="mr-1 h-3 w-3" />
          {country.activeInterventions} active
        </Badge>
      </button>

      {expanded && effects.length > 0 && (
        <div className="border-border/30 border-t px-3 pb-3">
          <div className="mt-2 space-y-1.5">
            {effects.map(
              (dm: {
                id: string;
                inputType: string;
                value: number;
                description: string | null;
                duration: number | null;
                createdAt: Date;
                worldEventId?: string | null;
              }) => (
                <div
                  key={dm.id}
                  className="glass-hierarchy-child border-border/20 flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {dm.inputType.replace(/_/g, " ")}
                      </Badge>
                      <span className="font-mono text-xs font-medium">
                        {dm.value >= 0 ? "+" : ""}
                        {(dm.value * 100).toFixed(1)}%
                      </span>
                      {dm.worldEventId && (
                        <Badge
                          variant="outline"
                          className="border-blue-500/20 text-xs text-blue-600"
                        >
                          World Event
                        </Badge>
                      )}
                    </div>
                    {dm.description && (
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {dm.description}
                      </p>
                    )}
                    <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(dm.createdAt), { addSuffix: true })}
                      {dm.duration && <span>({dm.duration}yr)</span>}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

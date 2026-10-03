"use client";
// src/app/admin/storyteller/_components/ActiveInterventions.tsx
// Manage running storyteller effect interventions across all countries

import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { ScrollArea } from "~/components/ui/scroll-area";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { formatDistanceToNow } from "date-fns";
import { Flash as Zap, Clock, WarningTriangle as AlertTriangle } from "iconoir-react";
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
          <Skeleton key={i} className="rounded-row h-16 w-full" />
        ))}
      </div>
    );
  }

  if (countriesWithInterventions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Zap className="text-label-secondary mb-3 h-10 w-10" />
        <h3 className="text-label text-title-3">No Active Interventions</h3>
        <p className="text-label-secondary text-body mt-1">
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
          <Zap className="text-yellow h-5 w-5" />
          <h3 className="text-label text-title-3">Active Interventions</h3>
          <Badge variant="warning">
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
    <div className="border-separator hover:border-separator rounded-row duration-fast border transition-[color,background-color,border-color,box-shadow,opacity,transform]">
      <Button
        variant="ghost"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        className="rounded-row h-auto w-full justify-between p-3 text-left font-normal active:scale-100"
      >
        <div className="flex items-center gap-3">
          <UnifiedCountryFlag countryName={country.name} flagUrl={country.flag} size="sm" />
          <div>
            <span className="text-label font-medium">{country.name}</span>
            <span className="text-label-secondary text-footnote ml-2">{country.economicTier}</span>
          </div>
        </div>
        <Badge variant="warning">
          <AlertTriangle className="mr-1 h-3 w-3" />
          {country.activeInterventions} active
        </Badge>
      </Button>

      {expanded && effects.length > 0 && (
        <div className="border-separator border-t px-3 pb-3">
          <div className="mt-2 space-y-2">
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
                  className="bg-surface-secondary border-separator rounded-control flex items-center justify-between border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{dm.inputType.replace(/_/g, " ")}</Badge>
                      <span className="text-caption tabular-nums">
                        {dm.value >= 0 ? "+" : ""}
                        {(dm.value * 100).toFixed(1)}%
                      </span>
                      {dm.worldEventId && <Badge variant="info">World Event</Badge>}
                    </div>
                    {dm.description && (
                      <p className="text-label-secondary text-footnote mt-0.5 truncate">
                        {dm.description}
                      </p>
                    )}
                    <div className="text-label-secondary text-footnote mt-0.5 flex items-center gap-2">
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

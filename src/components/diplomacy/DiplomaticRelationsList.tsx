"use client";

import React from "react";
import { api } from "~/trpc/react";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Globe, Calendar, Landmark, Activity, Handshake, AlertCircle } from "lucide-react";

interface DiplomaticRelationsListProps {
  countryId: string;
}

const STATUS_THEMES: Record<string, { badge: string; text: string; progress: string }> = {
  allied: {
    badge: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
    text: "text-emerald-500",
    progress: "bg-emerald-500",
  },
  friendly: {
    badge: "bg-blue-500/15 text-blue-500 border-blue-500/20",
    text: "text-blue-500",
    progress: "bg-blue-500",
  },
  neutral: {
    badge: "bg-gray-500/15 text-gray-500 border-gray-500/20",
    text: "text-gray-500",
    progress: "bg-gray-500",
  },
  tense: {
    badge: "bg-amber-500/15 text-amber-500 border-amber-500/20",
    text: "text-amber-500",
    progress: "bg-amber-500",
  },
  hostile: {
    badge: "bg-red-500/15 text-red-500 border-red-500/20",
    text: "text-red-500",
    progress: "bg-red-500",
  },
};

export function DiplomaticRelationsList({ countryId }: DiplomaticRelationsListProps) {
  const { data: relations, isLoading, error } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-center">
          <Activity className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-muted-foreground text-xs">Loading diplomatic relations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2 text-center text-red-500">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-semibold">Failed to load relations</p>
          <p className="text-muted-foreground text-xs">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!relations || relations.length === 0) {
    return (
      <div className="border-border/40 bg-muted/20 flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
        <Globe className="text-muted-foreground/40 mb-3 h-10 w-10" />
        <h4 className="text-sm font-semibold">No Diplomatic Relations</h4>
        <p className="text-muted-foreground mt-1 text-xs max-w-sm">
          You haven't established diplomatic relationships with other nations yet. Create an embassy to start building ties.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {relations.map((rel) => {
        const statusKey = (rel.relationship || "neutral").toLowerCase();
        const theme = STATUS_THEMES[statusKey] || STATUS_THEMES.neutral;
        const targetName = rel.targetCountryName || rel.targetCountry || "Unknown Nation";

        return (
          <div
            key={rel.id}
            className="glass-hierarchy-child border-border/40 bg-card/40 flex flex-col justify-between rounded-xl border p-4 shadow-sm backdrop-blur-sm transition-all hover:scale-[1.01] hover:shadow-md"
          >
            {/* Header info */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="border-border/30 overflow-hidden rounded border shrink-0">
                  <UnifiedCountryFlag
                    countryName={targetName}
                    flagUrl={rel.targetCountryFlag || rel.flagUrl}
                    size="md"
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-bold text-foreground">
                    {targetName.replace(/_/g, " ")}
                  </h4>
                  <p className="text-muted-foreground text-[10px]">
                    Established: {formatDate(rel.establishedAt)}
                  </p>
                </div>
              </div>

              <Badge variant="outline" className={`text-[10px] shrink-0 border uppercase font-semibold ${theme.badge}`}>
                {rel.relationship || "NEUTRAL"}
              </Badge>
            </div>

            {/* Strength indicator */}
            <div className="mt-4 space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground font-medium flex items-center gap-1">
                  <Handshake className="h-3 w-3" />
                  Relation Strength
                </span>
                <span className={`font-bold ${theme.text}`}>{rel.strength}%</span>
              </div>
              <Progress value={rel.strength} className="h-1.5" indicatorClassName={theme.progress} />
            </div>

            {/* Details Grid */}
            <div className="border-border/10 mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-[10px]">
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground font-medium flex items-center gap-1">
                  <Landmark className="h-3 w-3 shrink-0 text-cyan-500" />
                  Bilateral Trade
                </span>
                <span className="font-bold text-foreground">
                  {rel.tradeVolume ? formatCurrency(rel.tradeVolume) : "$0"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3 shrink-0 text-amber-500" />
                  Last Contact
                </span>
                <span className="font-bold text-foreground">
                  {formatDate(rel.lastContact)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

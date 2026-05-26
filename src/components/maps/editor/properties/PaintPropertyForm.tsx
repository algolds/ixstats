"use client";

import React, { useState } from "react";
import { Loader2, Users, TrendingUp, Gem, BookOpen } from "lucide-react";
import { api } from "~/trpc/react";

const PAINT_MODES = [
  { key: "population", label: "Population", icon: Users, color: "text-orange-500" },
  { key: "development", label: "Development", icon: TrendingUp, color: "text-blue-500" },
  { key: "resources", label: "Resources", icon: Gem, color: "text-amber-500" },
  { key: "wiki", label: "Wiki Coverage", icon: BookOpen, color: "text-emerald-500" },
] as const;

interface PaintPropertyFormProps {
  countryId?: string;
  onCancel: () => void;
}

export const PaintPropertyForm = React.memo(function PaintPropertyForm({
  countryId,
  onCancel,
}: PaintPropertyFormProps) {
  const [activeMode, setActiveMode] = useState<string>("population");

  const { data: stats, isLoading } = api.geoFeatures.getSubdivisionStats.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId, staleTime: 60_000 }
  );

  const totalPop = stats?.reduce((s, r) => s + (r.population ?? 0), 0) ?? 0;
  const totalArea = stats?.reduce((s, r) => s + (r.areaSqKm ?? 0), 0) ?? 0;
  const avgDev =
    stats && stats.length > 0
      ? (stats.reduce((s, r) => s + r.developmentScore, 0) / stats.length).toFixed(1)
      : "\u2014";

  return (
    <div className="space-y-3">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
        Province Painter
      </h3>

      {/* Map mode selector */}
      <div className="grid grid-cols-2 gap-1.5">
        {PAINT_MODES.map((m) => {
          const Icon = m.icon;
          const isActive = activeMode === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setActiveMode(m.key)}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-accent"
              }`}
            >
              <Icon className={`h-3 w-3 ${isActive ? "text-primary" : m.color}`} />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Summary stats */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        </div>
      ) : stats && stats.length > 0 ? (
        <div className="border-border bg-muted/30 rounded-lg border px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Regions</span>
            <span className="font-medium tabular-nums">{stats.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Population</span>
            <span className="font-medium tabular-nums">{totalPop.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Area</span>
            <span className="font-medium tabular-nums">
              {Math.round(totalArea).toLocaleString()} km&sup2;
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Avg Development</span>
            <span className="font-medium tabular-nums">{avgDev}/10</span>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">No regions to analyze.</p>
      )}

      {/* Per-region ranking */}
      {stats && stats.length > 0 && (
        <div className="space-y-1">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            {PAINT_MODES.find((m) => m.key === activeMode)?.label} Ranking
          </div>
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {[...stats]
              .sort((a, b) => {
                switch (activeMode) {
                  case "population":
                    return (b.population ?? 0) - (a.population ?? 0);
                  case "development":
                    return b.developmentScore - a.developmentScore;
                  case "resources":
                    return b.resourceCount - a.resourceCount;
                  case "wiki":
                    return (
                      (b.totalFeatures > 0 ? b.wikiLinked / b.totalFeatures : 0) -
                      (a.totalFeatures > 0 ? a.wikiLinked / a.totalFeatures : 0)
                    );
                  default:
                    return 0;
                }
              })
              .map((s, i) => (
                <div
                  key={s.id}
                  className="hover:bg-accent flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px]"
                >
                  <span className="text-muted-foreground w-4 shrink-0 text-right font-mono text-[10px]">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px] tabular-nums">
                    {activeMode === "population" && (s.population ?? 0).toLocaleString()}
                    {activeMode === "development" && s.developmentScore.toFixed(1)}
                    {activeMode === "resources" && s.resourceCount}
                    {activeMode === "wiki" && `${s.wikiLinked}/${s.totalFeatures}`}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      <button
        onClick={onCancel}
        className="border-border text-foreground/80 hover:bg-accent w-full rounded-lg border px-3 py-1.5 text-sm transition-colors"
      >
        Done
      </button>
    </div>
  );
});

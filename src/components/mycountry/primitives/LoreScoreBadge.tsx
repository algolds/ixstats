"use client";

/**
 * LoreScoreBadge — Compact display of a country's Lore Score.
 *
 * Shows the score (0-100) with tier label and color.
 * Creates a visible incentive to invest in worldbuilding.
 */

import { memo } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";

const TIER_COLORS: Record<string, string> = {
  Newcomer: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  Established: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  Distinguished: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  "Master Worldbuilder": "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  Legendary: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

interface LoreScoreBadgeProps {
  countryId: string;
  variant?: "compact" | "detailed";
}

export const LoreScoreBadge = memo(function LoreScoreBadge({
  countryId,
  variant = "compact",
}: LoreScoreBadgeProps) {
  const { data: score, isLoading } = api.countries.getLoreScore.useQuery(
    { countryId },
    { staleTime: 30 * 60_000, gcTime: 60 * 60_000, enabled: !!countryId }
  );

  if (isLoading) {
    return (
      <span className="bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5">
        <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
      </span>
    );
  }

  if (!score) return null;

  const colorClass = TIER_COLORS[score.tier] ?? TIER_COLORS.Newcomer;

  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorClass}`}
        title={`Lore Score: ${score.total}/100 — ${score.tier}`}
      >
        <BookOpen className="h-3 w-3" />
        {score.total}
      </span>
    );
  }

  // Detailed variant
  return (
    <div
      className={`border-border/30 rounded-lg border p-3 ${colorClass.replace("text-", "").includes("bg-") ? "" : ""}`}
    >
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4" />
        <div>
          <div className="text-sm font-bold">{score.total}/100</div>
          <div className="text-[10px] font-medium opacity-80">{score.tier}</div>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        <ScoreBar label="Wiki Depth" value={score.components.wikiDepth} max={50} />
        <ScoreBar label="Map Stories" value={score.components.mapStorytelling} max={25} />
        <ScoreBar label="Engagement" value={score.components.engagement} max={25} />
      </div>
    </div>
  );
});

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-20 text-[9px]">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-black/5 dark:bg-white/5">
        <div
          className="h-full rounded-full bg-current opacity-60 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-[9px] font-medium">
        {value}/{max}
      </span>
    </div>
  );
}

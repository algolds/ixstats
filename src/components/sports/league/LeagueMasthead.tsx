"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Trophy,
  Play,
  Settings,
  SystemRestart as Loader2,
  Calendar,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { withBasePath } from "~/lib/base-path";
import type { SportThemeConfig as SportTheme } from "~/lib/sports/theming";
import { cn } from "~/lib/utils";

export interface LeagueMastheadProps {
  league: {
    id: string;
    name: string;
    sportPreset?: string | null;
    logo?: string | null;
    teamCount?: number;
    archetype?: string;
  };
  archetypeLabel: string;
  sportTheme: SportTheme;
  activeSeason?: {
    id: string;
    seasonNumber: number;
    status: string;
  } | null;
  latestSeason?: {
    id: string;
    seasonNumber: number;
    status: string;
  } | null;
  nextMatchDay?: number | null;
  totalMatchDays?: number;
  progressPct?: number;
  canManageLeague?: boolean;
  onOpenSettings?: () => void;
  onSimulateMatchDay?: () => void;
  isSimulatingMatchDay?: boolean;
  className?: string;
}

export function LeagueMasthead({
  league,
  archetypeLabel,
  sportTheme,
  activeSeason,
  latestSeason,
  nextMatchDay,
  totalMatchDays = 38,
  progressPct = 0,
  canManageLeague = false,
  onOpenSettings,
  onSimulateMatchDay,
  isSimulatingMatchDay = false,
  className,
}: LeagueMastheadProps) {
  const isSeasonActive = activeSeason?.status === "in_progress";
  const seasonNumber = activeSeason?.seasonNumber ?? latestSeason?.seasonNumber ?? 1;

  const handleSimulateClick = () => {
    onSimulateMatchDay?.();
  };

  const handleSettingsClick = () => {
    onOpenSettings?.();
  };

  return (
    <header
      className={cn(
        "rounded-sheet border-separator bg-surface shadow-card relative overflow-hidden border p-6 md:p-8",
        className
      )}
    >
      {/* ─── Breadcrumbs & Utilities ─── */}
      <div className="border-separator mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="text-footnote text-label-secondary flex items-center gap-2 font-semibold">
          <Link
            href={withBasePath("/myleague")}
            className="hover:text-label flex items-center gap-2 transition-colors active:scale-[0.98]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Leagues</span>
          </Link>
          <span className="text-label-tertiary">/</span>
          <span className="capitalize">{sportTheme.name}</span>
          <span className="text-label-tertiary">/</span>
          <span className="text-label max-w-[200px] truncate font-semibold sm:max-w-[300px]">
            {league.name}
          </span>
        </div>

        {canManageLeague && onOpenSettings && (
          <Button size="sm" variant="outline" onClick={handleSettingsClick} className="px-3">
            <Settings className="h-3.5 w-3.5" />
            <span>Manage League</span>
          </Button>
        )}
      </div>

      {/* ─── Masthead Main Identity Row ─── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: League Crest & Identity */}
        <div className="flex items-center gap-4">
          <div className="rounded-card border-separator bg-surface-secondary shadow-card flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border sm:h-20 sm:w-20">
            {league.logo ? (
              <img
                src={withBasePath(league.logo)}
                alt={league.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <Trophy className="text-yellow h-8 w-8" />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-title-1 sm:text-large-title text-label">{league.name}</h1>
              <Badge
                variant="outline"
                className={cn("text-eyebrow px-3 py-0.5", sportTheme.badgeClass)}
              >
                {sportTheme.name}
              </Badge>
            </div>

            <div className="text-eyebrow text-label-secondary flex flex-wrap items-center gap-2">
              <span>{archetypeLabel}</span>
              <span className="text-label-tertiary">•</span>
              <span>{sportTheme.federationShort}</span>
              <span className="text-label-tertiary">•</span>
              <span>{league.teamCount ?? 0} Teams</span>
              <span className="text-label-tertiary">•</span>
              <span className="text-label">Season {seasonNumber}</span>
            </div>
          </div>
        </div>

        {/* Right: Season Progress Meter & Primary Simulate Trigger */}
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          {/* Status / Round Ticker */}
          <div className="rounded-card border-separator bg-fill-4 text-footnote flex items-center justify-between gap-3 border px-4 py-2 sm:justify-end">
            <div className="flex items-center gap-2">
              <div
                className={cn("h-2 w-2 rounded-full", isSeasonActive ? "bg-green" : "bg-fill")}
              />
              <span className="text-label font-semibold">
                {isSeasonActive
                  ? nextMatchDay
                    ? `Matchday ${nextMatchDay}`
                    : "Finals in Progress"
                  : latestSeason?.status === "completed"
                    ? "Season Completed"
                    : "Season Not Started"}
              </span>
            </div>

            {isSeasonActive && totalMatchDays > 0 && (
              <span className="text-footnote text-label-secondary font-semibold tabular-nums">
                {Math.round(progressPct)}%
              </span>
            )}
          </div>

          {/* Primary Action Button */}
          {isSeasonActive && onSimulateMatchDay && (
            <Button onClick={handleSimulateClick} disabled={isSimulatingMatchDay} className="px-5">
              {isSimulatingMatchDay ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Simulating...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  <span>Simulate (Space)</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export default LeagueMasthead;

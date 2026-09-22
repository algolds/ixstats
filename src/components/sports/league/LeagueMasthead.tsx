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
import { soundEffects } from "~/lib/sound/cuelume";
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
    soundEffects.press();
    onSimulateMatchDay?.();
  };

  const handleSettingsClick = () => {
    soundEffects.press();
    onOpenSettings?.();
  };

  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/40 bg-card/75 p-6 shadow-xl backdrop-blur-2xl md:p-8",
        className
      )}
    >
      {/* ─── Breadcrumbs & Utilities ─── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border/20 pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Link
            href={withBasePath("/myleague")}
            data-cuelume-press="subtle"
            className="flex items-center gap-1.5 transition-colors hover:text-foreground active:scale-[0.98]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Leagues</span>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="capitalize">{sportTheme.name}</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-bold text-foreground truncate max-w-[200px] sm:max-w-[300px]">
            {league.name}
          </span>
        </div>

        {canManageLeague && onOpenSettings && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleSettingsClick}
            data-cuelume-press="subtle"
            className="h-8 gap-1.5 rounded-xl border-border/50 bg-card/60 px-3 text-xs font-bold hover:bg-muted/40 active:scale-[0.98] cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Manage League</span>
          </Button>
        )}
      </div>

      {/* ─── Masthead Main Identity Row ─── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: League Crest & Identity */}
        <div className="flex items-center gap-4.5">
          <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/50 bg-background/80 shadow-xl">
            {league.logo ? (
              <img
                src={withBasePath(league.logo)}
                alt={league.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <Trophy className="h-8 w-8 text-amber-400" />
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {league.name}
              </h1>
              <Badge
                variant="outline"
                className={cn(
                  "px-2.5 py-0.5 text-xs font-black uppercase tracking-wider",
                  sportTheme.badgeClass
                )}
              >
                {sportTheme.name}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span>{archetypeLabel}</span>
              <span className="text-muted-foreground/40">•</span>
              <span>{sportTheme.federationShort}</span>
              <span className="text-muted-foreground/40">•</span>
              <span>{league.teamCount ?? 0} Teams</span>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-foreground">Season {seasonNumber}</span>
            </div>
          </div>
        </div>

        {/* Right: Season Progress Meter & Primary Simulate Trigger */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Status / Round Ticker */}
          <div className="flex items-center justify-between sm:justify-end gap-3 rounded-2xl border border-border/30 bg-muted/20 px-4 py-2 text-xs">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  isSeasonActive
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-muted-foreground/50"
                )}
              />
              <span className="font-bold text-foreground">
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
              <span className="font-mono text-xs font-semibold text-muted-foreground">
                {Math.round(progressPct)}%
              </span>
            )}
          </div>

          {/* Primary Action Button */}
          {isSeasonActive && onSimulateMatchDay && (
            <Button
              onClick={handleSimulateClick}
              disabled={isSimulatingMatchDay}
              data-cuelume-press="subtle"
              className="h-10 gap-2 rounded-xl bg-primary px-5 font-black text-xs text-primary-foreground shadow-lg transition hover:opacity-90 active:scale-[0.98] cursor-pointer"
            >
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

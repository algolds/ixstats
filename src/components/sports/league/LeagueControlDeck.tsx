"use client";

import React, { useState } from "react";
import {
  Settings,
  Shield,
  Play,
  FastArrowRight as FastForward,
  SystemRestart as Loader2,
  Trophy,
  Refresh,
  Trash,
  CheckCircle,
  Eye,
  Flash,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { soundEffects } from "~/lib/sound/cuelume";
import { cn } from "~/lib/utils";

export interface LeagueControlDeckProps {
  leagueId: string;
  canManageLeague: boolean;
  isCanonical?: boolean;
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
  hasMatchesPlayed?: boolean;
  onOpenSettings?: () => void;
  onSimulateMatchDay?: () => void;
  isSimulatingMatchDay?: boolean;
  onSimulateFullSeason?: () => void;
  isSimulatingFullSeason?: boolean;
  onTransitionSeason?: () => void;
  isTransitioningSeason?: boolean;
  onStartSeason?: () => void;
  isStartingSeason?: boolean;
  className?: string;
}

export function LeagueControlDeck({
  leagueId,
  canManageLeague,
  isCanonical = false,
  activeSeason,
  latestSeason,
  nextMatchDay,
  hasMatchesPlayed = false,
  onOpenSettings,
  onSimulateMatchDay,
  isSimulatingMatchDay = false,
  onSimulateFullSeason,
  isSimulatingFullSeason = false,
  onTransitionSeason,
  isTransitioningSeason = false,
  onStartSeason,
  isStartingSeason = false,
  className,
}: LeagueControlDeckProps) {
  const notify = useNotify();
  const utils = api.useUtils();

  // Featured league live query & mutation (only enabled for managers)
  const { data: featuredLeagueId } = api.sports.getFeaturedLeagueId.useQuery(undefined, {
    enabled: canManageLeague,
  });
  const isFeatured = featuredLeagueId === leagueId;

  const setFeaturedMutation = api.sports.setFeaturedLeague.useMutation({
    onSuccess: () => {
      soundEffects.bloom();
      notify.success(isFeatured ? "League removed from lobby showcase" : "League pinned to lobby showcase");
      void utils.sports.getFeaturedLeagueId.invalidate();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to update featured league");
    },
  });

  // Purge cache live mutation
  const clearCacheMutation = api.sports.clearSportsCache.useMutation({
    onSuccess: () => {
      soundEffects.bloom();
      notify.success("Sports cache purged");
      void utils.sports.getLeague.invalidate({ id: leagueId });
      void utils.sports.getStandings.invalidate();
      void utils.sports.getSchedule.invalidate();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to clear cache");
    },
  });

  // Regenerate schedule live mutation
  const regenerateScheduleMutation = api.sports.regenerateSchedule.useMutation({
    onSuccess: () => {
      soundEffects.bloom();
      notify.success("Schedule regenerated and shuffled");
      if (activeSeason) {
        void utils.sports.getSchedule.invalidate({ seasonId: activeSeason.id });
      }
    },
    onError: (err) => {
      notify.error(err.message || "Cannot regenerate schedule");
    },
  });

  const isSeasonActive = activeSeason?.status === "in_progress";

  if (!canManageLeague) {
    return null;
  }

  return (
    <div
      className={cn(
        "facet-hierarchy-child rounded-2xl border border-border/40 bg-card/80 p-4 shadow-lg backdrop-blur-2xl space-y-4",
        className
      )}
    >
      {/* ─── 1. Header: Commissioner Identity ─── */}
      <div className="flex items-center justify-between border-b border-border/20 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
              Admin Controls
            </h4>
            <span className="text-[10px] text-muted-foreground font-semibold">
              Commissioner
            </span>
          </div>
        </div>

        <Badge
          variant="outline"
          className="border-emerald-500/40 bg-emerald-500/10 text-[9px] font-black uppercase text-emerald-400 tracking-wider"
        >
          Admin
        </Badge>
      </div>

      {/* ─── 2. Live Lobby Featured Toggle ─── */}
      <div className="flex items-center justify-between rounded-xl border border-border/30 bg-muted/20 p-2.5">
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-foreground block">
            Feature on Sports Page
          </span>
          <span className="text-[10px] text-muted-foreground block">
            Show at top of leagues list
          </span>
        </div>
        <Switch
          checked={isFeatured}
          onCheckedChange={(checked) => {
            soundEffects.press();
            setFeaturedMutation.mutate({ leagueId: checked ? leagueId : null });
          }}
          disabled={setFeaturedMutation.isPending}
        />
      </div>

      {/* ─── 3. Simulation & Season Runtime ─── */}
      <div className="space-y-2 pt-1 border-t border-border/20">
        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
          Season Controls
        </span>

        {/* Fast-Forward Full Season */}
        {isSeasonActive && onSimulateFullSeason && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              soundEffects.press();
              onSimulateFullSeason();
            }}
            disabled={isSimulatingFullSeason || isSimulatingMatchDay}
            data-cuelume-press="subtle"
            className="w-full h-8.5 justify-start gap-2 rounded-xl border-amber-500/30 bg-amber-500/10 text-xs font-bold text-amber-500 hover:bg-amber-500/20 active:scale-[0.98] cursor-pointer"
          >
            {isSimulatingFullSeason ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <FastForward className="h-3.5 w-3.5" />
                <span>Simulate Rest of Season</span>
              </>
            )}
          </Button>
        )}

        {/* Reshuffle / Regenerate Schedule (Allowed before matches played) */}
        {isSeasonActive && !hasMatchesPlayed && activeSeason && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              soundEffects.press();
              regenerateScheduleMutation.mutate({ seasonId: activeSeason.id });
            }}
            disabled={regenerateScheduleMutation.isPending}
            data-cuelume-press="subtle"
            className="w-full h-8.5 justify-start gap-2 rounded-xl border-border/40 bg-card/60 text-xs font-bold text-foreground hover:bg-muted/30 active:scale-[0.98] cursor-pointer"
          >
            {regenerateScheduleMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Regenerating...</span>
              </>
            ) : (
              <>
                <Refresh className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Regenerate Schedule</span>
              </>
            )}
          </Button>
        )}

        {/* Launch Next Season */}
        {latestSeason?.status === "completed" && onTransitionSeason && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              soundEffects.press();
              onTransitionSeason();
            }}
            disabled={isTransitioningSeason}
            data-cuelume-press="subtle"
            className="w-full h-8.5 justify-start gap-2 rounded-xl border-emerald-500/30 bg-emerald-500/10 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 active:scale-[0.98] cursor-pointer"
          >
            {isTransitioningSeason ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Starting Season...</span>
              </>
            ) : (
              <>
                <Trophy className="h-3.5 w-3.5" />
                <span>Start Season {(latestSeason.seasonNumber ?? 1) + 1}</span>
              </>
            )}
          </Button>
        )}

        {/* Start Inaugural Season */}
        {!activeSeason && latestSeason?.status !== "completed" && onStartSeason && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              soundEffects.press();
              onStartSeason();
            }}
            disabled={isStartingSeason}
            data-cuelume-press="subtle"
            className="w-full h-8.5 justify-start gap-2 rounded-xl border-emerald-500/30 bg-emerald-500/10 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 active:scale-[0.98] cursor-pointer"
          >
            {isStartingSeason ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Starting...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Start Season 1</span>
              </>
            )}
          </Button>
        )}
      </div>

      {/* ─── 4. Administration & Utilities ─── */}
      <div className="space-y-2 pt-1 border-t border-border/20">
        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
          League Settings
        </span>

        {/* Open Settings Modal */}
        {onOpenSettings && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              soundEffects.press();
              onOpenSettings();
            }}
            data-cuelume-press="subtle"
            className="w-full h-8.5 justify-start gap-2 rounded-xl border-border/50 bg-card/60 text-xs font-bold text-foreground hover:bg-muted/40 active:scale-[0.98] cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Rules and Teams</span>
          </Button>
        )}

        {/* Purge Cache Button */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            soundEffects.press();
            clearCacheMutation.mutate();
          }}
          disabled={clearCacheMutation.isPending}
          data-cuelume-press="subtle"
          className="w-full h-8.5 justify-start gap-2 rounded-xl border-border/40 bg-card/60 text-xs font-bold text-muted-foreground hover:text-foreground active:scale-[0.98] cursor-pointer"
        >
          <Refresh className={cn("h-3.5 w-3.5", clearCacheMutation.isPending && "animate-spin")} />
          <span>Clear Cache</span>
        </Button>
      </div>
    </div>
  );
}

export default LeagueControlDeck;

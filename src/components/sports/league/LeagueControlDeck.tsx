"use client";

import React from "react";
import {
  Settings,
  Shield,
  Play,
  FastArrowRight as FastForward,
  SystemRestart as Loader2,
  Trophy,
  Refresh,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { soundCues } from "~/lib/sound/cuelume";
import { cn } from "~/lib/utils";

interface LeagueControlDeckProps {
  leagueId: string;
  canManageLeague: boolean;
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
  hasMatchesPlayed?: boolean;
  onOpenSettings?: () => void;
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
  activeSeason,
  latestSeason,
  hasMatchesPlayed = false,
  onOpenSettings,
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
      soundCues.success();
      notify.success(
        isFeatured ? "League removed from lobby showcase" : "League pinned to lobby showcase"
      );
      void utils.sports.getFeaturedLeagueId.invalidate();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to update featured league");
    },
  });

  // Purge cache live mutation
  const clearCacheMutation = api.sports.clearSportsCache.useMutation({
    onSuccess: () => {
      soundCues.success();
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
      soundCues.success();
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
        "bg-surface-secondary border-separator rounded-card bg-surface shadow-card space-y-4 border p-4",
        className
      )}
    >
      {/* 1. Header: Commissioner Identity */}
      <div className="border-separator flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-control border-tint/30 bg-tint-fill text-tint flex h-7 w-7 items-center justify-center border">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-eyebrow text-label">Admin controls</h4>
            <span className="text-footnote text-label-secondary font-semibold">Commissioner</span>
          </div>
        </div>

        <Badge variant="outline" className="border-green/40 bg-green/10 text-eyebrow text-green">
          Admin
        </Badge>
      </div>

      {/* 2. Live Lobby Featured Toggle */}
      <div className="rounded-row border-separator bg-fill-4 flex items-center justify-between border p-3">
        <div className="space-y-0.5">
          <span className="text-footnote text-label block font-semibold">
            Feature on sports page
          </span>
          <span className="text-footnote text-label-secondary block">
            Show at top of leagues list
          </span>
        </div>
        <Switch
          checked={isFeatured}
          onCheckedChange={(checked) => {
            setFeaturedMutation.mutate({ leagueId: checked ? leagueId : null });
          }}
          disabled={setFeaturedMutation.isPending}
        />
      </div>

      {/* 3. Simulation & Season Runtime */}
      <div className="border-separator space-y-2 border-t pt-1">
        <span className="text-eyebrow text-label-secondary block">Season controls</span>

        {/* Fast-Forward Full Season */}
        {isSeasonActive && onSimulateFullSeason && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onSimulateFullSeason();
            }}
            disabled={isSimulatingFullSeason || isSimulatingMatchDay}
            className="rounded-row border-yellow/30 bg-yellow/10 text-footnote text-yellow hover:bg-yellow/20 h-8.5 w-full cursor-pointer justify-start gap-2 font-semibold"
          >
            {isSimulatingFullSeason ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <FastForward className="h-3.5 w-3.5" />
                <span>Simulate rest of season</span>
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
              regenerateScheduleMutation.mutate({ seasonId: activeSeason.id });
            }}
            disabled={regenerateScheduleMutation.isPending}
            className="rounded-row border-separator bg-surface text-footnote text-label hover:bg-fill-4 h-8.5 w-full cursor-pointer justify-start gap-2 font-semibold"
          >
            {regenerateScheduleMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Regenerating...</span>
              </>
            ) : (
              <>
                <Refresh className="text-label-secondary h-3.5 w-3.5" />
                <span>Regenerate schedule</span>
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
              onTransitionSeason();
            }}
            disabled={isTransitioningSeason}
            className="rounded-row border-green/30 bg-green/10 text-footnote text-green hover:bg-green/20 h-8.5 w-full cursor-pointer justify-start gap-2 font-semibold"
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
              onStartSeason();
            }}
            disabled={isStartingSeason}
            className="rounded-row border-green/30 bg-green/10 text-footnote text-green hover:bg-green/20 h-8.5 w-full cursor-pointer justify-start gap-2 font-semibold"
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

      {/* 4. Administration & Utilities */}
      <div className="border-separator space-y-2 border-t pt-1">
        <span className="text-eyebrow text-label-secondary block">League settings</span>

        {/* Open Settings Modal */}
        {onOpenSettings && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onOpenSettings();
            }}
            className="rounded-row border-separator bg-surface text-footnote text-label hover:bg-fill-3 h-8.5 w-full cursor-pointer justify-start gap-2 font-semibold"
          >
            <Settings className="text-label-secondary h-3.5 w-3.5" />
            <span>Rules and teams</span>
          </Button>
        )}

        {/* Purge Cache Button */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            clearCacheMutation.mutate();
          }}
          disabled={clearCacheMutation.isPending}
          className="rounded-row border-separator bg-surface text-footnote text-label-secondary hover:text-label h-8.5 w-full cursor-pointer justify-start gap-2 font-semibold"
        >
          <Refresh className={cn("h-3.5 w-3.5", clearCacheMutation.isPending && "animate-spin")} />
          <span>Clear cache</span>
        </Button>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import {
  Settings,
  Shield,
  Play,
  FastArrowRight as FastForward,
  Trophy,
  Refresh,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { CardTitle } from "~/components/ui/card";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { LensCard } from "~/components/ui/lens-card";
import { Switch } from "~/components/ui/switch";
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

  const seasonRows = (
    <>
      {isSeasonActive && onSimulateFullSeason && (
        <FacetRow
          leading={<FastForward />}
          title={isSimulatingFullSeason ? "Simulating" : "Simulate rest of season"}
          onClick={onSimulateFullSeason}
          disabled={isSimulatingFullSeason || isSimulatingMatchDay}
        />
      )}
      {isSeasonActive && !hasMatchesPlayed && activeSeason && (
        <FacetRow
          leading={<Refresh />}
          title={regenerateScheduleMutation.isPending ? "Regenerating" : "Regenerate schedule"}
          onClick={() => regenerateScheduleMutation.mutate({ seasonId: activeSeason.id })}
          disabled={regenerateScheduleMutation.isPending}
        />
      )}
      {latestSeason?.status === "completed" && onTransitionSeason && (
        <FacetRow
          leading={<Trophy />}
          title={
            isTransitioningSeason
              ? "Starting season"
              : `Start season ${(latestSeason.seasonNumber ?? 1) + 1}`
          }
          onClick={onTransitionSeason}
          disabled={isTransitioningSeason}
        />
      )}
      {!activeSeason && latestSeason?.status !== "completed" && onStartSeason && (
        <FacetRow
          leading={<Play />}
          title={isStartingSeason ? "Starting" : "Start season 1"}
          onClick={onStartSeason}
          disabled={isStartingSeason}
        />
      )}
    </>
  );

  return (
    <LensCard padding="md" className={cn("space-y-3", className)}>
      <CardTitle icon={<Shield />}>League controls</CardTitle>

      <label className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="text-subhead text-label block">Feature on MyLeague</span>
          <span className="text-footnote text-label-secondary block">
            Shows this league above the list
          </span>
        </span>
        <Switch
          checked={isFeatured}
          onCheckedChange={(checked) => {
            setFeaturedMutation.mutate({ leagueId: checked ? leagueId : null });
          }}
          disabled={setFeaturedMutation.isPending}
        />
      </label>

      <FacetList variant="plain" className="gap-3">
        <FacetListSection header="Season" headerAs="h4">
          {seasonRows}
        </FacetListSection>
        <FacetListSection header="Settings" headerAs="h4">
          {onOpenSettings && (
            <FacetRow leading={<Settings />} title="Rules and teams" onClick={onOpenSettings} />
          )}
          <FacetRow
            leading={<Refresh />}
            title={clearCacheMutation.isPending ? "Clearing cache" : "Clear cache"}
            onClick={() => clearCacheMutation.mutate()}
            disabled={clearCacheMutation.isPending}
          />
        </FacetListSection>
      </FacetList>
    </LensCard>
  );
}

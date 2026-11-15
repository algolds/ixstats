"use client";

import React from "react";
import Link from "next/link";
import { Play, Settings, SystemRestart as Loader2, OpenBook as BookOpen } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { monogram } from "~/components/sports/monogram";
import { PublishStandingsButton } from "~/components/sports/league/PublishStandingsButton";
import { withBasePath } from "~/lib/base-path";
import { parseWikiSource, wikiReaderPath } from "~/lib/wiki-os/config";
import type { SportThemeConfig as SportTheme } from "~/lib/sports/theming";
import { cn } from "~/lib/utils";

interface LeagueMastheadProps {
  league: {
    id: string;
    name: string;
    sportPreset?: string | null;
    logo?: string | null;
    wikiSlug?: string | null;
    wikiSource?: string | null;
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
  /** Fixtures (or races) played so far this season, out of the schedule's total. */
  played?: { done: number; total: number; unit: "matches" | "races" };
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
  played,
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

  const statusLabel = isSeasonActive
    ? nextMatchDay
      ? `Matchday ${nextMatchDay}`
      : "Finals in progress"
    : latestSeason?.status === "completed"
      ? "Season completed"
      : "Season not started";
  const facts = [
    archetypeLabel,
    sportTheme.federationShort,
    `${league.teamCount ?? 0} teams`,
    `Season ${seasonNumber}`,
    ...(isSeasonActive && played && played.total > 0
      ? [
          `${played.done.toLocaleString()} of ${played.total.toLocaleString()} ${played.unit} played`,
        ]
      : []),
  ].join(" · ");

  return (
    <Card
      content="entity"
      padding="md"
      className={cn(
        "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {league.logo ? (
          <img
            src={withBasePath(league.logo)}
            alt=""
            className="rounded-row size-14 shrink-0 object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="bg-tint-fill text-tint-ink rounded-row text-title-3 flex size-14 shrink-0 items-center justify-center select-none"
          >
            {monogram(league.name)}
          </span>
        )}
        <div className="min-w-0 space-y-1">
          <p className="text-headline text-label flex items-center gap-2">
            <span
              aria-hidden
              className={cn("size-2 rounded-full", isSeasonActive ? "bg-green" : "bg-fill")}
            />
            {statusLabel}
          </p>
          <p className="text-footnote text-label-secondary tabular-nums">{facts}</p>
          {league.wikiSlug && (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={wikiReaderPath(league.wikiSlug, parseWikiSource(league.wikiSource))}
                className="text-footnote text-label-secondary hover:text-label focus-visible:outline-tint rounded-control-sm duration-fast inline-flex items-center gap-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <BookOpen aria-hidden className="size-3.5" />
                <span>Wiki article</span>
              </Link>
              {canManageLeague && parseWikiSource(league.wikiSource) === "ixwiki" && (
                <PublishStandingsButton leagueId={league.id} />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canManageLeague && onOpenSettings && (
          <Button size="sm" variant="secondary" onClick={handleSettingsClick}>
            <Settings />
            Manage league
          </Button>
        )}
        {isSeasonActive && onSimulateMatchDay && (
          <Button size="sm" onClick={handleSimulateClick} disabled={isSimulatingMatchDay}>
            {isSimulatingMatchDay ? (
              <>
                <Loader2 className="animate-spin motion-reduce:animate-none" />
                Simulating
              </>
            ) : (
              <>
                <Play />
                Simulate matchday
              </>
            )}
          </Button>
        )}
      </div>
    </Card>
  );
}

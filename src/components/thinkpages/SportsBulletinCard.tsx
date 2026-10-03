"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy, NavArrowRight as ChevronRight, Shield, Flash as Zap } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { cn } from "~/lib/utils";
import type { SportsBulletinData } from "~/lib/sports/feed-bulletins";
import { Card } from "~/components/ui/card";

interface SportsBulletinCardProps {
  data: SportsBulletinData;
  author?: {
    displayName?: string;
    username?: string;
    profileImageUrl?: string;
  } | null;
  className?: string;
}

type BulletinResult = NonNullable<SportsBulletinData["results"]>[number];
type BulletinMover = NonNullable<SportsBulletinData["movers"]>[number];

function bulletinSubtitle({
  isChampionBulletin,
  isPlayoffBulletin,
  roundName,
  matchDay,
}: Pick<
  SportsBulletinData,
  "isChampionBulletin" | "isPlayoffBulletin" | "roundName" | "matchDay"
>) {
  if (isChampionBulletin) return "Final season standings";
  if (isPlayoffBulletin) return roundName || "Playoffs";
  return matchDay ? `Matchday ${matchDay}` : "Official league bulletin";
}

function ChampionBanner({ name, id }: { name: string; id?: string | number | null }) {
  return (
    <div className="bg-yellow/10 rounded-row m-3 flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <div className="bg-yellow/15 text-yellow rounded-row flex size-12 items-center justify-center">
          <Trophy className="size-6" aria-hidden="true" />
        </div>
        <div>
          <Eyebrow className="text-yellow">League champion</Eyebrow>
          <h3 className="text-title-3 text-label">{name}</h3>
        </div>
      </div>
      {id && (
        <Button asChild variant="secondary" size="sm">
          <Link href={`/myclub/${id}`}>
            <span>View club</span>
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      )}
    </div>
  );
}

function MatchRow({ result: res }: { result: BulletinResult }) {
  const homeWon = res.homeScore > res.awayScore;
  const awayWon = res.awayScore > res.homeScore;

  return (
    <div className="bg-surface-secondary rounded-row relative flex items-center justify-between p-3">
      <div className="min-w-0 flex-1 space-y-1 pr-2">
        <TeamLine team={res.home} won={homeWon} />
        <TeamLine team={res.away} won={awayWon} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {res.isUpset && (
          <Badge variant="warning">
            <Zap aria-hidden="true" />
            Upset
          </Badge>
        )}
        <div className="bg-surface text-label text-headline rounded-control-sm flex items-center gap-1 px-2 py-1 tabular-nums">
          <span className={cn(homeWon && "text-yellow")}>{res.homeScore}</span>
          <span className="text-label-tertiary">–</span>
          <span className={cn(awayWon && "text-yellow")}>{res.awayScore}</span>
        </div>
      </div>
    </div>
  );
}

function MoverRow({ mover }: { mover: BulletinMover }) {
  const jump = mover.oldRank - mover.newRank;
  const isUp = jump > 0;
  const isDown = jump < 0;

  return (
    <div className="bg-surface-secondary rounded-row flex items-center justify-between px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <div className="bg-fill-3 text-label text-caption rounded-control-sm flex h-7 min-w-8 shrink-0 items-center justify-center px-2 tabular-nums">
          #{mover.newRank}
        </div>

        <Badge
          variant={isUp ? "success" : isDown ? "destructive" : "default"}
          className="tabular-nums"
        >
          {isUp ? `▲${jump}` : isDown ? `▼${Math.abs(jump)}` : "—"}
        </Badge>

        {mover.id ? (
          <Link
            href={`/myclub/${mover.id}`}
            className="text-headline text-label hover:text-yellow truncate transition-colors"
          >
            {mover.name}
          </Link>
        ) : (
          <span className="text-headline text-label truncate">{mover.name}</span>
        )}
      </div>

      <span className="text-caption text-yellow shrink-0 tabular-nums">Rank #{mover.newRank}</span>
    </div>
  );
}

export function SportsBulletinCard({ data, author: _author, className }: SportsBulletinCardProps) {
  const {
    league,
    sportEmoji,
    results = [],
    movers = [],
    isChampionBulletin,
    championName,
    championId,
    llmSummary,
  } = data;

  const hasMovers = movers.length > 0;
  const hasSummary = !!llmSummary;
  const [activeTab, setActiveTab] = useState<"matches" | "movers" | "summary">("matches");

  const leagueHref = league.id ? `/myclub/${league.id}` : undefined;

  const tabOptions = [
    { value: "matches" as const, label: `Matches (${results.length})` },
    ...(hasMovers ? [{ value: "movers" as const, label: `Rankings (${movers.length})` }] : []),
    ...(hasSummary ? [{ value: "summary" as const, label: "Summary" }] : []),
  ];

  return (
    <Card className={cn("group my-3 overflow-hidden", className)}>
      <div className="border-separator flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="bg-yellow/10 rounded-row flex size-10 shrink-0 items-center justify-center">
            {sportEmoji ? (
              <span className="text-title-2 select-none">{sportEmoji}</span>
            ) : (
              <Trophy className="text-yellow size-5" aria-hidden="true" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-headline text-label">{league.name}</h4>
              {isChampionBulletin && <Badge variant="warning">Champion crowned</Badge>}
            </div>
            <p className="text-footnote text-label-secondary flex items-center gap-2 tabular-nums">
              <span>{bulletinSubtitle(data)}</span>
            </p>
          </div>
        </div>

        {(hasMovers || hasSummary) && results.length > 0 && (
          <SegmentedControl
            size="sm"
            aria-label="Bulletin view"
            value={activeTab}
            onValueChange={setActiveTab}
            options={tabOptions}
          />
        )}
      </div>

      {isChampionBulletin && championName && <ChampionBanner name={championName} id={championId} />}

      <div className="p-3">
        {activeTab === "matches" && (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {results.map((res, idx) => (
              <MatchRow key={idx} result={res} />
            ))}
          </div>
        )}

        {activeTab === "movers" && (
          <div className="space-y-2">
            {movers.map((mover, idx) => (
              <MoverRow key={idx} mover={mover} />
            ))}
          </div>
        )}

        {activeTab === "summary" && llmSummary && (
          <div className="bg-surface-secondary text-body text-label rounded-row p-4 whitespace-pre-wrap">
            {llmSummary}
          </div>
        )}
      </div>

      {leagueHref && (
        <div className="border-separator flex items-center justify-end border-t px-4 py-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={leagueHref}>
              <span>Open league</span>
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      )}
    </Card>
  );
}

type BulletinTeam = NonNullable<SportsBulletinData["results"]>[number]["home"];

function TeamLine({ team, won }: { team: BulletinTeam; won: boolean }) {
  const nameClass = cn(
    "text-footnote truncate",
    won ? "text-label font-semibold" : "text-label-secondary"
  );
  return (
    <div className="flex items-center gap-2">
      <Shield
        aria-hidden="true"
        className={cn("size-3.5 shrink-0", won ? "text-yellow" : "text-label-tertiary")}
      />
      {team.id ? (
        <Link
          href={`/myclub/${team.id}`}
          className={cn(nameClass, "hover:text-yellow transition-colors")}
        >
          {team.name}
        </Link>
      ) : (
        <span className={nameClass}>{team.name}</span>
      )}
    </div>
  );
}

"use client";

import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { withBasePath } from "~/lib/base-path";
import { Skeleton } from "~/components/ui/skeleton";
import { Card } from "~/components/ui/card";

function TeamCrest({
  name,
  color,
  logo,
  className = "h-12 w-12",
}: {
  name: string;
  color: string;
  logo?: string | null;
  className?: string;
}) {
  if (logo) {
    return (
      <img
        src={withBasePath(logo)}
        alt={name}
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      className={`${className} text-body flex shrink-0 items-center justify-center rounded-full font-semibold text-white`}
      style={{ backgroundColor: color }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function CompareRow({
  label,
  left,
  right,
  leftColor,
  rightColor,
}: {
  label: string;
  left: number;
  right: number;
  leftColor: string;
  rightColor: string;
}) {
  const total = left + right || 1;
  const leftPct = (left / total) * 100;
  return (
    <div className="space-y-1">
      <p className="text-label-secondary text-footnote text-center font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-headline w-8 text-right tabular-nums">{left}</span>
        <div className="bg-fill-3 flex h-2 flex-1 overflow-hidden rounded-full">
          <div style={{ width: `${leftPct}%`, backgroundColor: leftColor }} />
          <div style={{ width: `${100 - leftPct}%`, backgroundColor: rightColor }} />
        </div>
        <span className="text-headline w-8 tabular-nums">{right}</span>
      </div>
    </div>
  );
}

function resultClasses(r: string) {
  return r === "W" ? "text-green" : r === "L" ? "text-red" : "text-label-secondary";
}

export function ClubResultsCard({ teamId }: { teamId: string }) {
  const { data, isLoading } = api.sports.getClubResultsOverview.useQuery({ teamId });

  if (isLoading) {
    return (
      <Card padding="lg" className="space-y-3" aria-busy="true" aria-label="Loading results">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="rounded-row h-24 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </Card>
    );
  }
  if (!data || data.recent.length === 0) {
    return (
      <Card padding="lg" className="text-label-secondary text-body text-center">
        No completed matches yet. Start the season to play fixtures.
      </Card>
    );
  }

  const { lastMatch, comparison, recent } = data;
  const fmt = (ix: number | null) => (ix ? IxTime.formatIxTime(ix) : "—");

  return (
    <Card padding="lg" className="space-y-6 overflow-hidden">
      {/* Match Overview (latest result) */}
      {lastMatch && (
        <div className="space-y-4">
          <h3 className="text-headline text-label">Latest result</h3>

          <div className="bg-surface-secondary rounded-row space-y-3 p-4">
            {[lastMatch.home, lastMatch.away].map((side, i) => {
              const score = i === 0 ? lastMatch.homeScore : lastMatch.awayScore;
              const won =
                i === 0
                  ? lastMatch.homeScore > lastMatch.awayScore
                  : lastMatch.awayScore > lastMatch.homeScore;
              return (
                <div key={i}>
                  {i === 1 && (
                    <div className="text-label-secondary text-footnote my-1 flex items-center gap-2">
                      <span className="bg-separator h-px flex-1" /> vs
                      <span className="bg-separator h-px flex-1" />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <TeamCrest name={side.name} color={side.color} logo={side.logo} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{side.name}</p>
                      {side.city && (
                        <p className="text-label-secondary text-footnote truncate">{side.city}</p>
                      )}
                    </div>
                    <span
                      className={`text-large-title tabular-nums ${won ? "" : "text-label-secondary"}`}
                    >
                      {score}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {comparison && (
            <div className="space-y-3">
              <CompareRow
                label="Wins"
                left={comparison.home.wins}
                right={comparison.away.wins}
                leftColor={lastMatch.home.color}
                rightColor={lastMatch.away.color}
              />
              <CompareRow
                label="Losses"
                left={comparison.home.losses}
                right={comparison.away.losses}
                leftColor={lastMatch.home.color}
                rightColor={lastMatch.away.color}
              />
              <CompareRow
                label="Points"
                left={comparison.home.points}
                right={comparison.away.points}
                leftColor={lastMatch.home.color}
                rightColor={lastMatch.away.color}
              />
            </div>
          )}

          <div className="text-label-secondary text-footnote flex items-center justify-between">
            <span className="font-semibold">{lastMatch.leagueName}</span>
            <span>{fmt(lastMatch.resolvedIxTime)}</span>
          </div>
        </div>
      )}

      {/* Last 5 Results */}
      <div className="space-y-2">
        <h3 className="text-headline text-label">Last 5 Results</h3>
        <div className="divide-separator divide-y">
          {recent.map((r) => (
            <div key={r.id} className="text-body flex items-center gap-3 py-3">
              <span className="text-label-secondary text-footnote w-20 shrink-0 tabular-nums">
                {fmt(r.resolvedIxTime)}
              </span>
              <span className="text-label-secondary text-footnote w-6 shrink-0">
                {r.isHome ? "vs" : "@"}
              </span>
              <TeamCrest
                name={r.opponent.name}
                color={r.opponent.color}
                logo={r.opponent.logo}
                className="h-6 w-6"
              />
              <span className="min-w-0 flex-1 truncate font-medium">{r.opponent.name}</span>
              <span className={`shrink-0 font-semibold tabular-nums ${resultClasses(r.result)}`}>
                {r.result} {r.teamScore}-{r.oppScore}
              </span>
              <span className="text-label-secondary text-footnote hidden w-40 shrink-0 truncate text-right sm:block">
                {r.leagueName}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

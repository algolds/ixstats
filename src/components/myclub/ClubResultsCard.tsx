"use client";

import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { withBasePath } from "~/lib/base-path";
import { Card, CardContent } from "~/components/ui/card";

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
      className={`${className} flex shrink-0 items-center justify-center rounded-full text-sm font-bold text-white`}
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
      <p className="text-muted-foreground text-center text-xs font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <span className="w-8 text-right text-sm font-bold tabular-nums">{left}</span>
        <div className="bg-muted flex h-2 flex-1 overflow-hidden rounded-full">
          <div style={{ width: `${leftPct}%`, backgroundColor: leftColor }} />
          <div style={{ width: `${100 - leftPct}%`, backgroundColor: rightColor }} />
        </div>
        <span className="w-8 text-sm font-bold tabular-nums">{right}</span>
      </div>
    </div>
  );
}

function resultClasses(r: string) {
  return r === "W" ? "text-emerald-500" : r === "L" ? "text-rose-500" : "text-muted-foreground";
}

export function ClubResultsCard({ teamId }: { teamId: string }) {
  const { data, isLoading } = api.sports.getClubResultsOverview.useQuery({ teamId });

  if (isLoading) {
    return (
      <Card className="facet-hierarchy-child border-border">
        <CardContent className="text-muted-foreground p-6 text-sm">Loading results…</CardContent>
      </Card>
    );
  }
  if (!data || data.recent.length === 0) {
    return (
      <Card className="facet-hierarchy-child border-border">
        <CardContent className="text-muted-foreground p-6 text-center text-sm">
          No completed matches yet. Results appear here once the season gets underway.
        </CardContent>
      </Card>
    );
  }

  const { lastMatch, comparison, recent } = data;
  const fmt = (ix: number | null) => (ix ? IxTime.formatIxTime(ix) : "—");

  return (
    <Card className="facet-hierarchy-child border-border overflow-hidden rounded-3xl">
      <CardContent className="space-y-6 p-6">
        {/* ── Match Overview (latest result) ───────────────────────── */}
        {lastMatch && (
          <div className="space-y-4">
            <h3 className="text-base font-bold">Latest Result</h3>

            <div className="border-border/40 space-y-3 rounded-2xl border p-4">
              {[lastMatch.home, lastMatch.away].map((side, i) => {
                const score = i === 0 ? lastMatch.homeScore : lastMatch.awayScore;
                const won =
                  i === 0
                    ? lastMatch.homeScore > lastMatch.awayScore
                    : lastMatch.awayScore > lastMatch.homeScore;
                return (
                  <div key={i}>
                    {i === 1 && (
                      <div className="text-muted-foreground my-1 flex items-center gap-2 text-xs">
                        <span className="bg-border h-px flex-1" /> vs
                        <span className="bg-border h-px flex-1" />
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <TeamCrest name={side.name} color={side.color} logo={side.logo} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{side.name}</p>
                        {side.city && (
                          <p className="text-muted-foreground truncate text-xs">{side.city}</p>
                        )}
                      </div>
                      <span
                        className={`text-3xl font-black tabular-nums ${won ? "" : "text-muted-foreground"}`}
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

            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span className="font-semibold">{lastMatch.leagueName}</span>
              <span>{fmt(lastMatch.resolvedIxTime)}</span>
            </div>
          </div>
        )}

        {/* ── Last 5 Results ───────────────────────────────────────── */}
        <div className="space-y-2">
          <h3 className="text-base font-bold">Last 5 Results</h3>
          <div className="divide-border/40 divide-y">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="text-muted-foreground w-20 shrink-0 text-xs tabular-nums">
                  {fmt(r.resolvedIxTime)}
                </span>
                <span className="text-muted-foreground w-6 shrink-0 text-xs">
                  {r.isHome ? "vs" : "@"}
                </span>
                <TeamCrest
                  name={r.opponent.name}
                  color={r.opponent.color}
                  logo={r.opponent.logo}
                  className="h-6 w-6"
                />
                <span className="min-w-0 flex-1 truncate font-medium">{r.opponent.name}</span>
                <span className={`shrink-0 font-bold tabular-nums ${resultClasses(r.result)}`}>
                  {r.result} {r.teamScore}-{r.oppScore}
                </span>
                <span className="text-muted-foreground hidden w-40 shrink-0 truncate text-right text-xs sm:block">
                  {r.leagueName}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

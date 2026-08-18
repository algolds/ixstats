"use client";

/**
 * SportsLiveDIPlugin — a Halo "Live Activity" for the signed-in user's clubs.
 *
 * Mounted globally. When one of the user's clubs has a match resolving inside its
 * IxTime broadcast window, it registers a high-priority DI plugin that takes over
 * the pill with a live, ticking scoreboard — replayed deterministically from the
 * match trace on the shared IxTime clock (no WebSocket, no server ticks).
 */

import React, { useEffect, useMemo, useState } from "react";
import { Radio } from "lucide-react";
import { IxTime } from "~/lib/ixtime";
import { api, type RouterOutputs } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { useDIPlugin } from "~/components/DynamicIsland/plugin-context";
import { useVisibleRefetch } from "~/hooks/useVisibleRefetch";
import { PreText } from "~/components/ui/pretext";
import { computeLiveMatchState } from "~/lib/sports/live-match";
import type { DIViewProps } from "~/components/DynamicIsland/types";

type LiveActivityMatch = RouterOutputs["sports"]["getLiveActivities"][number];

const ACCENT = "#ef4444"; // live red

function shortFor(t: { name: string; shortName?: string | null }): string {
  return t.shortName || t.name.slice(0, 3).toUpperCase();
}

/** Recompute live state once per second off the shared IxTime clock. */
function useLiveMatchState(match: LiveActivityMatch | null) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!match) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [match?.matchId]);

  return useMemo(() => {
    if (!match) return null;
    return computeLiveMatchState({
      trace: match.trace,
      resolvedIxTime: match.resolvedIxTime,
      nowIxTime: IxTime.getCurrentIxTime(),
      windowMs: match.windowMs,
      finalHomeScore: match.finalHomeScore,
      finalAwayScore: match.finalAwayScore,
    });
    // tick drives the recompute
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, tick]);
}

function LivePill({ match }: { match: LiveActivityMatch }) {
  const state = useLiveMatchState(match);
  if (!state) return null;
  return (
    <span className="flex items-center gap-1.5">
      <Radio className={`h-3 w-3 shrink-0 text-red-500 ${state.isFinal ? "" : "animate-pulse"}`} />
      <PreText
        className="text-foreground/90 text-xs font-semibold tabular-nums"
        whiteSpace="nowrap"
      >
        {shortFor(match.homeTeam)} {state.homeScore}–{state.awayScore} {shortFor(match.awayTeam)}
      </PreText>
      <PreText className="text-muted-foreground font-mono text-[10px]" whiteSpace="nowrap">
        {state.isFinal ? "FT" : `${state.minute}'`}
      </PreText>
    </span>
  );
}

function SportsLiveView({ context }: DIViewProps) {
  const match = ((context as any)?.match ?? null) as LiveActivityMatch | null;
  const state = useLiveMatchState(match);
  if (!match || !state) {
    return <div className="text-muted-foreground p-6 text-center text-sm">No live match.</div>;
  }

  return (
    <div className="relative overflow-hidden p-5">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background: `linear-gradient(135deg, ${match.homeTeam.color}25, transparent, ${match.awayTeam.color}25)`,
        }}
      />
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
            <Radio className={`h-2.5 w-2.5 ${state.isFinal ? "" : "animate-pulse"}`} />
            {state.isFinal ? "FULL TIME" : "LIVE"}
          </span>
          <span className="text-muted-foreground truncate text-[11px]">{match.leagueName}</span>
        </div>

        <div className="flex items-center justify-around">
          <TeamBadge team={match.homeTeam} />
          <div className="space-y-1 text-center">
            <div className="flex items-center justify-center gap-2 text-4xl font-extrabold tracking-tighter tabular-nums">
              <span>{state.homeScore}</span>
              <span className="text-foreground/20">:</span>
              <span>{state.awayScore}</span>
            </div>
            <div className="text-muted-foreground font-mono text-xs">
              {state.isFinal ? "FT" : `${state.minute}'`}
            </div>
          </div>
          <TeamBadge team={match.awayTeam} />
        </div>

        {/* Broadcast progress */}
        <div className="bg-muted/40 h-1 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full bg-red-500 transition-all duration-1000 ease-linear"
            style={{ width: `${Math.round(state.progress * 100)}%` }}
          />
        </div>

        <p className="text-muted-foreground min-h-[2rem] text-xs leading-relaxed italic">
          {state.lastEvent?.description ?? "Kickoff — the match is underway."}
        </p>
      </div>
    </div>
  );
}

function TeamBadge({ team }: { team: { name: string; shortName?: string | null; color: string } }) {
  return (
    <div className="flex w-1/3 flex-col items-center text-center">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
        style={{ backgroundColor: `${team.color}20`, border: `2px solid ${team.color}` }}
      >
        {shortFor(team)}
      </div>
      <p className="mt-1.5 max-w-full truncate text-xs font-bold">{team.name}</p>
    </div>
  );
}

/** Registers the plugin for as long as it's mounted (i.e. while a match is live). */
function ActiveSportsLivePlugin({ match }: { match: LiveActivityMatch }) {
  const plugin = useMemo(
    () => ({
      id: "sports-live",
      priority: 100, // a live activity takes over the island, like iOS
      center: <LivePill match={match} />,
      expandedViews: { "sports-live": SportsLiveView },
      accentColor: ACCENT,
      stickyLabel: "Live",
      badge: { color: ACCENT, pulse: true },
      context: { match },
    }),
    [match]
  );
  useDIPlugin(plugin);
  return null;
}

export function SportsLiveDIPlugin() {
  const { isSignedIn } = useUser();
  const refetchInterval = useVisibleRefetch(30_000);
  const { data } = api.sports.getLiveActivities.useQuery(undefined, {
    enabled: isSignedIn,
    refetchInterval,
    refetchOnWindowFocus: true,
  });

  const match = data && data.length > 0 ? data[0]! : null;
  // No live match → render nothing, register nothing (no side effect on the pill).
  if (!match) return null;
  return <ActiveSportsLivePlugin match={match} />;
}

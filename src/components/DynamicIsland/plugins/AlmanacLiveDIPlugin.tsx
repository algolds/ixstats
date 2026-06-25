"use client";

/**
 * AlmanacLiveDIPlugin — a Halo "Live Activity" for the Statecraft Almanac.
 *
 * Mounted globally. When the signed-in user's soonest upcoming event (election / issue
 * deadline / term end) falls inside the imminent window, it registers a high-priority DI
 * plugin that takes over the pill with a live, ticking countdown — recomputed once per
 * second off the shared IxTime clock. Tapping expands the full Almanac. Mirrors
 * SportsLiveDIPlugin. See plans/statecraft-stage1.md (S1.A.3, live activity).
 */

import React, { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { IxTime } from "~/lib/ixtime";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { useDIPlugin } from "~/components/DynamicIsland/plugin-context";
import { PreText } from "~/components/ui/pretext";
import { getUpcomingEvents, formatIxCountdown, type AlmanacEvent } from "~/lib/statecraft-almanac";
import { AlmanacView } from "~/components/DynamicIsland/AlmanacView";

const ACCENT = "#3b82f6"; // almanac blue
const IMMINENT_MS = 2 * 24 * 60 * 60 * 1000; // within ~2 IxDays → goes "live"

/** Re-render once per second so the countdown ticks off the shared IxTime clock. */
function useTickedCountdown(targetIxTime: number): string {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [targetIxTime]);
  return formatIxCountdown(targetIxTime, IxTime.getCurrentIxTime());
}

function CountdownPill({ event }: { event: AlmanacEvent }) {
  const countdown = useTickedCountdown(event.ixTime);
  return (
    <span className="flex items-center gap-1.5">
      <CalendarClock className="h-3 w-3 shrink-0 animate-pulse text-blue-500" />
      <PreText className="text-foreground/90 text-xs font-semibold" whiteSpace="nowrap">
        {event.label}
      </PreText>
      <PreText
        className="text-muted-foreground font-mono text-[10px] tabular-nums"
        whiteSpace="nowrap"
      >
        {countdown}
      </PreText>
    </span>
  );
}

/** Registers the plugin for as long as it's mounted (i.e. while an event is imminent). */
function ActiveAlmanacLivePlugin({ event }: { event: AlmanacEvent }) {
  const plugin = useMemo(
    () => ({
      id: "almanac-live",
      priority: 90, // below sports-live (100) so a live match still wins the island
      center: <CountdownPill event={event} />,
      expandedViews: { almanac: AlmanacView },
      accentColor: ACCENT,
      stickyLabel: "Upcoming",
      badge: { color: ACCENT, pulse: true },
    }),
    [event]
  );
  useDIPlugin(plugin);
  return null;
}

export function AlmanacLiveDIPlugin() {
  const { isSignedIn } = useUser();
  const { data: profile } = api.users.getProfile.useQuery(undefined, {
    enabled: isSignedIn,
    staleTime: 60_000,
  });
  const countryId = profile?.countryId;

  const { data: elections } = api.elections.getElections.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId, refetchInterval: 60_000 }
  );
  const { data: issuesData } = api.nationalIssues.getMyIssues.useQuery(
    { countryId: countryId ?? "", status: "active" },
    { enabled: !!countryId, refetchInterval: 60_000 }
  );

  const imminent = useMemo(() => {
    if (!countryId) return null;
    const now = IxTime.getCurrentIxTime();
    const events = getUpcomingEvents({
      nowIxTime: now,
      elections: (elections ?? []).map((e) => ({
        id: e.id,
        name: e.name,
        scheduledIxTime: e.scheduledIxTime,
        status: e.status,
      })),
      issueDeadlines: (issuesData?.issues ?? []).map((i) => ({
        id: i.id,
        title: i.title,
        deadlineIxTime: (i as { deadlineIxTime?: number | null }).deadlineIxTime,
      })),
    });
    const soonest = events[0];
    return soonest && soonest.ixTime - now <= IMMINENT_MS ? soonest : null;
  }, [countryId, elections, issuesData]);

  // No imminent event → render nothing, register nothing (no takeover).
  if (!imminent) return null;
  return <ActiveAlmanacLivePlugin event={imminent} />;
}

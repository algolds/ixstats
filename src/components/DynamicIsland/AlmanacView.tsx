"use client";

/**
 * AlmanacView — the Statecraft Almanac as a global Halo (Dynamic Island) view.
 *
 * Opened by clicking the IxTime clock anywhere. Fetches the signed-in user's own
 * country's upcoming dated events (same pure `getUpcomingEvents` feed as the MyCountry
 * hero calendar) and lists them with relative IxTime countdowns. See plans/statecraft-stage1.md.
 */

import { useMemo } from "react";
import { Calendar, Clock, ChevronRight } from "lucide-react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { getUpcomingEvents, formatRelativeIxDays } from "~/lib/statecraft-almanac";
import { withBasePath } from "~/lib/base-path";
import { createAbsoluteUrl } from "~/lib/url-utils";
import type { DIViewProps } from "./types";

export function AlmanacView({ onClose }: DIViewProps) {
  const { data: profile } = api.users.getProfile.useQuery(undefined, { staleTime: 60_000 });
  const countryId = profile?.countryId;

  const { data: elections } = api.elections.getElections.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId, staleTime: 60_000 }
  );
  const { data: issuesData } = api.nationalIssues.getMyIssues.useQuery(
    { countryId: countryId ?? "", status: "active" },
    { enabled: !!countryId, staleTime: 60_000 }
  );

  const now = IxTime.getCurrentIxTime();
  const events = useMemo(
    () =>
      getUpcomingEvents({
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
      }),
    [elections, issuesData, now]
  );

  const go = (section: string) => {
    onClose();
    const href = section === "overview" ? "/mycountry" : `/mycountry/${section}`;
    if (typeof window !== "undefined" && window.location.pathname.includes("/mycountry")) {
      window.history.pushState(null, "", withBasePath(href));
      window.dispatchEvent(new PopStateEvent("popstate"));
    } else {
      window.location.href = createAbsoluteUrl(href);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-semibold">Almanac</h3>
        <span className="text-muted-foreground ml-auto text-[11px] tabular-nums">
          {new Date(now).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      {!countryId ? (
        <p className="text-muted-foreground text-xs">
          Sign in with a country to see your upcoming events.
        </p>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground text-xs">No upcoming events scheduled.</p>
      ) : (
        <div className="space-y-1">
          {events.map((ev) => (
            <button
              key={ev.id}
              onClick={() => go(ev.section)}
              className="group hover:bg-accent/50 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors"
            >
              <Clock className="h-3.5 w-3.5 shrink-0 text-blue-500/70" />
              <span className="text-foreground/90 flex-1 truncate text-xs font-medium">
                {ev.label}
              </span>
              <span className="text-muted-foreground text-[10px] tabular-nums">
                {formatRelativeIxDays(ev.ixTime, now)}
              </span>
              <ChevronRight className="text-muted-foreground/40 group-hover:text-muted-foreground h-3 w-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

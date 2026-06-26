"use client";

/**
 * AlmanacView — the Statecraft Almanac as a global Halo (Dynamic Island) view.
 *
 * Opened by clicking the IxTime clock anywhere. A live, ticking clock (StandBy /
 * Lock Screen inspired, Facet glass) on top of the upcoming-events feed
 * (`getUpcomingEvents`, the same feed as the MyCountry hero calendar) with IxTime
 * countdowns. The clock ticks off the shared IxTime store (per-second), so digits
 * are tabular-nums (no layout shift) and the colon pulses each second.
 * See plans/statecraft-stage1.md.
 */

import { useMemo } from "react";
import { Clock, ChevronRight, Zap, Pause, Sun, CalendarDays } from "lucide-react";
import { api } from "~/trpc/react";
import { useIxTime } from "~/contexts/IxTimeContext";
import { getUpcomingEvents, formatRelativeIxDays } from "~/lib/statecraft-almanac";
import { withBasePath } from "~/lib/base-path";
import { createAbsoluteUrl } from "~/lib/url-utils";
import type { DIViewProps } from "./types";

// ─── Time-of-day flavor ──────────────────────────────────────────────────────

function greetingFor(hour: number): { text: string; emoji: string } {
  if (hour >= 5 && hour < 12) return { text: "Good morning", emoji: "🌅" };
  if (hour >= 12 && hour < 17) return { text: "Good afternoon", emoji: "☀️" };
  if (hour >= 17 && hour < 21) return { text: "Good evening", emoji: "🌆" };
  return { text: "Burning the midnight oil?", emoji: "🌙" };
}

// ponytail: northern-hemisphere month→season, flavor only — no astronomical data exists
function seasonFor(month: number): string {
  if (month <= 1 || month === 11) return "Winter";
  if (month <= 4) return "Spring";
  if (month <= 7) return "Summer";
  return "Autumn";
}

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d.getTime() - start) / 86_400_000);
}

export function AlmanacView({ onClose }: DIViewProps) {
  const { ixTimeTimestamp: now, multiplier, isPaused, gameYear } = useIxTime();

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

  // Live clock fields, recomputed each per-second tick of the IxTime store.
  const d = new Date(now);
  const h24 = d.getUTCHours();
  const h12 = h24 % 12 || 12;
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  const ampm = h24 >= 12 ? "PM" : "AM";
  const colonOn = d.getUTCSeconds() % 2 === 0;
  const greeting = greetingFor(h24);
  const dateLine = d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

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
      {/* ── Hero clock ─────────────────────────────────────────────────── */}
      <div className="glass-hierarchy-child relative overflow-hidden rounded-2xl px-5 py-4">
        {/* time-of-day ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl"
        />
        <div className="relative">
          <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium">
            <span className="text-sm leading-none">{greeting.emoji}</span>
            <span>{greeting.text}</span>
          </div>

          <div className="mt-1 flex items-baseline gap-1.5 tabular-nums">
            <span
              className="text-foreground text-4xl font-semibold tracking-tight"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {h12}
              <span className={colonOn ? "opacity-100" : "opacity-25"}>:</span>
              {mm}
            </span>
            <span className="text-muted-foreground text-sm font-semibold">{ampm}</span>
          </div>

          <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
            <span className="font-medium">{dateLine}</span>
            <span className="opacity-40">·</span>
            <span className="tabular-nums">{gameYear} ILT</span>
          </div>
        </div>
      </div>

      {/* ── Complications (watchOS smart-stack row) ────────────────────── */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Complication
          icon={isPaused ? <Pause className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
          label={isPaused ? "Paused" : "Game speed"}
          value={isPaused ? "—" : `${multiplier}×`}
        />
        <Complication
          icon={<CalendarDays className="h-3 w-3" />}
          label="Day of year"
          value={String(dayOfYear(d))}
        />
        <Complication
          icon={<Sun className="h-3 w-3" />}
          label="Season"
          value={seasonFor(d.getUTCMonth())}
        />
      </div>

      {/* ── Upcoming events ────────────────────────────────────────────── */}
      <div className="mt-4">
        <div className="text-muted-foreground mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide">
          Upcoming
        </div>
        {!countryId ? (
          <p className="text-muted-foreground px-1 text-xs">
            Sign in with a country to see your upcoming events.
          </p>
        ) : events.length === 0 ? (
          <p className="text-muted-foreground px-1 text-xs">No upcoming events scheduled.</p>
        ) : (
          <div className="space-y-1">
            {events.map((ev) => (
              <button
                key={ev.id}
                onClick={() => go(ev.section)}
                className="group glass-hierarchy-interactive flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors"
              >
                <Clock className="h-3.5 w-3.5 shrink-0 text-blue-500/70" />
                <span className="text-foreground/90 flex-1 truncate text-xs font-medium">
                  {ev.label}
                </span>
                <span className="text-muted-foreground text-[10px] tabular-nums">
                  {formatRelativeIxDays(ev.ixTime, now)}
                </span>
                <ChevronRight className="text-muted-foreground/40 group-hover:text-muted-foreground h-3 w-3 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Complication({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-hierarchy-child flex flex-col gap-0.5 rounded-xl px-2.5 py-2">
      <div className="text-muted-foreground/70 flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-foreground text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

"use client";

/**
 * CalendarView — the Statecraft Calendar as a global Halo (Dynamic Island) view.
 *
 * Opened by clicking the date display anywhere. A live, ticking clock (StandBy /
 * Lock Screen inspired, Facet glass) on top of the upcoming-events feed
 * (`getUpcomingEvents`, the same feed as the MyCountry hero calendar) with IxTime
 * countdowns. The clock ticks off the shared IxTime store (per-second), so digits
 * are tabular-nums (no layout shift) and the colon pulses each second.
 * See plans/statecraft-stage1.md.
 */

import { useMemo } from "react";
import {
  Clock,
  ChevronRight,
  Sun,
  Gavel,
  CalendarClock,
  Crown,
  ShieldAlert,
  Heart,
} from "lucide-react";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useIxTimeStore, useIxTimeTimestamp, useIxTimeGameYear } from "~/stores/ixtime-store";
import { getUpcomingEvents, formatRelativeIxDays } from "~/lib/statecraft-calendar";
import { withBasePath } from "~/lib/base-path";
import { createAbsoluteUrl } from "~/lib/url-utils";
import type { DIViewProps } from "./types";
import { SmartStack } from "~/components/mycountry/SmartStack";
import { useMyCountryAgenda } from "~/hooks/useMyCountryAgenda";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

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

function _dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d.getTime() - start) / 86_400_000);
}

export function CalendarView({ onClose }: DIViewProps) {
  const now = useIxTimeStore((s) => Math.floor(s.ixTimeTimestamp / 15000) * 15000);
  const gameYear = useIxTimeStore((s) => s.gameYear);
  const pathname = usePathname();

  const selectedThemeColorClass = useMemo(() => {
    if (pathname?.startsWith("/mycountry")) return "text-yellow-400";
    if (pathname?.startsWith("/admin")) return "text-indigo-400";
    return "text-blue-400";
  }, [pathname]);

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
  const { data: govStructure } = api.government.getByCountryId.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId, staleTime: 60_000 }
  );
  const { data: countryDetails } = api.countries.getByIdAtTime.useQuery(
    { id: countryId ?? "" },
    { enabled: !!countryId, staleTime: 60_000 }
  );

  const agendaItems = useMyCountryAgenda(
    countryId ?? undefined,
    profile?.membershipTier === "mycountry_premium"
  );

  const h24 = new Date(now).getUTCHours();
  const greeting = greetingFor(h24);

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
    if (onClose) onClose();
    const href = section === "overview" ? "/mycountry" : `/mycountry/${section}`;
    if (typeof window !== "undefined" && window.location.pathname.includes("/mycountry")) {
      window.history.pushState(null, "", withBasePath(href));
      window.dispatchEvent(new PopStateEvent("popstate"));
    } else {
      window.location.href = createAbsoluteUrl(href);
    }
  };

  const resolvedTermProgress = useMemo(() => {
    const currentYearDecimal = gameYear;
    const cycle = govStructure?.electionCycle ?? 4;
    
    if (!elections || elections.length === 0) {
      const elapsed = currentYearDecimal % cycle;
      return `Yr ${(elapsed + 1).toFixed(1)} / ${cycle}`;
    }
    
    const upcomingElection = [...elections]
      .filter((e) => e.status === "upcoming" || e.status === "scheduled" || e.status === "campaigning")
      .sort((a, b) => a.scheduledIxTime - b.scheduledIxTime)[0];
      
    if (!upcomingElection) {
      const elapsed = currentYearDecimal % cycle;
      return `Yr ${(elapsed + 1).toFixed(1)} / ${cycle}`;
    }
    
    const termEnd = upcomingElection.scheduledIxTime;
    const TERM_LENGTH_MS = cycle * 365.25 * 24 * 60 * 60 * 1000;
    const termStart = termEnd - TERM_LENGTH_MS;
    const elapsedMs = Math.max(0, now - termStart);
    const elapsedYears = elapsedMs / (365.25 * 24 * 60 * 60 * 1000);
    return `Yr ${Math.min(cycle, parseFloat((elapsedYears + 1).toFixed(1)))} / ${cycle}`;
  }, [govStructure, elections, now, gameYear]);

  const resolvedGovType = useMemo((): "democracy" | "monarchy" | "dictatorship" => {
    if (!govStructure) return "democracy";
    const type = govStructure.governmentType?.toLowerCase() || "democracy";
    if (type.includes("monarch")) return "monarchy";
    if (type.includes("dictator") || type.includes("authoritarian") || type.includes("junta") || type.includes("single-party")) return "dictatorship";
    return "democracy";
  }, [govStructure]);

  const governanceConfig = useMemo(() => {
    switch (resolvedGovType) {
      case "democracy":
        return {
          label: "Term progress",
          value: resolvedTermProgress,
          icon: <Gavel className="h-3.5 w-3.5 text-blue-500/70" />,
          tooltip: govStructure
            ? `Constitutionally Limited. Head: ${govStructure.headOfGovernment || "President"}. Mandate: Popular Vote.`
            : "Constitutionally Limited. Mandate: Popular Vote.",
        };
      case "monarchy": {
        const startMs = govStructure?.createdAt
          ? new Date(govStructure.createdAt).getTime()
          : now - 12 * 365.25 * 24 * 60 * 60 * 1000; // default 12y
        const tenureYears = ((now - startMs) / (365.25 * 24 * 60 * 60 * 1000) + 12).toFixed(1);
        return {
          label: "Regime Tenure",
          value: `${tenureYears} Years`,
          icon: <Crown className="h-3.5 w-3.5 text-amber-500/70" />,
          tooltip: govStructure
            ? `Absolute Power. Head: ${govStructure.headOfState || "Monarch"}. Mandate: Divine Right.`
            : "Absolute Dynastic Power. Mandate: Divine Right.",
        };
      }
      case "dictatorship": {
        let grip = Math.min(100, Math.max(30, Math.round(68 + Math.sin(gameYear) * 12)));
        if (govStructure) {
          const demIndex = govStructure.democracyIndex ?? 50;
          const stability = govStructure.politicalStability ?? 0.5;
          grip = Math.min(100, Math.max(10, Math.round((1 - (demIndex / 100)) * 50 + (stability * 50))));
        }
        return {
          label: "Regime Grip",
          value: `${grip}% Grip`,
          icon: <ShieldAlert className="h-3.5 w-3.5 text-red-500/70" />,
          tooltip: govStructure
            ? `Decree Rule. Head: ${govStructure.headOfState || "Dictator"}. Revolution Risk: ${Math.round((1 - (govStructure.politicalStability ?? 0.5)) * 30)}%.`
            : "Military Decree. Mandate: Force & Control.",
        };
      }
    }
  }, [resolvedGovType, gameYear, resolvedTermProgress, govStructure, now]);

  const resolvedApproval = useMemo(() => {
    if (countryDetails?.publicApproval !== undefined) {
      return `${Math.round(countryDetails.publicApproval)}%`;
    }
    return "68%";
  }, [countryDetails]);

  const soonestEvent = events[0];
  const nextEventValue = soonestEvent ? formatRelativeIxDays(soonestEvent.ixTime, now) : "—";

  return (
    <div className="p-4">
      {/* ── Hero clock ─────────────────────────────────────────────────── */}
      <TickingClock greetingText={greeting.text} selectedThemeColorClass={selectedThemeColorClass} />

      {/* ── Complications (watchOS smart-stack row) ────────────────────── */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Complication
          icon={governanceConfig?.icon ?? <Gavel className="h-3.5 w-3.5 text-blue-500/70" />}
          label={governanceConfig?.label ?? "Term progress"}
          value={governanceConfig?.value ?? resolvedTermProgress}
          tooltip={governanceConfig?.tooltip}
        />
        <Complication
          icon={<CalendarClock className="h-3.5 w-3.5 text-blue-500/70" />}
          label="Next event"
          value={nextEventValue}
        />
        <Complication
          icon={<Heart className="h-3 w-3 text-red-500/70" />}
          label="Approval"
          value={resolvedApproval}
          tooltip="Public Approval Rating of the active administration."
        />
      </div>

      {/* ── Daily Agenda (Smart Stack) ─────────────────────────────────── */}
      {countryId && agendaItems.length > 0 && (
        <div className="mt-4">
          <div className="text-muted-foreground mb-1.5 px-1 text-[11px] font-semibold tracking-wide uppercase">
            Daily Agenda
          </div>
          <SmartStack items={agendaItems} onResolve={go} />
        </div>
      )}

      {/* ── Upcoming events ────────────────────────────────────────────── */}
      <div className="mt-4">
        <div className="text-muted-foreground mb-1.5 px-1 text-[11px] font-semibold tracking-wide uppercase">
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
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tooltip?: string;
}) {
  const content = (
    <div className="glass-hierarchy-child flex flex-col items-center justify-center rounded-xl p-2.5 text-center h-full w-full">
      <div className="text-muted-foreground/80 flex items-center justify-center">{icon}</div>
      <div className="text-muted-foreground mt-1 text-[9px] font-medium tracking-wider uppercase">
        {label}
      </div>
      <div className="text-foreground mt-0.5 text-[11px] font-semibold tracking-tight">{value}</div>
    </div>
  );

  if (!tooltip) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help h-full w-full">{content}</div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[200px] text-center text-xs leading-normal">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

interface TickingClockProps {
  greetingText: string;
  selectedThemeColorClass: string;
}

function TickingClock({ greetingText, selectedThemeColorClass }: TickingClockProps) {
  const now = useIxTimeTimestamp();
  const gameYear = useIxTimeGameYear();

  const d = new Date(now);
  const h24 = d.getUTCHours();
  const h12 = h24 % 12 || 12;
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  const ampm = h24 >= 12 ? "PM" : "AM";
  const colonOn = d.getUTCSeconds() % 2 === 0;

  const dateLine = d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <motion.div
      layoutId="halo-date-capsule-button"
      className="glass-hierarchy-child relative overflow-hidden rounded-2xl px-5 py-4"
    >
      {/* time-of-day ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-8 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl"
      />

      {/* Top-right Weather badge */}
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2 py-0.5 select-none text-[8px] font-extrabold text-muted-foreground/80 tracking-wider">
        <Sun className="h-2.5 w-2.5 text-amber-400 animate-pulse" />
        <span>{seasonFor(d.getUTCMonth())}</span>
      </div>

      <div className="relative">
        <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium">
          <motion.div
            layoutId="halo-date-capsule-badge"
            className="flex items-center justify-center rounded-[4px] border border-white/10 bg-white/5 px-1 py-0.5 shadow-inner backdrop-blur-[2px] shrink-0"
          >
            <motion.span
              layoutId="halo-date-capsule-weekday"
              className={cn(
                "origin-center scale-90 text-[8px] font-extrabold tracking-widest antialiased leading-none",
                selectedThemeColorClass
              )}
            >
              {d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase()}
            </motion.span>
          </motion.div>
          <span>{greetingText}</span>
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
          <motion.span layoutId="halo-date-capsule-text" className="font-medium">
            {dateLine}
          </motion.span>
          <span className="opacity-40">·</span>
          <span className="tabular-nums">{gameYear}</span>
        </div>
      </div>
    </motion.div>
  );
}

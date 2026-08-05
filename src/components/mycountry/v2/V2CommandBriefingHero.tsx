"use client";

import { useState, useMemo } from "react";
import {
  FileClock,
  Briefcase,
  AlertTriangle,
  Clock,
  Check,
  Layers,
  Calendar as CalendarIcon,
  ListTodo,
} from "lucide-react";
import { api } from "~/trpc/react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { useCountryData, QuickVitalityRings, createVitalityRingsFromCountry } from "../primitives";
import { SmartStack } from "../SmartStack";
import type { MyCountrySection } from "../MyCountrySidebarNav";

function formatCompact(num?: number | null): string {
  if (num === undefined || num === null || !isFinite(num)) return "0";
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  return num.toLocaleString();
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatRolloutRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return "Finalizing";
  const days = remainingMs / 86_400_000;
  if (days >= 365) return `${(days / 365).toFixed(1)}y left`;
  if (days >= 60) return `${Math.round(days / 30.44)}mo left`;
  if (days >= 1) return `${Math.round(days)}d left`;
  return "<1d left";
}

function CivilServiceWidget({
  countryId,
  enabled,
  onNavigate,
}: {
  countryId: string;
  enabled: boolean;
  onNavigate?: (section: MyCountrySection) => void;
}) {
  const { data } = api.government.getCivilServiceStatus.useQuery(
    { countryId },
    { enabled, staleTime: 60_000 }
  );

  if (!data) return null;
  if (data.activeCount === 0 && data.implementingCount === 0 && data.consumedStaff === 0) {
    return null;
  }

  const util = data.utilizationPercent;
  const barColor = data.overCapacity
    ? "bg-red-500"
    : util >= 80
      ? "bg-amber-500"
      : "bg-emerald-500";
  const valueColor = data.overCapacity
    ? "text-red-400"
    : util >= 80
      ? "text-amber-400"
      : "text-emerald-400";

  return (
    <div className="flex flex-1 min-w-0 flex-col justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-md">
      <div>
        <button
          type="button"
          onClick={() => onNavigate?.("executive")}
          className="group flex w-full items-center justify-between gap-2 text-left"
        >
          <div className="flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-muted-foreground/70 text-[9px] font-extrabold tracking-wider uppercase">
              Civil Service Capacity
            </span>
          </div>
          <span className={cn("shrink-0 text-[10px] font-bold tabular-nums", valueColor)}>
            {Math.round(data.consumedStaff)} / {Math.round(data.capacity)}
          </span>
        </button>
        <div className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColor)}
            style={{ width: `${Math.min(100, util)}%` }}
          />
        </div>
        {data.overCapacity && (
          <div className="mt-1 flex items-center gap-1 text-[9px] font-semibold text-red-400">
            <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
            <span>Staffing shortage — active programs exceed capacity</span>
          </div>
        )}
      </div>

      {data.rolloutQueue.length > 0 && (
        <div className="mt-0.5 flex flex-col gap-1.5 border-t border-white/5 pt-1.5">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-cyan-400" />
            <span className="text-muted-foreground/70 text-[8px] font-bold tracking-wider uppercase">
              Rollout Queue ({data.rolloutQueue.length})
            </span>
          </div>
          {data.rolloutQueue.slice(0, 3).map((item) => (
            <div key={item.id} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground truncate text-[10px] font-medium">
                  {item.name}
                </span>
                <span className="text-muted-foreground/60 shrink-0 text-[8px] tabular-nums">
                  {formatRolloutRemaining(item.remainingMs)}
                </span>
              </div>
              <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, item.progressPercent))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function V2CommandBriefingHero({
  countryId,
  onNavigate,
}: {
  countryId: string;
  onNavigate?: (section: MyCountrySection) => void;
}) {
  const { country } = useCountryData();
  const [viewMode, setViewMode] = useState<"stack" | "widgets">("stack");

  // Fetch canon feed for session summary
  const feed = api.mycountry.getCanonFeed.useQuery(
    { countryId, limit: 30 },
    { enabled: !!countryId }
  );

  // Fetch national issues and pending count for reminders/smart stack
  const pendingIssues = api.nationalIssues.getPendingCount.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const pendingCount = pendingIssues.data?.count ?? 0;

  const items = useMemo(() => feed.data ?? [], [feed.data]);

  const briefing = useMemo(() => {
    if (items.length === 0) return null;
    const latest = items[0];
    return {
      latest,
      weekCount: items.length,
    };
  }, [items]);

  const today = useMemo(() => new Date(), []);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const agendaItems = useMemo(() => {
    const list: Array<{
      id: string;
      text: string;
      section: MyCountrySection;
      borderClass: string;
      count?: number;
      kind: "issue" | "relations" | "executive";
    }> = [];

    if (pendingCount > 0) {
      list.push({
        id: "issues",
        text: `${pendingCount} National Issue${pendingCount > 1 ? "s" : ""} pending`,
        section: "executive",
        borderClass: "border-amber-500 text-amber-500",
        count: pendingCount,
        kind: "issue",
      });
    }

    return list;
  }, [pendingCount]);

  const nextEventText = agendaItems.length > 0 ? agendaItems[0].text : "No Pending Crises";

  return (
    <FacetCard depth={1} className="bg-card/30 flex flex-col gap-4 p-5 backdrop-blur-md">
      {/* Top Bar: Session Recap & View Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <FileClock className="h-4.5 w-4.5 text-amber-500 shrink-0" />
          <div>
            <h4 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
              Command Briefing — Since your last session
            </h4>
            {briefing && (
              <p className="text-foreground/90 text-xs leading-tight mt-0.5">
                <span className="font-semibold">{briefing.weekCount}</span> canon events recorded.
                Latest: <span className="font-semibold">{briefing.latest.title}</span>{" "}
                <span className="text-muted-foreground/60 text-[11px]">
                  ({relativeTime(briefing.latest.timestamp)})
                </span>
              </p>
            )}
          </div>
        </div>

        {/* View Mode Toggle Pill */}
        <div className="border-border/60 bg-white/[0.03] flex items-center gap-1 rounded-xl border p-1 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setViewMode("stack")}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border border-transparent",
              viewMode === "stack"
                ? "border-amber-500/30 bg-amber-500/15 text-amber-400 shadow-sm"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            Smart Stack
          </button>
          <button
            type="button"
            onClick={() => setViewMode("widgets")}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border border-transparent",
              viewMode === "widgets"
                ? "border-amber-500/30 bg-amber-500/15 text-amber-400 shadow-sm"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            <ListTodo className="h-3.5 w-3.5" />
            Widgets Grid
          </button>
        </div>
      </div>

      {/* Main Body */}
      {viewMode === "stack" ? (
        <div className="flex w-full flex-col items-stretch justify-center gap-4 md:flex-row">
          <div className="w-full flex-1">
            <SmartStack
              items={agendaItems}
              onResolve={(section) => onNavigate?.(section)}
              className="h-full min-h-[140px]"
            />
          </div>
          <CivilServiceWidget
            countryId={countryId}
            enabled={!!countryId}
            onNavigate={onNavigate}
          />
        </div>
      ) : (
        <div className="flex w-full flex-col items-stretch justify-center gap-3 md:flex-row">
          {/* iOS Calendar widget */}
          <div className="flex flex-1 min-w-0 flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-3 shadow-inner backdrop-blur-md select-none">
            <div className="flex items-center gap-1.5 text-red-500 text-xs font-extrabold tracking-wider uppercase mb-2">
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>{months[today.getMonth()]}</span>
            </div>
            <div className="flex flex-grow flex-col items-center justify-center py-3">
              <span className="text-[10px] font-bold tracking-widest text-red-500 uppercase">
                {days[today.getDay()]}
              </span>
              <span className="text-foreground mt-1 text-3xl font-black tracking-tighter">
                {today.getDate()}
              </span>
              <span className="text-muted-foreground/60 mt-2 text-center text-[10px] font-semibold uppercase truncate max-w-full">
                Up Next: {nextEventText}
              </span>
            </div>
          </div>

          {/* iOS Reminders widget */}
          <div className="flex flex-1 min-w-0 flex-col justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-md">
            <div className="text-muted-foreground/60 mb-2 flex items-center justify-between text-[10px] font-extrabold tracking-wider uppercase">
              <span>Reminders & Tasks</span>
              <span className="text-foreground/80 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold">
                {agendaItems.length}
              </span>
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[120px] flex flex-col justify-center">
              {agendaItems.length > 0 ? (
                agendaItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onNavigate?.(item.section)}
                    className="group text-foreground/80 hover:text-foreground flex w-full items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2 text-left text-xs font-medium transition-colors hover:bg-white/[0.05]"
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all",
                        item.borderClass
                      )}
                    >
                      <Check className="h-2.5 w-2.5 scale-0 transition-transform group-hover:scale-100" />
                    </div>
                    <span className="flex-1 truncate text-xs">{item.text}</span>
                  </button>
                ))
              ) : (
                <div className="flex h-full flex-col items-center justify-center py-4 text-center text-emerald-400">
                  <Check className="mb-1 h-5 w-5" />
                  <span className="text-xs font-semibold">All Tasks Complete</span>
                </div>
              )}
            </div>
          </div>

          {/* Civil Service Capacity widget */}
          <CivilServiceWidget
            countryId={countryId}
            enabled={!!countryId}
            onNavigate={onNavigate}
          />
        </div>
      )}
    </FacetCard>
  );
}

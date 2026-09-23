"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  KeyCommand as Command,
  ArrowUpRight,
  Shield,
  Community as Handshake,
  ScaleFrameEnlarge as Scale,
  StatUp as TrendingUp,
  CalendarRotate as CalendarClock,
  WarningCircle as AlertCircle,
} from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useIxTimeStore } from "~/stores/ixtime-store";
import { getUpcomingEvents, formatRelativeIxDays } from "~/lib/statecraft/calendar";
import {
  type AgendaEvent,
  type ExecutiveAgendaProps,
  seasonFor,
  getSeverityRank,
  AgendaHorizonStrip,
  AgendaEventActionDialog,
} from "./agenda";

interface StatecraftIntentItem {
  id: string;
  goal: string;
  status?: string;
  category?: string;
  tier?: string;
}

interface StatecraftIssueItem {
  id: string;
  title: string;
  description?: string;
  severity?: string;
  urgency?: number;
  deadlineIxTime?: number | null;
}

function ExecutiveAgendaComponent({
  countryId,
  onOpenDrill,
  onIssueDirective,
  onOpenIntent,
}: ExecutiveAgendaProps): React.JSX.Element {
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);

  // Real-time IxTime Store Telemetry
  const now = useIxTimeStore((s) => Math.floor(s.ixTimeTimestamp / 15000) * 15000);

  // Queries for statecraft telemetry & agenda context
  const intentTree = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });
  const status = api.intent.getStatus.useQuery({ countryId }, { enabled: !!countryId });
  const elections = api.elections.getElections.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId, staleTime: 60_000 }
  );
  const issuesData = api.nationalIssues.getMyIssues.useQuery(
    { countryId: countryId ?? "", status: "active" },
    { enabled: !!countryId, staleTime: 60_000 }
  );

  const currentDate = useMemo(() => new Date(now), [now]);
  const currentSeason = useMemo(() => seasonFor(currentDate.getUTCMonth()), [currentDate]);

  // Generate 7-day interactive horizon dates
  const days = useMemo(() => {
    const today = new Date();
    const result = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dayName = d.toLocaleDateString(undefined, { weekday: "short" });
      const dayNum = d.getDate();
      result.push({
        offset: i,
        dayName: i === 0 ? "Today" : dayName,
        dayNum,
        isToday: i === 0,
      });
    }
    return result;
  }, []);

  // Statecraft Events & Directives Agenda List
  const statecraftEvents = useMemo(() => {
    return getUpcomingEvents({
      nowIxTime: now,
      elections: (elections.data ?? []).map((e) => ({
        id: e.id,
        name: e.name,
        scheduledIxTime: e.scheduledIxTime,
        status: e.status,
      })),
      issueDeadlines: (issuesData.data?.issues ?? []).map((i) => ({
        id: i.id,
        title: i.title,
        deadlineIxTime: (i as { deadlineIxTime?: number | null }).deadlineIxTime,
      })),
    });
  }, [elections.data, issuesData.data, now]);

  const events = useMemo<AgendaEvent[]>(() => {
    const list: AgendaEvent[] = [
      {
        id: "ev-politics-vote",
        dayOffset: 0,
        timeLabel: "14:00 Today",
        title: "Parliamentary Budget & Policy Vote",
        category: "politics",
        description:
          "National legislature convening to vote on proposed economic appropriation bills.",
        directiveGoal: "Guide parliamentary coalition vote and secure policy approval",
        statusLabel: "Vote Scheduled",
        icon: Scale,
        accentCls:
          "border-indigo-500/40 dark:border-indigo-500/30 bg-indigo-500/10 text-foreground hover:border-indigo-500/60 hover:bg-indigo-500/15 hover:shadow-md",
        badgeCls:
          "bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border-indigo-500/40 font-bold",
        drillKind: { kind: "politics" },
      },
      {
        id: "ev-diplomacy-summit",
        dayOffset: 1,
        timeLabel: "10:00 Tomorrow",
        title: "Bilateral Trade Accord Review",
        category: "diplomacy",
        description:
          "Scheduled diplomatic review for multi-national alliance and trade tariff agreements.",
        directiveGoal: "Ratify bilateral trade accord and optimize import/export tariffs",
        statusLabel: "Summit Pending",
        icon: Handshake,
        accentCls:
          "border-cyan-500/40 dark:border-cyan-500/30 bg-cyan-500/10 text-foreground hover:border-cyan-500/60 hover:bg-cyan-500/15 hover:shadow-md",
        badgeCls: "bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border-cyan-500/40 font-bold",
        drillKind: { kind: "relations" },
      },
      {
        id: "ev-defense-readiness",
        dayOffset: 2,
        timeLabel: "09:00 +2 Days",
        title: "Military Readiness Audit",
        category: "defense",
        description:
          "Quarterly joint command readiness evaluation and strategic border defense drill.",
        directiveGoal: "Conduct armed forces defense audit and upgrade logistics supply lines",
        statusLabel: "Audit Scheduled",
        icon: Shield,
        accentCls:
          "border-red-500/40 dark:border-red-500/30 bg-red-500/10 text-foreground hover:border-red-500/60 hover:bg-red-500/15 hover:shadow-md",
        badgeCls: "bg-red-500/20 text-red-800 dark:text-red-300 border-red-500/40 font-bold",
        drillKind: { kind: "defense" },
      },
      {
        id: "ev-economy-tick",
        dayOffset: 3,
        timeLabel: "18:00 +3 Days",
        title: "Macroeconomic Cycle & Tax Settlement",
        category: "economy",
        description:
          "Central bank economic telemetry report and corporate tax revenue ledger update.",
        directiveGoal: "Rebalance corporate tax policy and incentivize industrial growth",
        statusLabel: "Ledger Settlement",
        icon: TrendingUp,
        accentCls:
          "border-emerald-500/40 dark:border-emerald-500/30 bg-emerald-500/10 text-foreground hover:border-emerald-500/60 hover:bg-emerald-500/15 hover:shadow-md",
        badgeCls:
          "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 font-bold",
        drillKind: { kind: "economy" },
      },
    ];

    // Inject real-time statecraft upcoming events
    statecraftEvents.forEach((ev, idx) => {
      const daysAhead = Math.max(0, Math.floor((ev.ixTime - now) / 86_400_000));
      list.push({
        id: `sc-ev-${ev.id || idx}`,
        dayOffset: Math.min(6, daysAhead),
        timeLabel: formatRelativeIxDays(ev.ixTime, now),
        title: ev.label,
        category: ev.section === "politics" ? "politics" : "directive",
        description: `Scheduled statecraft event steering national ${ev.section}.`,
        directiveGoal: `Address scheduled statecraft event: ${ev.label}`,
        statusLabel: "STATECRAFT EVENT",
        icon: CalendarClock,
        accentCls:
          "border-amber-500/40 dark:border-amber-500/30 bg-amber-500/10 text-foreground hover:border-amber-500/60 hover:bg-amber-500/15 hover:shadow-md",
        badgeCls:
          "bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40 font-bold",
        rawIxTime: ev.ixTime,
      });
    });

    // Inject active executive directive rollouts
    const rawIntents = Array.isArray(intentTree.data)
      ? intentTree.data
      : (intentTree.data?.allIntents ?? []);
    const intentsList = rawIntents as StatecraftIntentItem[];
    const activeIntents = intentsList.filter((i) => i.status?.toLowerCase() === "active");
    activeIntents.forEach((it) => {
      list.unshift({
        id: `intent-ev-${it.id}`,
        dayOffset: 0,
        timeLabel: "In Progress",
        title: `Directive Rollout: ${it.goal}`,
        category: "directive",
        description: `Active executive intent steering national ${it.category ?? "policy"}.`,
        directiveGoal: `Accelerate directive rollout: ${it.goal}`,
        statusLabel: `${it.tier?.toUpperCase() ?? "ACTIVE"} DIRECTIVE`,
        icon: Command,
        accentCls:
          "border-amber-500/50 dark:border-amber-500/30 bg-amber-500/10 text-foreground hover:border-amber-500/70 hover:bg-amber-500/20 hover:shadow-md",
        badgeCls:
          "bg-amber-500/25 text-amber-800 dark:text-amber-300 border-amber-500/40 font-bold",
        intentId: it.id,
      });
    });

    // Inject active national issues awaiting executive action (Priority Issues first)
    const rawActiveIssues = (issuesData.data?.issues ?? []) as StatecraftIssueItem[];
    const activeIssues = [...rawActiveIssues].sort((a, b) => {
      const aScore = getSeverityRank(a.severity ?? "") * 100 + (a.urgency ?? 0);
      const bScore = getSeverityRank(b.severity ?? "") * 100 + (b.urgency ?? 0);
      return bScore - aScore;
    });

    activeIssues.forEach((iss) => {
      const sev = String(iss.severity ?? "").toLowerCase();
      const urgent = sev === "critical" || sev === "high" || (iss.urgency ?? 0) > 70;
      list.unshift({
        id: `issue-ev-${iss.id}`,
        dayOffset: 0,
        timeLabel: urgent ? "Urgent" : "Awaiting Decision",
        title: `National Issue: ${iss.title}`,
        category: "politics",
        description:
          iss.description ||
          "An active national issue requires immediate executive attention and cabinet policy guidance.",
        directiveGoal: `Resolve national policy issue: ${iss.title}`,
        statusLabel: urgent ? "PRIORITY ISSUE" : "OPEN ISSUE",
        icon: AlertCircle,
        accentCls: urgent
          ? "border-red-500/50 dark:border-red-500/40 bg-red-500/10 text-foreground hover:border-red-500/70 hover:bg-red-500/20 hover:shadow-md"
          : "border-indigo-500/40 dark:border-indigo-500/30 bg-indigo-500/10 text-foreground hover:border-indigo-500/60 hover:bg-indigo-500/15 hover:shadow-md",
        badgeCls: urgent
          ? "bg-red-500/20 text-red-800 dark:text-red-300 border-red-500/40 font-bold"
          : "bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border-indigo-500/40 font-bold",
        drillKind: { kind: "issue", issueId: iss.id },
      });
    });

    return list;
  }, [intentTree.data, statecraftEvents, now, issuesData.data]);

  // Filter events by selected day & category chip
  const filteredEvents = useMemo(() => {
    const list = events.filter((e) => {
      const matchDay = e.dayOffset === selectedDayOffset;
      const matchCat = categoryFilter === "all" || e.category === categoryFilter;
      return matchDay && matchCat;
    });

    return list.sort((a, b) => {
      const getPriorityScore = (item: (typeof list)[0]) => {
        if (item.statusLabel === "PRIORITY ISSUE") return 4;
        if (item.statusLabel === "OPEN ISSUE") return 3;
        if (item.category === "directive") return 2;
        return 1;
      };
      const scoreA = getPriorityScore(a);
      const scoreB = getPriorityScore(b);
      return scoreB - scoreA;
    });
  }, [events, selectedDayOffset, categoryFilter]);

  const usedSlots = status.data?.usedThisWeek ?? 0;
  const slotCap = status.data?.cap ?? 3;

  return (
    <>
      <FacetCard
        id="executive-agenda"
        depth={1}
        className="bg-card/40 dark:bg-card/30 border-border/80 flex flex-col gap-4 p-4.5 shadow-lg backdrop-blur-md dark:border-white/10 dark:shadow-2xl"
      >
        {/* StandBy Hero Clock & Telemetry Header */}
        <div className="border-border/70 bg-card/60 relative overflow-hidden rounded-2xl border p-4 shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-gradient-to-br dark:from-white/[0.06] dark:via-white/[0.02] dark:to-transparent dark:shadow-lg dark:shadow-black/20">
          <div className="border-border/60 relative z-10 flex flex-wrap items-center justify-between gap-3 border-b pb-3 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 shadow-2xs backdrop-blur-md dark:border-cyan-400/20">
                <Calendar className="h-4.5 w-4.5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-foreground text-base font-bold tracking-tight sm:text-lg">
                    Issues & Events
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-cyan-800 uppercase shadow-xs dark:text-cyan-300">
                    <span>{currentSeason.emoji}</span>
                    <span>{currentSeason.name}</span>
                  </span>
                </div>
                <span className="text-muted-foreground text-[11px] font-medium tracking-wide">
                  Executive Agenda & Horizon Timeline
                </span>
              </div>
            </div>

            {/* Directives Capacity Pill */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 font-mono text-[11px] font-semibold shadow-xs backdrop-blur-md dark:border-amber-400/25 dark:bg-amber-400/10"
            >
              <Command className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-muted-foreground">Directives:</span>
              <span className="font-bold text-amber-800 dark:text-amber-300">
                {usedSlots} / {slotCap} Used
              </span>
            </motion.div>
          </div>
        </div>

        {/* 7-Day Horizon Strip and Category Filter Chips */}
        <AgendaHorizonStrip
          days={days}
          selectedDayOffset={selectedDayOffset}
          onSelectDayOffset={setSelectedDayOffset}
          categoryFilter={categoryFilter}
          onSelectCategoryFilter={setCategoryFilter}
          events={events}
        />

        {/* Event Cards & Action Items (Inline Scrollable Container) */}
        <div className="scrollbar-thumb-muted/60 max-h-[380px] scrollbar-thin scrollbar-track-transparent space-y-2.5 overflow-y-auto pr-1.5 dark:scrollbar-thumb-white/20">
          <AnimatePresence mode="popLayout">
            {filteredEvents.length > 0 ? (
              filteredEvents.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 450, damping: 30, delay: idx * 0.03 }}
                    onClick={() => setSelectedEvent(item)}
                    className={cn(
                      "group relative flex cursor-pointer flex-col items-start justify-between gap-3 rounded-xl border p-3.5 shadow-xs backdrop-blur-md transition-all active:scale-[0.985] sm:flex-row sm:items-center",
                      item.accentCls
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3.5">
                      <div className="border-border/60 bg-card/60 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-inner transition-all group-hover:scale-105 group-hover:border-amber-500/40 group-hover:bg-amber-500/15 group-hover:text-amber-600 dark:border-white/10 dark:bg-white/5 dark:group-hover:text-amber-400">
                        <Icon className="h-4.5 w-4.5 shrink-0" />
                      </div>
                      <div className="flex min-w-0 flex-col space-y-0.5 text-left">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-[9px] font-extrabold tracking-wider uppercase shadow-xs transition-colors",
                              item.badgeCls
                            )}
                          >
                            {item.statusLabel}
                          </span>
                          <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
                            {item.timeLabel}
                          </span>
                        </div>
                        <h4 className="text-foreground truncate text-xs leading-tight font-extrabold transition-colors group-hover:text-amber-950 dark:group-hover:text-amber-200">
                          {item.title}
                        </h4>
                        <p className="text-muted-foreground line-clamp-1 text-[11px]">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(item);
                      }}
                      className="border-border/80 bg-card/80 text-foreground flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border px-3 py-1.5 text-[10px] font-bold shadow-xs transition-all group-hover:border-amber-500/50 group-hover:bg-amber-500/20 group-hover:text-amber-950 active:scale-95 dark:border-white/15 dark:bg-white/10 dark:group-hover:text-amber-200"
                    >
                      <span>Action</span>
                      <ArrowUpRight className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                    </button>
                  </motion.div>
                );
              })
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border-border/50 bg-card/30 text-muted-foreground flex flex-col items-center justify-center rounded-xl border p-7 text-center backdrop-blur-xs dark:border-white/5 dark:bg-white/[0.01]"
              >
                <Calendar className="text-muted-foreground/40 mb-2 h-7 w-7 animate-pulse" />
                <div className="text-foreground text-xs font-bold">No Events Scheduled</div>
                <div className="text-muted-foreground/80 mt-0.5 max-w-xs text-[11px]">
                  No scheduled statecraft events or active directives match the selected day and
                  category filter.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </FacetCard>

      {/* Quick Action Resolution Dialog */}
      <AgendaEventActionDialog
        selectedEvent={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onIssueDirective={onIssueDirective}
        onOpenDrill={onOpenDrill}
        onOpenIntent={onOpenIntent}
      />
    </>
  );
}

export const ExecutiveAgenda = React.memo(ExecutiveAgendaComponent);
export const V2MyAgenda = ExecutiveAgenda;
export type { ExecutiveAgendaProps } from "./agenda";

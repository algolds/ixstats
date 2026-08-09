"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  Clock,
  Command,
  ArrowUpRight,
  Shield,
  Handshake,
  Scale,
  TrendingUp,
  Compass,
  Gavel,
  Crown,
  ShieldAlert,
  Heart,
  CalendarClock,
  Filter,
  AlertCircle,
} from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useIxTimeStore } from "~/stores/ixtime-store";
import { getUpcomingEvents, formatRelativeIxDays } from "~/lib/statecraft-calendar";
import type { V2Drill } from "./V2DrillSheets";

interface AgendaEvent {
  id: string;
  dayOffset: number; // 0 = Today, 1 = Tomorrow, etc.
  timeLabel: string;
  title: string;
  category: "defense" | "diplomacy" | "politics" | "economy" | "directive";
  description: string;
  directiveGoal: string;
  statusLabel: string;
  icon: typeof Calendar;
  accentCls: string;
  badgeCls: string;
  drillKind?: Exclude<V2Drill, { kind: "intent" } | null>;
  intentId?: string;
  rawIxTime?: number;
}

function seasonFor(month: number): { name: string; emoji: string } {
  if (month <= 1 || month === 11) return { name: "Winter", emoji: "❄️" };
  if (month <= 4) return { name: "Spring", emoji: "🌸" };
  if (month <= 7) return { name: "Summer", emoji: "☀️" };
  return { name: "Autumn", emoji: "🍂" };
}

function Complication({
  icon,
  label,
  value,
  tooltip,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tooltip?: string;
  onClick?: () => void;
}) {
  const content = (
    <motion.div
      whileHover={{ y: -1, transition: { type: "spring", stiffness: 450, damping: 25 } }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cn(
        "group border-border/70 bg-card/60 hover:border-border hover:bg-card/90 relative flex flex-col items-center justify-center rounded-xl border p-2.5 text-center shadow-xs backdrop-blur-md transition-all select-none dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20 dark:hover:bg-white/[0.06]",
        onClick && "cursor-pointer active:scale-95"
      )}
    >
      <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider uppercase">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-foreground text-xs font-black tracking-tight tabular-nums">{value}</div>
    </motion.div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="border-border bg-card text-card-foreground max-w-[210px] border text-[11px] shadow-xl backdrop-blur-xl"
        >
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

export function V2MyAgenda({
  countryId,
  onDeclare,
  onOpenIntent,
  onOpenDrill,
}: {
  countryId: string;
  onDeclare?: (prefilled?: string) => void;
  onOpenIntent?: (intentId: string) => void;
  onOpenDrill?: (d: V2Drill) => void;
}) {
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);

  // Real-time IxTime Store Telemetry
  const now = useIxTimeStore((s) => Math.floor(s.ixTimeTimestamp / 15000) * 15000);
  const gameYear = useIxTimeStore((s) => s.gameYear);

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
  const govStructure = api.government.getByCountryId.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId, staleTime: 60_000 }
  );
  const countryDetails = api.countries.getByIdAtTime.useQuery(
    { id: countryId ?? "" },
    { enabled: !!countryId, staleTime: 60_000 }
  );

  const currentDate = useMemo(() => new Date(now), [now]);
  const currentSeason = useMemo(() => seasonFor(currentDate.getUTCMonth()), [currentDate]);

  // Governance Complication Logic
  const resolvedTermProgress = useMemo(() => {
    const cycle = govStructure.data?.electionCycle ?? 4;
    const electionList = elections.data ?? [];

    if (electionList.length === 0) {
      const elapsed = gameYear % cycle;
      return `Yr ${(elapsed + 1).toFixed(1)} / ${cycle}`;
    }

    const upcomingElection = [...electionList]
      .filter(
        (e) => e.status === "upcoming" || e.status === "scheduled" || e.status === "campaigning"
      )
      .sort((a, b) => a.scheduledIxTime - b.scheduledIxTime)[0];

    if (!upcomingElection) {
      const elapsed = gameYear % cycle;
      return `Yr ${(elapsed + 1).toFixed(1)} / ${cycle}`;
    }

    const termEnd = upcomingElection.scheduledIxTime;
    const TERM_LENGTH_MS = cycle * 365.25 * 24 * 60 * 60 * 1000;
    const termStart = termEnd - TERM_LENGTH_MS;
    const elapsedMs = Math.max(0, now - termStart);
    const elapsedYears = elapsedMs / (365.25 * 24 * 60 * 60 * 1000);
    return `Yr ${Math.min(cycle, parseFloat((elapsedYears + 1).toFixed(1)))} / ${cycle}`;
  }, [govStructure.data, elections.data, now, gameYear]);

  const resolvedGovType = useMemo((): "democracy" | "monarchy" | "dictatorship" => {
    if (!govStructure.data) return "democracy";
    const type = govStructure.data.governmentType?.toLowerCase() || "democracy";
    if (type.includes("monarch")) return "monarchy";
    if (
      type.includes("dictator") ||
      type.includes("authoritarian") ||
      type.includes("junta") ||
      type.includes("single-party")
    )
      return "dictatorship";
    return "democracy";
  }, [govStructure.data]);

  const governanceConfig = useMemo(() => {
    const data = govStructure.data;
    switch (resolvedGovType) {
      case "democracy":
        return {
          label: "Term progress",
          value: resolvedTermProgress,
          icon: <Gavel className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />,
          tooltip: data
            ? `Constitutionally Limited. Head: ${data.headOfGovernment || "President"}. Mandate: Popular Vote.`
            : "Constitutionally Limited. Mandate: Popular Vote.",
        };
      case "monarchy": {
        const startMs = data?.createdAt
          ? new Date(data.createdAt).getTime()
          : now - 12 * 365.25 * 24 * 60 * 60 * 1000;
        const tenureYears = ((now - startMs) / (365.25 * 24 * 60 * 60 * 1000) + 12).toFixed(1);
        return {
          label: "Regime Tenure",
          value: `${tenureYears} Years`,
          icon: <Crown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />,
          tooltip: data
            ? `Absolute Power. Head: ${data.headOfState || "Monarch"}. Mandate: Divine Right.`
            : "Absolute Dynastic Power. Mandate: Divine Right.",
        };
      }
      case "dictatorship": {
        let grip = Math.min(100, Math.max(30, Math.round(68 + Math.sin(gameYear) * 12)));
        if (data) {
          const demIndex = data.democracyIndex ?? 50;
          const stability = data.politicalStability ?? 0.5;
          grip = Math.min(
            100,
            Math.max(10, Math.round((1 - demIndex / 100) * 50 + stability * 50))
          );
        }
        return {
          label: "Regime Grip",
          value: `${grip}% Grip`,
          icon: <ShieldAlert className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />,
          tooltip: data
            ? `Decree Rule. Head: ${data.headOfState || "Dictator"}. Revolution Risk: ${Math.round((1 - (data.politicalStability ?? 0.5)) * 30)}%.`
            : "Military Decree. Mandate: Force & Control.",
        };
      }
    }
  }, [resolvedGovType, gameYear, resolvedTermProgress, govStructure.data, now]);

  const resolvedApproval = useMemo(() => {
    if (countryDetails.data?.publicApproval !== undefined) {
      return `${Math.round(countryDetails.data.publicApproval)}%`;
    }
    return "68%";
  }, [countryDetails.data]);

  const activeIssuesCount = useMemo(() => {
    return issuesData.data?.issues?.length ?? 0;
  }, [issuesData.data]);

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
          "border-violet-500/40 dark:border-violet-500/30 bg-violet-500/10 text-foreground hover:border-violet-500/60 hover:bg-violet-500/15 hover:shadow-md",
        badgeCls:
          "bg-violet-500/20 text-violet-800 dark:text-violet-300 border-violet-500/40 font-bold",
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
          "border-teal-500/40 dark:border-teal-500/30 bg-teal-500/10 text-foreground hover:border-teal-500/60 hover:bg-teal-500/15 hover:shadow-md",
        badgeCls: "bg-teal-500/20 text-teal-800 dark:text-teal-300 border-teal-500/40 font-bold",
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
    const intentsList = Array.isArray(intentTree.data)
      ? intentTree.data
      : (intentTree.data?.allIntents ?? []);
    const activeIntents = intentsList.filter((i: any) => i.status?.toLowerCase() === "active");
    activeIntents.forEach((it: any) => {
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
    const rawActiveIssues = issuesData.data?.issues ?? [];
    const activeIssues = [...rawActiveIssues].sort((a: any, b: any) => {
      const aSev = String(a.severity ?? "").toLowerCase();
      const bSev = String(b.severity ?? "").toLowerCase();
      const sevRank = (s: string) =>
        s === "critical" ? 4 : s === "high" ? 3 : s === "medium" ? 2 : 1;
      const aScore = sevRank(aSev) * 100 + (a.urgency ?? 0);
      const bScore = sevRank(bSev) * 100 + (b.urgency ?? 0);
      return bScore - aScore;
    });

    activeIssues.forEach((iss: any) => {
      const sev = String(iss.severity ?? "").toLowerCase();
      const urgent = sev === "critical" || sev === "high" || iss.urgency > 70;
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
          ? "border-rose-500/50 dark:border-rose-500/40 bg-rose-500/10 text-foreground hover:border-rose-500/70 hover:bg-rose-500/20 hover:shadow-md"
          : "border-violet-500/40 dark:border-violet-500/30 bg-violet-500/10 text-foreground hover:border-violet-500/60 hover:bg-violet-500/15 hover:shadow-md",
        badgeCls: urgent
          ? "bg-rose-500/25 text-rose-800 dark:text-rose-300 border-rose-500/40 font-extrabold animate-pulse"
          : "bg-violet-500/20 text-violet-800 dark:text-violet-300 border-violet-500/40 font-bold",
        drillKind: { kind: "issue", issueId: iss.id },
      });
    });

    return list;
  }, [intentTree.data, statecraftEvents, now, issuesData.data]);

  // Filter events by selected day & category chip, ensuring Priority Issues sort to the top of the list
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
  const soonestEvent = statecraftEvents[0];
  const _nextEventValue = soonestEvent ? formatRelativeIxDays(soonestEvent.ixTime, now) : "—";
  const civCapPct = Math.round(
    Math.max(10, Math.min(100, ((slotCap - usedSlots) / slotCap) * 100))
  );

  return (
    <>
      <FacetCard
        depth={1}
        className="bg-card/40 dark:bg-card/30 border-border/80 flex flex-col gap-4 p-4.5 shadow-lg backdrop-blur-md dark:border-white/10 dark:shadow-2xl"
      >
        {/* ── StandBy Hero Clock & Telemetry Header ─────────────────── */}
        <div className="border-border/70 bg-card/60 relative overflow-hidden rounded-2xl border p-4 shadow-xs backdrop-blur-xl dark:border-white/10 dark:bg-gradient-to-br dark:from-white/[0.06] dark:via-white/[0.02] dark:to-transparent dark:shadow-lg dark:shadow-black/20">
          {/* Subtle Ambient Light Glow Accent */}
          <div className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-cyan-500/5 blur-2xl dark:bg-cyan-500/10" />

          <div className="border-border/60 relative z-10 flex flex-wrap items-center justify-between gap-3 border-b pb-3 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <Calendar className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <div className="flex items-center gap-2">
                <span className="text-foreground text-xs font-black tracking-tight">
                  Issues & Events — Executive Agenda
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-cyan-800 uppercase shadow-xs dark:text-cyan-300">
                  <span>{currentSeason.emoji}</span>
                  <span>{currentSeason.name}</span>
                </span>
              </div>
            </div>

            {/* Directives Capacity Pill & Apple-Style CivCap Telemetry Bar */}
            <div className="flex flex-col items-end gap-1.5">
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

              {/* Apple-style Translucent CivCap Capsule Bar */}
              <div
                className="flex items-center gap-2 rounded-full border border-black/10 bg-black/5 px-2.5 py-1 backdrop-blur-md dark:border-white/10 dark:bg-white/5"
                title="Civil Capacity (CivCap) administrative throughput remaining"
              >
                <span className="text-muted-foreground text-[9px] font-extrabold tracking-widest uppercase">
                  CivCap
                </span>
                <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-black/10 shadow-inner dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-amber-500 shadow-xs transition-all duration-500 ease-out dark:bg-amber-400"
                    style={{ width: `${civCapPct}%` }}
                  />
                </div>
                <span className="text-foreground font-mono text-[10px] font-bold tabular-nums">
                  {civCapPct}%
                </span>
              </div>
            </div>
          </div>

          {/* Complications Row */}
          <div className="relative z-10 mt-3 grid grid-cols-3 gap-2.5">
            <Complication
              icon={
                governanceConfig?.icon ?? (
                  <Gavel className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                )
              }
              label={governanceConfig?.label ?? "Term progress"}
              value={governanceConfig?.value ?? resolvedTermProgress}
              tooltip={governanceConfig?.tooltip}
              onClick={() => onOpenDrill?.({ kind: "politics" })}
            />
            <Complication
              icon={<AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
              label="Active issues"
              value={`${activeIssuesCount} Pending`}
              tooltip="National issues and policy crises awaiting executive decision or legislative action."
              onClick={() => onOpenDrill?.({ kind: "politics" })}
            />
            <Complication
              icon={<Heart className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />}
              label="Approval"
              value={resolvedApproval}
              tooltip="Public Approval Rating of the active administration."
              onClick={() => onOpenDrill?.({ kind: "politics" })}
            />
          </div>
        </div>

        {/* ── 7-Day Horizon Strip (Apple Spring Motion & Fluid Selection) ────── */}
        <div className="relative grid grid-cols-7 gap-1.5">
          {days.map(({ offset, dayName, dayNum }) => {
            const isSelected = selectedDayOffset === offset;
            const hasEvent = events.some((e) => e.dayOffset === offset);
            return (
              <button
                key={offset}
                type="button"
                onClick={() => setSelectedDayOffset(offset)}
                className={cn(
                  "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border p-2 text-center transition-colors select-none active:scale-[0.97]",
                  isSelected
                    ? "border-cyan-500/50 text-cyan-950 shadow-xs dark:text-cyan-200"
                    : "border-border/50 bg-card/40 hover:bg-card/80 text-muted-foreground dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/10"
                )}
              >
                {isSelected && (
                  <motion.div
                    layoutId="agenda-day-pill"
                    className="absolute inset-0 rounded-xl border border-cyan-500/40 bg-cyan-500/15 dark:bg-cyan-500/20"
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 text-[9px] font-extrabold tracking-wider uppercase opacity-90",
                    isSelected ? "text-cyan-950 dark:text-cyan-200" : "text-muted-foreground"
                  )}
                >
                  {dayName}
                </span>
                <span
                  className={cn(
                    "relative z-10 text-xs font-black tracking-tight",
                    isSelected ? "text-cyan-950 dark:text-cyan-200" : "text-foreground"
                  )}
                >
                  {dayNum}
                </span>
                {hasEvent && (
                  <span className="relative z-10 mt-1 h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500 dark:bg-cyan-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Category Filter Chips (Sliding Pill Selection) ─────────────────── */}
        <div className="border-border/60 flex flex-wrap items-center gap-1.5 border-t pt-2.5 dark:border-white/5">
          <div className="text-muted-foreground mr-1 flex items-center gap-1 text-[10px] font-extrabold tracking-wider uppercase select-none">
            <Filter className="h-3 w-3" />
            <span>Filter:</span>
          </div>
          {[
            { id: "all", label: "All" },
            { id: "directive", label: "⚡ Directives" },
            { id: "politics", label: "⚖️ Politics" },
            { id: "diplomacy", label: "🤝 Diplomacy" },
            { id: "defense", label: "🛡️ Defense" },
            { id: "economy", label: "📈 Economy" },
          ].map((chip) => {
            const isActive = categoryFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setCategoryFilter(chip.id)}
                className={cn(
                  "relative cursor-pointer rounded-lg border px-2.5 py-1 text-[10px] font-bold transition-colors select-none active:scale-[0.97]",
                  isActive
                    ? "border-cyan-500/50 font-extrabold text-cyan-950 dark:text-cyan-200"
                    : "border-border/60 bg-card/50 text-muted-foreground hover:bg-card/90 hover:text-foreground dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="agenda-filter-pill"
                    className="absolute inset-0 rounded-lg border border-cyan-500/40 bg-cyan-500/15 dark:bg-cyan-500/20"
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10",
                    isActive ? "text-cyan-950 dark:text-cyan-200" : "text-muted-foreground"
                  )}
                >
                  {chip.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Event Cards & Action Items (Inline Scrollable Container) ───────── */}
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
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        {selectedEvent && (
          <DialogContent className="border-border/80 bg-card/95 max-w-md space-y-4 rounded-2xl p-6 shadow-2xl backdrop-blur-2xl dark:border-white/15">
            <DialogHeader className="space-y-2 text-left">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase",
                    selectedEvent.badgeCls
                  )}
                >
                  {selectedEvent.statusLabel}
                </span>
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  {selectedEvent.timeLabel}
                </span>
              </div>
              <DialogTitle className="text-foreground text-base font-black tracking-tight">
                {selectedEvent.title}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
                {selectedEvent.description}
              </DialogDescription>
            </DialogHeader>

            {/* Directive Goal Resolution Preview Box */}
            <div className="space-y-1 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 shadow-inner">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                <Command className="h-3.5 w-3.5" />
                <span>Recommended Resolution Directive</span>
              </div>
              <p className="text-foreground text-xs leading-snug font-semibold">
                "{selectedEvent.directiveGoal}"
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const goal = selectedEvent.directiveGoal;
                  setSelectedEvent(null);
                  onDeclare?.(goal);
                }}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/20 px-4 py-2.5 text-xs font-extrabold text-amber-900 shadow-md transition-all hover:bg-amber-500/30 active:scale-95 dark:text-amber-300"
              >
                <Command className="h-4 w-4" />
                <span>Declare Directive to Resolve</span>
                <ArrowUpRight className="h-4 w-4 opacity-70" />
              </button>

              {selectedEvent.drillKind ? (
                <button
                  type="button"
                  onClick={() => {
                    const drill = selectedEvent.drillKind!;
                    setSelectedEvent(null);
                    onOpenDrill?.(drill);
                  }}
                  className="border-border/70 bg-card/60 hover:bg-card/90 text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition-all active:scale-98 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>
                    {selectedEvent.drillKind.kind === "issue"
                      ? "Open Issue Brief"
                      : "Inspect Domain Details"}
                  </span>
                </button>
              ) : selectedEvent.intentId ? (
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedEvent.intentId!;
                    setSelectedEvent(null);
                    onOpenIntent?.(id);
                  }}
                  className="border-border/70 bg-card/60 hover:bg-card/90 text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition-all active:scale-98 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>Inspect Directive Tree</span>
                </button>
              ) : null}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

"use client";

import { useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  Command,
  ArrowUpRight,
  Shield,
  Handshake,
  Scale,
  TrendingUp,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Compass,
  Sparkles,
} from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import type { V2Drill } from "./V2DrillSheets";

interface PulseEvent {
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
}

export function V2RealtimePulseWidget({
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
  const [selectedEvent, setSelectedEvent] = useState<PulseEvent | null>(null);

  const intentTree = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });
  const status = api.intent.getStatus.useQuery({ countryId }, { enabled: !!countryId });

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

  // Generate scheduled real-time pulse items
  const events = useMemo<PulseEvent[]>(() => {
    const list: PulseEvent[] = [
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
        accentCls: "border-violet-500/30 bg-violet-500/5 text-violet-400",
        badgeCls: "bg-violet-500/15 text-violet-300 border-violet-500/30",
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
        accentCls: "border-teal-500/30 bg-teal-500/5 text-teal-400",
        badgeCls: "bg-teal-500/15 text-teal-300 border-teal-500/30",
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
        accentCls: "border-red-500/30 bg-red-500/5 text-red-400",
        badgeCls: "bg-red-500/15 text-red-300 border-red-500/30",
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
        accentCls: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
        badgeCls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        drillKind: { kind: "economy" },
      },
    ];

    // Add active directive rollouts if present
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
        accentCls: "border-amber-500/30 bg-amber-500/5 text-amber-400",
        badgeCls: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        intentId: it.id,
      });
    });

    return list;
  }, [intentTree.data]);

  // Filter events by selected day or show all if selected offset matches
  const filteredEvents = useMemo(() => {
    const matching = events.filter((e) => e.dayOffset === selectedDayOffset);
    return matching.length > 0 ? matching : events;
  }, [events, selectedDayOffset]);

  const usedSlots = status?.data?.usedThisWeek ?? 0;
  const slotCap = status?.data?.cap ?? 3;

  return (
    <>
      <FacetCard depth={1} className="bg-card/30 flex flex-col gap-4 p-4.5 backdrop-blur-md">
        {/* Top Header: Title & Directives Slot Capacity */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-cyan-400" />
            <h3 className="text-foreground text-xs font-black tracking-widest uppercase">
              Your Weekly Agenda
            </h3>
          </div>

          {/* Executive Directives Capacity Pill */}
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] font-semibold">
            <span className="text-muted-foreground">Directives:</span>
            <span className="font-bold text-amber-400">
              {usedSlots} / {slotCap} Used
            </span>
          </div>
        </div>

        {/* 7-Day Horizon Strip */}
        <div className="grid grid-cols-7 gap-1.5">
          {days.map(({ offset, dayName, dayNum }) => {
            const isSelected = selectedDayOffset === offset;
            const hasEvent = events.some((e) => e.dayOffset === offset);
            return (
              <button
                key={offset}
                type="button"
                onClick={() => setSelectedDayOffset(offset)}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-xl border p-2 text-center transition-all select-none",
                  isSelected
                    ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-200 shadow-sm"
                    : "text-muted-foreground border-white/5 bg-white/[0.02] hover:bg-white/10"
                )}
              >
                <span className="text-[9px] font-bold tracking-wider uppercase opacity-80">
                  {dayName}
                </span>
                <span className="text-foreground text-xs font-black">{dayNum}</span>
                {hasEvent && (
                  <span className="mt-1 h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Event Cards & Action Items — Clicking opens Quick Action Dialog */}
        <div className="space-y-2.5">
          {filteredEvents.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedEvent(item)}
                className={cn(
                  "group relative flex cursor-pointer flex-col items-start justify-between gap-3 rounded-xl border p-3 backdrop-blur-md transition-all hover:bg-white/[0.06] active:scale-[0.99] sm:flex-row sm:items-center",
                  item.accentCls
                )}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 shadow-inner">
                    <Icon className="h-4 w-4 shrink-0" />
                  </div>
                  <div className="flex min-w-0 flex-col space-y-0.5 text-left">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase",
                          item.badgeCls
                        )}
                      >
                        {item.statusLabel}
                      </span>
                      <span className="text-muted-foreground/80 font-mono text-[10px]">
                        {item.timeLabel}
                      </span>
                    </div>
                    <h4 className="text-foreground truncate text-xs leading-tight font-extrabold">
                      {item.title}
                    </h4>
                    <p className="text-muted-foreground line-clamp-1 text-[11px]">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Shortened Action Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEvent(item);
                  }}
                  className="text-foreground flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold transition-all hover:bg-white/20 active:scale-95"
                >
                  <span>Action</span>
                  <ArrowUpRight className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
                </button>
              </div>
            );
          })}
        </div>
      </FacetCard>

      {/* Quick Action Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        {selectedEvent && (
          <DialogContent className="border-border/80 bg-card/95 max-w-md space-y-4 rounded-2xl p-6 shadow-2xl backdrop-blur-2xl">
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
                <span className="text-muted-foreground font-mono text-xs">
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
            <div className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <Command className="h-3.5 w-3.5" />
                <span>Recommended Resolution Directive</span>
              </div>
              <p className="text-foreground/90 text-xs leading-snug font-semibold">
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
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/20 px-4 py-2.5 text-xs font-extrabold text-amber-300 shadow-md transition-all hover:bg-amber-500/30 active:scale-95"
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
                  className="text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold transition-all hover:bg-white/10"
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>Inspect Domain Details</span>
                </button>
              ) : selectedEvent.intentId ? (
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedEvent.intentId!;
                    setSelectedEvent(null);
                    onOpenIntent?.(id);
                  }}
                  className="text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold transition-all hover:bg-white/10"
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

"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  KeyCommand as Command,
  NavArrowRight,
  CalendarRotate as CalendarClock,
  WarningCircle as AlertCircle,
} from "iconoir-react";
import {
  FacetCard,
  FacetCardContent,
  FacetCardHeader,
  FacetContainer,
} from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";
import { FacetTabs } from "~/components/ui/facet";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useIxTimeStore } from "~/stores/ixtime-store";
import { getUpcomingEvents, formatRelativeIxDays } from "~/lib/statecraft/calendar";
import {
  type AgendaEvent,
  type ExecutiveAgendaProps,
  AGENDA_CATEGORY_LABEL,
  seasonFor,
  getSeverityRank,
  AgendaHorizonStrip,
  AgendaEventActionDialog,
} from "./agenda";
import { STATUS_TEXT } from "./status-tone";

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

type CategoryFilter = "all" | AgendaEvent["category"];

/**
 * Executive agenda: a 7-day horizon of real items only — open national issues, active
 * directives, upcoming elections and issue deadlines. Nothing is scheduled for show; an
 * empty day says so and offers the next step.
 */
function ExecutiveAgendaComponent({
  countryId,
  onOpenDrill,
  onIssueDirective,
  onOpenIntent,
}: ExecutiveAgendaProps): React.JSX.Element {
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);

  // Real-time IxTime Store Telemetry
  const now = useIxTimeStore((s) => Math.floor(s.ixTimeTimestamp / 15000) * 15000);

  // Queries for statecraft telemetry & agenda context
  const intentTree = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });
  const elections = api.elections.getElections.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId, staleTime: 60_000 }
  );
  const issuesData = api.nationalIssues.getMyIssues.useQuery(
    { countryId: countryId ?? "", status: "active" },
    { enabled: !!countryId, staleTime: 60_000 }
  );

  const isLoading = intentTree.isLoading || issuesData.isLoading;

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

  // Statecraft calendar: elections and issue deadlines
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
    const list: AgendaEvent[] = [];

    // Active national issues awaiting executive action
    const rawActiveIssues = (issuesData.data?.issues ?? []) as StatecraftIssueItem[];
    const activeIssues = [...rawActiveIssues].sort((a, b) => {
      const aScore = getSeverityRank(a.severity ?? "") * 100 + (a.urgency ?? 0);
      const bScore = getSeverityRank(b.severity ?? "") * 100 + (b.urgency ?? 0);
      return bScore - aScore;
    });
    activeIssues.forEach((iss) => {
      const sev = String(iss.severity ?? "").toLowerCase();
      const urgent = sev === "critical" || sev === "high" || (iss.urgency ?? 0) > 70;
      list.push({
        id: `issue-ev-${iss.id}`,
        dayOffset: 0,
        timeLabel: urgent ? "Urgent" : "Awaiting decision",
        title: iss.title,
        category: "politics",
        description:
          iss.description ||
          "This national issue is waiting for your decision. Open the brief to weigh the options.",
        directiveGoal: `Resolve national policy issue: ${iss.title}`,
        statusLabel: urgent ? "Priority issue" : "Open issue",
        icon: AlertCircle,
        tone: urgent ? "critical" : "neutral",
        priority: urgent ? 4 : 3,
        drillKind: { kind: "issue", issueId: iss.id },
      });
    });

    // Active executive directive rollouts
    const rawIntents = Array.isArray(intentTree.data)
      ? intentTree.data
      : (intentTree.data?.allIntents ?? []);
    const intentsList = rawIntents as StatecraftIntentItem[];
    intentsList
      .filter((i) => i.status?.toLowerCase() === "active")
      .forEach((it) => {
        const tier = it.tier
          ? `${it.tier.charAt(0).toUpperCase()}${it.tier.slice(1)} directive`
          : "Directive";
        list.push({
          id: `intent-ev-${it.id}`,
          dayOffset: 0,
          timeLabel: "In progress",
          title: it.goal,
          category: "directive",
          description: `Your government is carrying out this directive${it.category ? ` in ${it.category}` : ""}.`,
          directiveGoal: `Accelerate directive rollout: ${it.goal}`,
          statusLabel: tier,
          icon: Command,
          tone: "accent",
          priority: 2,
          intentId: it.id,
        });
      });

    // Upcoming statecraft calendar events (elections, issue deadlines)
    statecraftEvents.forEach((ev, idx) => {
      const daysAhead = Math.max(0, Math.floor((ev.ixTime - now) / 86_400_000));
      list.push({
        id: `sc-ev-${ev.id || idx}`,
        dayOffset: Math.min(6, daysAhead),
        timeLabel: formatRelativeIxDays(ev.ixTime, now),
        title: ev.label,
        category: ev.section === "politics" ? "politics" : "directive",
        description: `Scheduled on your ${ev.section} calendar.`,
        directiveGoal: `Address scheduled statecraft event: ${ev.label}`,
        statusLabel: "Scheduled",
        icon: CalendarClock,
        tone: "neutral",
        priority: 1,
        rawIxTime: ev.ixTime,
      });
    });

    return list;
  }, [intentTree.data, statecraftEvents, now, issuesData.data]);

  // Only offer filters for categories that actually have items.
  const filterOptions = useMemo(() => {
    const present = new Set(events.map((e) => e.category));
    return [
      { id: "all" as CategoryFilter, label: "All" },
      ...(Object.keys(AGENDA_CATEGORY_LABEL) as AgendaEvent["category"][])
        .filter((c) => present.has(c))
        .map((c) => ({ id: c as CategoryFilter, label: AGENDA_CATEGORY_LABEL[c] })),
    ];
  }, [events]);

  const activeFilter = filterOptions.some((o) => o.id === categoryFilter) ? categoryFilter : "all";

  // Filter events by selected day & category, most pressing first
  const filteredEvents = useMemo(() => {
    return events
      .filter(
        (e) =>
          e.dayOffset === selectedDayOffset &&
          (activeFilter === "all" || e.category === activeFilter)
      )
      .sort((a, b) => b.priority - a.priority);
  }, [events, selectedDayOffset, activeFilter]);

  const selectedDay = days.find((d) => d.offset === selectedDayOffset);
  const dayLabel = selectedDay?.isToday
    ? "today"
    : `${selectedDay?.dayName} ${selectedDay?.dayNum}`;

  return (
    <>
      <FacetCard
        id="executive-agenda"
        depth={2}
        interactive="none"
        role="region"
        aria-labelledby="executive-agenda-title"
        className="rounded-3xl"
      >
        <FacetCardHeader className="gap-0.5 p-4 pb-0 sm:p-5 sm:pb-0">
          <h2
            id="executive-agenda-title"
            className="text-foreground text-base font-semibold tracking-tight"
          >
            Agenda
          </h2>
          <p className="text-muted-foreground text-xs">
            {currentSeason.name} · the next seven days
          </p>
        </FacetCardHeader>

        <FacetCardContent className="flex flex-col gap-4 p-4 sm:p-5">
          <AgendaHorizonStrip
            days={days}
            selectedDayOffset={selectedDayOffset}
            onSelectDayOffset={setSelectedDayOffset}
            events={events}
          />

          {filterOptions.length > 2 && (
            <div
              role="group"
              aria-label="Filter agenda"
              className="max-w-full scrollbar-none self-start overflow-x-auto"
            >
              <FacetTabs
                size="sm"
                tone="neutral"
                className="w-max"
                activeTab={activeFilter}
                onChange={(id) => setCategoryFilter(id as CategoryFilter)}
                tabs={filterOptions.map((opt) => ({
                  id: opt.id,
                  className: "shrink-0",
                  label: (
                    <>
                      {opt.label}
                      {opt.id === activeFilter ? (
                        <span className="sr-only"> (selected)</span>
                      ) : null}
                    </>
                  ),
                }))}
              />
            </div>
          )}

          {isLoading ? (
            <FacetContainer
              depth={3}
              surface="solid"
              className="divide-border divide-y overflow-hidden rounded-2xl"
              aria-busy="true"
              aria-label="Loading agenda"
            >
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex min-h-16 items-center gap-3 px-3 py-2.5">
                  <Skeleton className="size-4 shrink-0 rounded" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </div>
              ))}
            </FacetContainer>
          ) : filteredEvents.length > 0 ? (
            <FacetContainer
              depth={3}
              surface="solid"
              className="max-h-[420px] overflow-y-auto rounded-2xl"
            >
              <ul aria-label={`Agenda for ${dayLabel}`} className="divide-border divide-y">
                <AnimatePresence initial={false}>
                  {filteredEvents.map((item) => (
                    <motion.li
                      key={item.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setSelectedEvent(item)}
                        className="group h-auto min-h-16 w-full justify-start gap-3 rounded-none px-3 py-2.5 text-left font-normal whitespace-normal focus-visible:ring-inset active:scale-100"
                      >
                        <item.icon
                          aria-hidden="true"
                          className={cn("size-4 shrink-0", STATUS_TEXT[item.tone])}
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-foreground line-clamp-1 text-sm font-medium">
                            {item.title}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs">
                            <span className={cn("font-medium", STATUS_TEXT[item.tone])}>
                              {item.statusLabel}
                            </span>
                            <span className="text-muted-foreground/60" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              {item.timeLabel}
                            </span>
                          </span>
                        </span>
                        <NavArrowRight
                          aria-hidden="true"
                          className="text-muted-foreground/60 group-hover:text-muted-foreground shrink-0"
                        />
                      </Button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </FacetContainer>
          ) : (
            <FacetContainer
              depth={3}
              surface="solid"
              className="flex flex-col items-center rounded-2xl px-6 py-8 text-center"
            >
              <Calendar aria-hidden="true" className="text-muted-foreground mb-3 size-8" />
              <p className="text-foreground text-sm font-semibold">
                {activeFilter === "all"
                  ? `Nothing on the agenda ${selectedDay?.isToday ? "today" : `for ${dayLabel}`}`
                  : `No ${AGENDA_CATEGORY_LABEL[activeFilter].toLowerCase()} ${selectedDay?.isToday ? "today" : `on ${dayLabel}`}`}
              </p>
              <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-relaxed">
                Open issues, active directives, elections and issue deadlines appear here. Set your
                government&apos;s next priority with a directive.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {activeFilter !== "all" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setCategoryFilter("all")}
                  >
                    Show everything
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  data-cuelume-press="bloom"
                  onClick={() => onIssueDirective?.()}
                >
                  <Command aria-hidden="true" />
                  Declare Directive
                </Button>
              </div>
            </FacetContainer>
          )}
        </FacetCardContent>
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

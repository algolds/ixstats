"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Calendar, Check, TriangleFlag } from "iconoir-react";
import { Button, focusRing, hitSlop } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { SwipeActionButton, SwipeableGroup, SwipeableRow } from "~/components/ui/facet";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { REDUCED_MOTION_FADE, springSmooth, springSnappy, tweenExit } from "~/lib/design/motion";
import { DirectiveStatusLine } from "./DirectiveStatusLine";
import { useClockNow, useNationClock } from "~/hooks/useNationClock";
import {
  type AgendaItem,
  type AgendaSourceElection,
  type AgendaSourceIntent,
  type AgendaSourceIssue,
  type ExecutiveAgendaProps,
  deriveAgendaItems,
  formatAgendaTime,
} from "./agenda";
import { STATUS_TEXT } from "./status-tone";

const doneKey = (countryId: string) => `ixstats:agenda-done:${countryId}`;

/** Rows shown before "Show all": the page scrolls, never the agenda inside it. */
const AGENDA_PREVIEW = 5;

function readDone(key: string): ReadonlySet<string> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(key) ?? "[]") as string[];
    return new Set(Array.isArray(raw) ? raw.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function writeDone(key: string, ids: ReadonlySet<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // storage unavailable: the item stays hidden for this session only
  }
}

/**
 * The executive agenda: open national issues, active directives and upcoming elections, most
 * pressing first. Everything comes from live game state. Completing an item (its circle, as in
 * Reminders) hides it on this device, with Undo in the toast; it does not resolve anything. The
 * first five show, then "Show all"; the page scrolls, never the list.
 */
function ExecutiveAgendaComponent({
  countryId,
  onOpenDrill,
  onOpenIntent,
}: ExecutiveAgendaProps): React.JSX.Element {
  const storageKey = doneKey(countryId);
  const [doneIds, setDoneIds] = useState<ReadonlySet<string>>(() => readDone(storageKey));

  // The nation's realm-clock "now", quantised so derivation does not re-run every tick.
  const clock = useNationClock();
  const nowIxTime = useClockNow(clock);

  const intentTree = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });
  const elections = api.elections.getElections.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId, staleTime: 60_000 }
  );
  const issuesData = api.nationalIssues.getMyIssues.useQuery(
    { countryId: countryId ?? "", status: "active" },
    { enabled: !!countryId, staleTime: 60_000 }
  );
  const treasuryData = api.exchange.getTreasury.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 60_000 }
  );
  const corporateData = api.exchange.getRealmCorporateSummary.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 60_000 }
  );

  const isLoading = intentTree.isLoading || issuesData.isLoading || nowIxTime === null;

  const items = useMemo<AgendaItem[]>(() => {
    if (nowIxTime === null || !clock) return [];
    const rawIntents = Array.isArray(intentTree.data)
      ? intentTree.data
      : (intentTree.data?.allIntents ?? []);
    const tendersWithBidsCount = (corporateData.data?.openTenders ?? []).filter(
      (t) => t.status === "OPEN" && t.bidCount > 0
    ).length;
    return deriveAgendaItems({
      issues: (issuesData.data?.issues ?? []) as AgendaSourceIssue[],
      intents: rawIntents as AgendaSourceIntent[],
      elections: (elections.data ?? []) as AgendaSourceElection[],
      corporate:
        treasuryData.data || corporateData.data
          ? {
              treasuryBalance: treasuryData.data?.balance ?? 0,
              treasuryCap: treasuryData.data?.cap ?? 0,
              distressedCount: corporateData.data?.totals.distressedCount ?? 0,
              tendersWithBidsCount,
            }
          : undefined,
      nowIxTime,
      multiplier: clock.multiplier,
      calendar: clock.calendar,
    });
  }, [
    intentTree.data,
    issuesData.data,
    elections.data,
    treasuryData.data,
    corporateData.data,
    nowIxTime,
    clock,
  ]);

  const notify = useNotify();
  const [showAll, setShowAll] = useState(false);
  // Items whose circle has been pressed: the check fills, then the row leaves.
  const [completing, setCompleting] = useState<ReadonlySet<string>>(() => new Set());
  const remaining = items.filter((item) => !doneIds.has(item.id));
  const visible = showAll ? remaining : remaining.slice(0, AGENDA_PREVIEW);
  const nowMs = useMemo(() => Date.now(), [items]);

  const markDone = (id: string) => {
    setDoneIds((prev) => {
      const next = new Set([...prev].filter((d) => items.some((i) => i.id === d)));
      next.add(id);
      writeDone(storageKey, next);
      return next;
    });
  };

  const undo = (id: string) => {
    setCompleting((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setDoneIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      writeDone(storageKey, next);
      return next;
    });
  };

  const raiseUndoToast = (item: AgendaItem) => {
    notify.info("Hidden from your agenda", item.title, {
      actions: [{ label: "Undo", onClick: () => undo(item.id) }],
    });
  };

  // The toast (and its sound) lands on the press, the same moment the circle fills.
  const complete = (item: AgendaItem) => {
    setCompleting((prev) => new Set(prev).add(item.id));
    raiseUndoToast(item);
  };

  // Swipe commit or tray action: the row has already slid away, so hide it and offer Undo.
  const completeBySwipe = (item: AgendaItem) => {
    raiseUndoToast(item);
    markDone(item.id);
  };

  const open = (item: AgendaItem) => {
    if (item.href && typeof window !== "undefined" && item.href.includes("?")) {
      const q = item.href.slice(item.href.indexOf("?"));
      window.history.replaceState(null, "", `${window.location.pathname}${q}`);
    }
    if (item.drillKind) onOpenDrill?.(item.drillKind);
    else if (item.intentId) onOpenIntent?.(item.intentId);
  };

  return (
    <Card id="executive-agenda" role="region" aria-labelledby="executive-agenda-title">
      <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4 pb-0 sm:p-5 sm:pb-0">
        <CardTitle id="executive-agenda-title" icon={<Calendar />} role="heading" aria-level={2}>
          Agenda
        </CardTitle>
        <DirectiveStatusLine countryId={countryId} />
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {isLoading ? (
          <div className="flex flex-col" aria-busy="true" aria-label="Loading agenda">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex min-h-14 items-center gap-3 py-2">
                <Skeleton className="size-4 shrink-0 rounded-xs" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/5" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length > 0 ? (
          <SwipeableGroup>
            <ul className="divide-separator relative flex flex-col divide-y">
              <AnimatePresence mode="popLayout" initial={false}>
                {visible.map((item) => (
                  <AgendaRow
                    key={item.id}
                    item={item}
                    nowMs={nowMs}
                    completing={completing.has(item.id)}
                    onOpen={() => open(item)}
                    onComplete={() => complete(item)}
                    onCompleted={() => markDone(item.id)}
                    onSwipeDone={() => completeBySwipe(item)}
                  />
                ))}
              </AnimatePresence>
            </ul>
            {remaining.length > AGENDA_PREVIEW && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                className="text-label-secondary mt-2 w-full max-sm:h-11"
              >
                {showAll ? "Show fewer" : `Show all (${remaining.length})`}
              </Button>
            )}
          </SwipeableGroup>
        ) : (
          <EmptyState
            compact
            title="Nothing on your agenda"
            message="There are no open issues, active directives or upcoming elections. Declare a Directive from the header to set a priority."
          />
        )}
      </CardContent>
    </Card>
  );
}

/** One agenda row; `ref` lets AnimatePresence pop it out of flow as it leaves. */
function AgendaRow({
  ref,
  item,
  nowMs,
  completing,
  onOpen,
  onComplete,
  onCompleted,
  onSwipeDone,
}: {
  ref?: React.Ref<HTMLLIElement>;
  item: AgendaItem;
  nowMs: number;
  completing: boolean;
  onOpen: () => void;
  onComplete: () => void;
  onCompleted: () => void;
  onSwipeDone: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const Icon = item.icon;
  const time = formatAgendaTime(item, nowMs);
  const pressing = item.urgency === "overdue" || item.urgency === "due-soon";

  return (
    <motion.li
      ref={ref}
      layout={!reduceMotion}
      exit={{ opacity: 0, transition: tweenExit }}
      transition={reduceMotion ? REDUCED_MOTION_FADE : springSmooth}
    >
      <SwipeableRow
        id={`agenda-${item.id}`}
        springPreset="bouncy"
        thresholds={{ reveal: 0.2, emphasize: 0.45, commit: 0.65 }}
        disabled={Boolean(reduceMotion) || completing}
      >
        <SwipeableRow.Trailing
          commit={{
            label: "Done",
            icon: Check,
            color: "var(--tint)",
            action: onSwipeDone,
          }}
        >
          <SwipeActionButton
            id="done"
            icon={Check}
            label="Done"
            aria-label={`Hide from agenda: ${item.title}`}
            onClick={onSwipeDone}
            color="green"
          />
        </SwipeableRow.Trailing>
        <SwipeableRow.Content className="cursor-auto active:cursor-auto">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpen}
              className={cn(
                "facet-press-subtle hover:bg-fill-3 rounded-control-sm flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 text-left",
                focusRing
              )}
            >
              <Icon aria-hidden="true" className={cn("size-4 shrink-0", STATUS_TEXT[item.tone])} />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="text-label line-clamp-1 min-w-0">{item.title}</span>
                  {item.flagged ? (
                    <TriangleFlag
                      role="img"
                      aria-label="Needs action"
                      className={cn(
                        "size-3.5 shrink-0",
                        item.tone === "warning" ? STATUS_TEXT.warning : "text-destructive"
                      )}
                    />
                  ) : null}
                </span>
                <span className="text-footnote line-clamp-1 block">
                  <span className={cn("font-medium", STATUS_TEXT[item.tone])}>
                    {item.statusLabel}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span className="sr-only">. </span>
                  <span className="text-label-secondary">{item.preview}</span>
                </span>
              </span>
              {time ? (
                <span
                  className={cn(
                    "text-footnote shrink-0 tabular-nums",
                    pressing
                      ? cn(
                          "font-medium",
                          item.urgency === "overdue" ? "text-destructive" : STATUS_TEXT.warning
                        )
                      : "text-label-secondary"
                  )}
                >
                  {time}
                </span>
              ) : null}
            </button>
            {/* The completion circle, as in Reminders: it fills on press, then the row leaves. */}
            <button
              type="button"
              onClick={onComplete}
              disabled={completing}
              aria-label={`Mark done: ${item.title}`}
              className={cn(
                hitSlop,
                "group/done facet-press relative grid size-11 shrink-0 cursor-pointer place-items-center rounded-full sm:size-9",
                focusRing
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "duration-fast ease-out-facet grid size-5 place-items-center rounded-full border-2 transition-colors",
                  completing
                    ? "border-primary-fill bg-primary-fill"
                    : "border-separator group-hover/done:border-tint group-focus-visible/done:border-tint"
                )}
              >
                <AnimatePresence>
                  {completing && (
                    <motion.span
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                      transition={reduceMotion ? REDUCED_MOTION_FADE : springSnappy}
                      onAnimationComplete={onCompleted}
                      className="text-on-primary grid place-items-center"
                    >
                      <Check className="size-3.5" strokeWidth={2.5} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </button>
          </div>
        </SwipeableRow.Content>
      </SwipeableRow>
    </motion.li>
  );
}

export const ExecutiveAgenda = React.memo(ExecutiveAgendaComponent);

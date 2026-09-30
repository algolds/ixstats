"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Archive, KeyCommand, Page, Plus } from "iconoir-react";
import { api } from "~/trpc/react";
import { KitButton } from "~/components/mycountry/directives/KitButton";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { useIxTimeStore } from "~/stores/ixtime-store";
import { FOCUS_RING, PRESSABLE, SegmentedFilter } from "~/components/mycountry/shell/surface-kit";
import { PolicyCreatorSheet } from "~/components/executive/PolicyCreatorSheet";
import { useCountryData } from "~/components/mycountry/shared/primitives/CountryDataProvider";
import {
  IntentComposer,
  type DirectiveRef,
  type IntentCommitResult,
} from "~/components/mycountry/shared/primitives/IntentComposer";
import { DirectiveStatusStrip } from "./DirectiveStatusStrip";
import { DirectiveCard } from "./DirectiveCard";
import { directiveTimeline, type IntentRow } from "./directive-model";

export type DirectivesView = "new" | "active" | "history";
type HistoryFilter = "all" | "completed" | "abandoned";

const HISTORY_PAGE = 20;
const HISTORY_FILTERS: ReadonlyArray<{ id: HistoryFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "abandoned", label: "Abandoned" },
];

export interface DirectivesWorkspaceProps {
  countryId: string;
  initialGoal?: string;
  onCommitted?: (res: IntentCommitResult) => void;
  /** Open the full directive record (the MyCountry drill sheet). */
  onOpenIntent?: (intentId: string) => void;
  /** Open a national issue brief (to respond to resistance). */
  onOpenIssue?: (issueId: string) => void;
}

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-card flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center">
      <span className="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-full">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-foreground mt-4 text-base font-semibold">{title}</p>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-40 w-full rounded-2xl" />
      ))}
    </div>
  );
}

/**
 * The Directives page (`/mycountry/executive`): status up top, then three views —
 * declare a new directive, track the ones in force, and review past directives and outcomes.
 */
export function DirectivesWorkspace({
  countryId,
  initialGoal,
  onCommitted,
  onOpenIntent,
  onOpenIssue,
}: DirectivesWorkspaceProps) {
  const { isViewingOtherCountry, isPublicReadOnly } = useCountryData();
  const readOnly = !!isViewingOtherCountry || !!isPublicReadOnly;
  const nowIxTime = useIxTimeStore((s) => Math.floor(s.ixTimeTimestamp / 60_000) * 60_000);

  const [view, setView] = useState<DirectivesView>("new");
  const [followUpOf, setFollowUpOf] = useState<DirectiveRef | null>(null);
  const [seed, setSeed] = useState({ goal: initialGoal ?? "", n: 0 });
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE);
  const [showPolicySheet, setShowPolicySheet] = useState(false);

  // A new goal handed in from elsewhere (an issue brief, the agenda) reopens the composer on it.
  const lastInitialGoal = useRef(initialGoal);
  useEffect(() => {
    const previous = lastInitialGoal.current;
    lastInitialGoal.current = initialGoal;
    if (!initialGoal || initialGoal === previous) return;
    // oxlint-disable-next-line -- syncing a prop into local state
    setSeed((s) => ({ goal: initialGoal, n: s.n + 1 }));
    setView("new");
  }, [initialGoal]);

  const tree = api.intent.getTree.useQuery({ countryId }, { enabled: !!countryId });

  const { active, history, goalById } = useMemo(() => {
    const all = (tree.data?.allIntents ?? []) as IntentRow[];
    const byId = new Map(all.map((i) => [i.id, i.goal]));
    const newestFirst = [...all].sort((a, b) => b.createdIxTime - a.createdIxTime);
    return {
      active: newestFirst.filter((i) => i.status === "active"),
      history: newestFirst.filter((i) => i.status !== "active"),
      goalById: byId,
    };
  }, [tree.data]);

  const executingCount = useMemo(
    () => active.filter((i) => directiveTimeline(i, nowIxTime).phase === "executing").length,
    [active, nowIxTime]
  );

  const filteredHistory = useMemo(
    () => (historyFilter === "all" ? history : history.filter((i) => i.status === historyFilter)),
    [history, historyFilter]
  );

  const startFollowUp = (ref: DirectiveRef) => {
    setFollowUpOf(ref);
    setView("new");
  };
  const reuseGoal = (goal: string) => {
    setFollowUpOf(null);
    setSeed((s) => ({ goal, n: s.n + 1 }));
    setView("new");
  };

  const views: { id: DirectivesView; label: string; count?: number }[] = [
    { id: "new", label: "New directive" },
    { id: "active", label: "In force", count: tree.data ? active.length : undefined },
    { id: "history", label: "History", count: tree.data ? history.length : undefined },
  ];

  const cardProps = {
    nowIxTime,
    onOpenIntent,
    onOpenIssue,
    readOnly,
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
            <KeyCommand className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-foreground text-2xl leading-8 font-semibold tracking-tight">
              Directives
            </h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              Set a national goal, choose how hard to push, and track what it changes. Each
              directive uses a weekly slot and holds CivCap while it executes.
            </p>
          </div>
        </div>
        {!readOnly && (
          <KitButton
            variant="secondary"
            className="self-start sm:self-auto"
            onClick={() => setShowPolicySheet(true)}
          >
            <Page /> Draft a custom policy
          </KitButton>
        )}
      </header>

      <DirectiveStatusStrip
        countryId={countryId}
        nowIxTime={nowIxTime}
        activeCount={tree.data ? active.length : null}
        executingCount={tree.data ? executingCount : null}
        onShowActive={() => setView("active")}
      />

      {/* Segmented control */}
      <div
        role="group"
        aria-label="Directive views"
        className="bg-muted/60 inline-flex w-full rounded-xl p-0.5 sm:w-auto"
      >
        {views.map((v) => {
          const selected = view === v.id;
          return (
            <button
              key={v.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setView(v.id)}
              data-cuelume-press="page"
              className={cn(
                "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 text-sm font-medium whitespace-nowrap sm:h-9 sm:flex-none sm:px-4",
                PRESSABLE,
                FOCUS_RING,
                selected
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v.label}
              {v.count != null && v.count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    selected ? "bg-muted text-foreground" : "bg-card/60"
                  )}
                >
                  {v.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Views */}
      {view === "new" &&
        (readOnly ? (
          <EmptyState
            icon={KeyCommand}
            title="Viewing another nation"
            body="Directives can only be declared for a nation you play. Its directives in force and history are still visible."
          />
        ) : (
          <IntentComposer
            key={seed.n}
            countryId={countryId}
            initialGoal={seed.goal}
            followUpOf={followUpOf}
            onFollowUpChange={setFollowUpOf}
            onCommitted={onCommitted}
            onViewActive={() => setView("active")}
          />
        ))}

      {view === "active" &&
        (tree.isLoading ? (
          <ListSkeleton />
        ) : tree.error ? (
          <EmptyState
            icon={Archive}
            title="Directives could not be loaded"
            body={tree.error.message}
            action={
              <KitButton variant="secondary" onClick={() => void tree.refetch()}>
                Try again
              </KitButton>
            }
          />
        ) : active.length === 0 ? (
          <EmptyState
            icon={KeyCommand}
            title="No directives in force"
            body="Declare a directive to start moving your nation. It will appear here while it executes."
            action={
              !readOnly && (
                <KitButton variant="primary" onClick={() => setView("new")}>
                  <Plus /> Declare a directive
                </KitButton>
              )
            }
          />
        ) : (
          <div className="space-y-3">
            {active.map((intent) => (
              <DirectiveCard
                key={intent.id}
                intent={intent}
                parentGoal={intent.parentId ? goalById.get(intent.parentId) : null}
                onFollowUp={startFollowUp}
                {...cardProps}
              />
            ))}
          </div>
        ))}

      {view === "history" &&
        (tree.isLoading ? (
          <ListSkeleton />
        ) : tree.error ? (
          <EmptyState
            icon={Archive}
            title="History could not be loaded"
            body={tree.error.message}
            action={
              <KitButton variant="secondary" onClick={() => void tree.refetch()}>
                Try again
              </KitButton>
            }
          />
        ) : history.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="No past directives yet"
            body="Completed and abandoned directives appear here, with the effects they recorded."
          />
        ) : (
          <div className="space-y-4">
            <SegmentedFilter
              label="Filter history"
              options={HISTORY_FILTERS}
              value={historyFilter}
              onChange={(f) => {
                setHistoryFilter(f);
                setHistoryLimit(HISTORY_PAGE);
              }}
              className="w-fit"
            />
            {filteredHistory.length === 0 ? (
              <p className="text-muted-foreground px-1 text-sm">No {historyFilter} directives.</p>
            ) : (
              <div className="space-y-3">
                {filteredHistory.slice(0, historyLimit).map((intent) => (
                  <DirectiveCard
                    key={intent.id}
                    intent={intent}
                    parentGoal={intent.parentId ? goalById.get(intent.parentId) : null}
                    onReuseGoal={reuseGoal}
                    {...cardProps}
                  />
                ))}
              </div>
            )}
            {filteredHistory.length > historyLimit && (
              <div className="flex justify-center">
                <KitButton
                  variant="secondary"
                  onClick={() => setHistoryLimit((n) => n + HISTORY_PAGE)}
                >
                  Show more
                </KitButton>
              </div>
            )}
          </div>
        ))}

      {!readOnly && (
        <PolicyCreatorSheet
          open={showPolicySheet}
          onOpenChange={setShowPolicySheet}
          countryId={countryId}
        />
      )}
    </div>
  );
}

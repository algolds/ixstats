"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Archive, KeyCommand, Page, Plus } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { EmptyState } from "~/components/ui/empty-state";
import { useIxTimeStore } from "~/stores/ixtime-store";
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
import { Card } from "~/components/ui/card";

type DirectivesView = "new" | "active" | "history";
type HistoryFilter = "all" | "completed" | "abandoned";

const HISTORY_PAGE = 20;
const HISTORY_FILTERS: ReadonlyArray<{ value: HistoryFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
];

interface DirectivesWorkspaceProps {
  countryId: string;
  initialGoal?: string;
  onCommitted?: (res: IntentCommitResult) => void;
  /** Open the full directive record (the MyCountry drill sheet). */
  onOpenIntent?: (intentId: string) => void;
  /** Open a national issue brief (to respond to resistance). */
  onOpenIssue?: (issueId: string) => void;
}

/** An empty or error view, on its own pane. */
function EmptyPane(props: React.ComponentProps<typeof EmptyState>) {
  return (
    <Card>
      <EmptyState {...props} />
    </Card>
  );
}

/** Skeleton while loading, a retry panel on error, otherwise the children. */
function QueryGuard({
  tree,
  errorTitle,
  children,
}: {
  tree: { isLoading: boolean; error: { message: string } | null; refetch: () => unknown };
  errorTitle: string;
  children: React.ReactNode;
}) {
  if (tree.isLoading) return <ListSkeleton />;
  if (tree.error) {
    return (
      <EmptyPane
        icon={<Archive />}
        title={errorTitle}
        message={tree.error.message}
        action={
          <Button variant="outline" className="max-sm:h-11" onClick={() => void tree.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }
  return <>{children}</>;
}

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1].map((i) => (
        <Skeleton key={i} className="rounded-card h-40 w-full" />
      ))}
    </div>
  );
}

function DirectivesHeader({
  readOnly,
  onDraftPolicy,
}: {
  readOnly: boolean;
  onDraftPolicy: () => void;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 id="directives-title" className="text-label text-title-2">
          Directives
        </h2>
        <p className="text-label-secondary text-callout mt-1 max-w-2xl">
          Each directive uses a weekly slot and holds executive bandwidth while it executes.
        </p>
      </div>
      {!readOnly && (
        <Button
          variant="outline"
          className="self-start max-sm:h-11 sm:self-auto"
          onClick={onDraftPolicy}
        >
          <Page /> Draft a custom policy
        </Button>
      )}
    </header>
  );
}

/**
 * The Directives page (`/mycountry/executive`): status up top, then three views: declare a new
 * directive, track the ones in force, and review past directives and outcomes.
 *
 * The page sits on the canvas; the status strip, composer steps and directives are panes.
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

  const executingCount = active.filter(
    (i) => directiveTimeline(i, nowIxTime).phase === "executing"
  ).length;
  const filteredHistory =
    historyFilter === "all" ? history : history.filter((i) => i.status === historyFilter);

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
    { id: "new", label: "Declare" },
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
    <section aria-labelledby="directives-title" className="space-y-6">
      <DirectivesHeader readOnly={readOnly} onDraftPolicy={() => setShowPolicySheet(true)} />

      <DirectiveStatusStrip
        countryId={countryId}
        nowIxTime={nowIxTime}
        activeCount={tree.data ? active.length : null}
        executingCount={tree.data ? executingCount : null}
        onShowActive={() => setView("active")}
      />

      <Tabs value={view} onValueChange={(v) => setView(v as DirectivesView)} className="space-y-6">
        <TabsList
          aria-label="Directive views"
          className="bg-fill-3 w-full rounded-full p-1 sm:w-fit"
        >
          {views.map((v) => (
            <TabsTrigger
              key={v.id}
              value={v.id}
              className="h-11 flex-1 px-3 sm:h-9 sm:flex-none sm:px-4"
            >
              {v.label}
              {v.count != null && v.count > 0 && (
                <span className="facet-gold text-caption rounded-full px-2 tabular-nums">
                  {v.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="new">
          {readOnly ? (
            <EmptyPane
              icon={<KeyCommand />}
              title="Viewing another nation"
              message="Directives can only be declared for a nation you play. Its directives in force and history are still visible."
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
          )}
        </TabsContent>

        <TabsContent value="active">
          <QueryGuard tree={tree} errorTitle="Directives could not be loaded">
            {active.length === 0 ? (
              <EmptyPane
                icon={<KeyCommand />}
                title="No directives in force"
                message="Declare a Directive to start moving your nation."
                action={
                  !readOnly && (
                    <Button className="max-sm:h-11" onClick={() => setView("new")}>
                      <Plus aria-hidden="true" /> Declare Directive
                    </Button>
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
            )}
          </QueryGuard>
        </TabsContent>

        <TabsContent value="history">
          <QueryGuard tree={tree} errorTitle="History could not be loaded">
            {history.length === 0 ? (
              <EmptyPane
                icon={<Archive />}
                title="No past directives yet"
                message="Directives you complete or abandon are listed here with the effects they recorded."
              />
            ) : (
              <div className="space-y-4">
                <SegmentedControl
                  aria-label="Filter history"
                  size="sm"
                  value={historyFilter}
                  onValueChange={(f) => {
                    setHistoryFilter(f);
                    setHistoryLimit(HISTORY_PAGE);
                  }}
                  options={HISTORY_FILTERS}
                />
                {filteredHistory.length === 0 ? (
                  <p className="text-label-secondary text-body px-1">
                    No {historyFilter} directives.
                  </p>
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
                    <Button
                      variant="outline"
                      className="max-sm:h-11"
                      onClick={() => setHistoryLimit((n) => n + HISTORY_PAGE)}
                    >
                      Show more
                    </Button>
                  </div>
                )}
              </div>
            )}
          </QueryGuard>
        </TabsContent>
      </Tabs>

      {!readOnly && (
        <PolicyCreatorSheet
          open={showPolicySheet}
          onOpenChange={setShowPolicySheet}
          countryId={countryId}
        />
      )}
    </section>
  );
}

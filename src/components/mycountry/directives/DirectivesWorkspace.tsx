"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Archive, KeyCommand, Page, Plus } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { FacetCard } from "~/components/ui/facet-container";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Toggle } from "~/components/ui/toggle";
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
    <FacetCard className="rounded-card flex flex-col items-center px-6 py-12 text-center">
      <Icon className="text-label-secondary h-6 w-6" aria-hidden />
      <p className="text-label text-title-3 mt-4">{title}</p>
      <p className="text-label-secondary text-body mt-1 max-w-sm">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </FacetCard>
  );
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

/**
 * The Directives page (`/mycountry/executive`): status up top, then three views —
 * declare a new directive, track the ones in force, and review past directives and outcomes.
 *
 * Facet depth: the workspace is the one glass shell (depth 1); the cards inside it (status
 * strip, composer steps) are depth 2 and the directive rows / approach options depth 3, all
 * `surface="solid"` so blur never stacks.
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

  const tabsId = useId();
  const tabId = (v: DirectivesView) => `${tabsId}-tab-${v}`;
  const panelId = (v: DirectivesView) => `${tabsId}-panel-${v}`;

  const views: { id: DirectivesView; label: string; count?: number }[] = [
    { id: "new", label: "New directive" },
    { id: "active", label: "In force", count: tree.data ? active.length : undefined },
    { id: "history", label: "History", count: tree.data ? history.length : undefined },
  ];

  // Roving focus for the view tabs (the Tabs primitive leaves arrow keys to its caller).
  const onTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const index = views.findIndex((v) => v.id === view);
    const last = views.length - 1;
    const next =
      e.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : e.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    e.preventDefault();
    const id = views[next]!.id;
    setView(id);
    document.getElementById(tabId(id))?.focus();
  };

  const cardProps = {
    nowIxTime,
    onOpenIntent,
    onOpenIssue,
    readOnly,
  };

  return (
    <FacetCard className="rounded-card space-y-6 p-4 sm:p-6">
      {/* Page header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-label text-title-1 leading-8">Directives</h2>
          <p className="text-label-secondary text-body mt-1 max-w-2xl">
            Set a national goal, choose how hard to push, and track what it changes. Each directive
            uses a weekly slot and holds CivCap while it executes.
          </p>
        </div>
        {!readOnly && (
          <Button
            variant="outline"
            className="self-start max-sm:h-11 sm:self-auto"
            onClick={() => setShowPolicySheet(true)}
          >
            <Page /> Draft a custom policy
          </Button>
        )}
      </header>

      <DirectiveStatusStrip
        countryId={countryId}
        nowIxTime={nowIxTime}
        activeCount={tree.data ? active.length : null}
        executingCount={tree.data ? executingCount : null}
        onShowActive={() => setView("active")}
      />

      <Tabs value={view} onValueChange={(v) => setView(v as DirectivesView)} className="space-y-6">
        <TabsList
          role="tablist"
          aria-label="Directive views"
          onKeyDown={onTabKeyDown}
          className="bg-fill-3 w-full rounded-full p-1 sm:w-fit"
        >
          {views.map((v) => (
            <TabsTrigger
              key={v.id}
              value={v.id}
              role="tab"
              id={tabId(v.id)}
              aria-controls={panelId(v.id)}
              className="h-11 flex-1 gap-2 px-3 sm:h-9 sm:flex-none sm:px-4"
            >
              {v.label}
              {v.count != null && v.count > 0 && (
                <Badge variant="secondary" className="rounded-full px-2 tabular-nums">
                  {v.count}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Views */}
        <TabsContent value="new" role="tabpanel" id={panelId("new")} aria-labelledby={tabId("new")}>
          {readOnly ? (
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
          )}
        </TabsContent>

        <TabsContent
          value="active"
          role="tabpanel"
          id={panelId("active")}
          aria-labelledby={tabId("active")}
        >
          {tree.isLoading ? (
            <ListSkeleton />
          ) : tree.error ? (
            <EmptyState
              icon={Archive}
              title="Directives could not be loaded"
              body={tree.error.message}
              action={
                <Button
                  variant="outline"
                  className="max-sm:h-11"
                  onClick={() => void tree.refetch()}
                >
                  Try again
                </Button>
              }
            />
          ) : active.length === 0 ? (
            <EmptyState
              icon={KeyCommand}
              title="No directives in force"
              body="Declare a directive to start moving your nation. It will appear here while it executes."
              action={
                !readOnly && (
                  <Button className="max-sm:h-11" onClick={() => setView("new")}>
                    <Plus aria-hidden="true" /> Declare a directive
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
        </TabsContent>

        <TabsContent
          value="history"
          role="tabpanel"
          id={panelId("history")}
          aria-labelledby={tabId("history")}
        >
          {tree.isLoading ? (
            <ListSkeleton />
          ) : tree.error ? (
            <EmptyState
              icon={Archive}
              title="History could not be loaded"
              body={tree.error.message}
              action={
                <Button
                  variant="outline"
                  className="max-sm:h-11"
                  onClick={() => void tree.refetch()}
                >
                  Try again
                </Button>
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
              <div role="group" aria-label="Filter history" className="flex flex-wrap gap-2">
                {HISTORY_FILTERS.map((f) => (
                  <Toggle
                    key={f.id}
                    variant="outline"
                    size="sm"
                    pressed={historyFilter === f.id}
                    onPressedChange={() => {
                      setHistoryFilter(f.id);
                      setHistoryLimit(HISTORY_PAGE);
                    }}
                    className="rounded-full px-3 max-sm:h-11"
                  >
                    {f.label}
                  </Toggle>
                ))}
              </div>
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
        </TabsContent>
      </Tabs>

      {!readOnly && (
        <PolicyCreatorSheet
          open={showPolicySheet}
          onOpenChange={setShowPolicySheet}
          countryId={countryId}
        />
      )}
    </FacetCard>
  );
}

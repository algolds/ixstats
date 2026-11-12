"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Filter, KeyCommand, Page, Plus } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { EmptyState } from "~/components/ui/empty-state";
import { useClockNow, useNationClock } from "~/hooks/useNationClock";
import { PolicyCreatorSheet } from "~/components/executive/PolicyCreatorSheet";
import { useCountryData } from "~/components/mycountry/shared/primitives/CountryDataProvider";
import {
  IntentComposer,
  type DirectiveRef,
  type IntentCommitResult,
} from "~/components/mycountry/shared/primitives/IntentComposer";
import { DirectiveStatusLine } from "~/components/mycountry/shell/DirectiveStatusLine";
import { DirectiveCard } from "./DirectiveCard";
import { type IntentRow } from "./directive-model";
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
  tree: { isLoading: boolean; error: { message: string } | null; refetch: () => void };
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

/**
 * The history filter as a pull-down menu, not a third row of tabs: the command ribbon and the
 * Declare / In force / History views are the page's only navigation.
 */
function HistoryFilterMenu({
  value,
  onChange,
}: {
  value: HistoryFilter;
  onChange: (filter: HistoryFilter) => void;
}) {
  const current = HISTORY_FILTERS.find((f) => f.value === value) ?? HISTORY_FILTERS[0]!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-sm:h-11" aria-label="Filter history">
          <Filter aria-hidden />
          {current.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            const filter = HISTORY_FILTERS.find((f) => f.value === next);
            if (filter) onChange(filter.value);
          }}
        >
          {HISTORY_FILTERS.map((f) => (
            <DropdownMenuRadioItem key={f.value} value={f.value}>
              {f.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The Directives page (`/mycountry/executive`): status up top, then three views: declare a new
 * directive, track the ones in force, and review past directives and outcomes. Timing reads the
 * nation's realm clock ("now" each minute); the page waits on a skeleton until it has loaded.
 *
 * The page sits on the canvas; the status strip, composer steps and directives are panes.
 */
export function DirectivesWorkspace(props: DirectivesWorkspaceProps) {
  const nowIxTime = useClockNow(useNationClock());
  if (nowIxTime === null) return <ListSkeleton />;
  return <DirectivesWorkspaceBody {...props} nowIxTime={nowIxTime} />;
}

function DirectivesWorkspaceBody({
  countryId,
  initialGoal,
  onCommitted,
  onOpenIntent,
  onOpenIssue,
  nowIxTime,
}: DirectivesWorkspaceProps & { nowIxTime: number }) {
  const { isViewingOtherCountry, isPublicReadOnly } = useCountryData();
  const readOnly = !!isViewingOtherCountry || !!isPublicReadOnly;

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
    <section aria-label="Directives" className="space-y-5">
      <Tabs value={view} onValueChange={(v) => setView(v as DirectivesView)} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
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

          <div className="flex flex-wrap items-center gap-3">
            <DirectiveStatusLine countryId={countryId} />
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                className="max-sm:h-11"
                onClick={() => setShowPolicySheet(true)}
              >
                <Page aria-hidden /> Draft a custom policy
              </Button>
            )}
          </div>
        </div>

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
                <HistoryFilterMenu
                  value={historyFilter}
                  onChange={(f) => {
                    setHistoryFilter(f);
                    setHistoryLimit(HISTORY_PAGE);
                  }}
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

"use client";

import { useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { pageCount } from "~/lib/thinkpages-forum/paging";
import { cn } from "~/lib/utils/cn";
import { api, type RouterOutputs } from "~/trpc/react";
import { categoryLabel } from "../BanDialog";
import { Pagination, pageHref, useLastPageRedirect } from "../Pagination";

export type ModContext = RouterOutputs["thinkpagesForumMod"]["context"];
/** Display names by user id, as every console list returns them. */
export type Members = { users: Record<string, { name: string }> };

/** What every console panel receives from the console. */
export interface PanelProps {
  context: ModContext;
  /** The scope filter's realm slug; undefined for everything the viewer moderates. */
  realm?: string;
  page: number;
  /** The console's URL for this tab and scope, for page links. */
  basePath: string;
}

/** A member's display name: "System" for automatic actions, "Member" when the server named nobody. */
export function memberName(members: Members | undefined, userId: string): string {
  if (userId === "system") return "System";
  return members?.users[userId]?.name ?? "Member";
}

/** A ban's or log row's place, named from what the viewer moderates. */
export function placeName(context: ModContext, scope: string, scopeId: string | null): string {
  if (scope === "site") return "The whole forum";
  if (scope === "realm") {
    const realm = context.realms.find((r) => r.id === scopeId);
    return realm ? `${realm.name} forum` : "A realm forum";
  }
  const category = context.categories.find((c) => c.id === scopeId);
  return category ? categoryLabel(category) : "A category";
}

/**
 * Refreshes every console list and the context after a change: one action often changes another tab's list
 * (overturning an appeal lifts the ban, lifting a ban moots its appeal, a warning can raise an automatic ban).
 */
export function useModRefresh(): () => Promise<void> {
  const utils = api.useUtils();
  return useCallback(() => utils.thinkpagesForumMod.invalidate(), [utils]);
}

type AppealStatus = NonNullable<
  RouterOutputs["thinkpagesForumMod"]["bans"]["rows"][number]["appealStatus"]
>;

const APPEAL_COPY: Record<AppealStatus, string> = {
  open: "Appeal open",
  upheld: "Appeal upheld",
  overturned: "Appeal overturned",
  moot: "Appeal closed, it had already ended",
};

/** A warning's or ban's appeal, as a badge; nothing when it was not appealed. */
export function AppealBadge({ status }: { status: AppealStatus | null }) {
  return status ? (
    <Badge variant={status === "open" ? "info" : "default"}>{APPEAL_COPY[status]}</Badge>
  ) : null;
}

/** Runs a filter change and drops `?page=`, so a new filter starts on its first page. */
export function useFilterChange(basePath: string, page: number): (apply: () => void) => void {
  const router = useRouter();
  return (apply) => {
    apply();
    if (page > 1) router.replace(basePath);
  };
}

/** The item column, then a "When" column from md up; below md the time sits at the row's end. */
const COLUMNS = "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_6rem]";

interface ModRowProps {
  title: ReactNode;
  /** Short facts under the title, each its own span. */
  meta?: ReadonlyArray<ReactNode>;
  /** When it happened, as a relative time; its own cell. */
  when: string;
  children?: ReactNode;
  actions?: ReactNode;
}

/** One row of a console table: the item cell (title, facts, body, actions) and the time cell. */
export function ModRow({ title, meta = [], when, children, actions }: ModRowProps) {
  const facts = meta.filter((fact) => fact !== null && fact !== false && fact !== "");
  return (
    <div
      role="row"
      className={cn(
        "hover:bg-fill-4 grid items-start gap-x-3 px-5 py-3 pointer-coarse:min-h-11",
        COLUMNS
      )}
    >
      <div role="cell" className="min-w-0 space-y-1.5">
        <div className="text-headline text-label flex flex-wrap items-center gap-2 break-words">
          {title}
        </div>
        {facts.length > 0 ? (
          <p className="text-footnote text-label-secondary flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums">
            {facts.map((fact, i) => (
              <span key={i}>{fact}</span>
            ))}
          </p>
        ) : null}
        {children}
        {actions ? <div className="flex flex-wrap gap-2 pt-1">{actions}</div> : null}
      </div>
      <div
        role="cell"
        className="text-footnote text-label-secondary text-right tabular-nums md:pt-0.5"
      >
        {when}
      </div>
    </div>
  );
}

interface ListQuery {
  isLoading: boolean;
  error: { message: string } | null;
  refetch?: () => void;
}

interface ModPanelProps {
  /** The table's accessible name. */
  label: string;
  /** The item column's header: "Report", "Ban", ... */
  column: string;
  toolbar?: ReactNode;
  query: ListQuery;
  rowCount: number;
  emptyTitle: string;
  /** With `total`, page links under the list. */
  paging?: { total: number | undefined; perPage: number; page: number; basePath: string };
  children: ReactNode;
}

/** A console panel: its filters, then a data pane table of rows (or loading, failure, empty), then page links. */
export function ModPanel({
  label,
  column,
  toolbar,
  query,
  rowCount,
  emptyTitle,
  paging,
  children,
}: ModPanelProps) {
  const totalPages = paging ? pageCount(paging.total ?? 0, paging.perPage) : 1;
  // A page past the end (its last row just went, or a typed ?page=) moves to the last page.
  const redirecting = useLastPageRedirect(
    paging?.basePath ?? "",
    paging?.page ?? 1,
    paging?.total,
    totalPages
  );
  const body = (() => {
    if (query.isLoading || redirecting) return <Skeleton className="h-40 w-full" />;
    if (query.error) {
      return (
        <EmptyState
          compact
          title="Could not load this list"
          message={query.error.message}
          action={
            query.refetch ? (
              <Button variant="secondary" onClick={() => query.refetch?.()}>
                Retry
              </Button>
            ) : null
          }
        />
      );
    }
    if (rowCount === 0) return <EmptyState compact title={emptyTitle} />;
    return (
      <div role="table" aria-label={label}>
        <div
          role="row"
          className={cn(
            "text-footnote text-label-secondary border-separator grid items-center gap-x-3 border-b px-5 py-2 max-md:sr-only",
            COLUMNS
          )}
        >
          <span role="columnheader">{column}</span>
          <span role="columnheader" className="text-right">
            When
          </span>
        </div>
        <div role="rowgroup" className="divide-separator divide-y">
          {children}
        </div>
      </div>
    );
  })();
  return (
    <div className="space-y-3">
      {toolbar ? <div className="flex flex-wrap items-center gap-3">{toolbar}</div> : null}
      <Card content="data" className="overflow-hidden py-1">
        {body}
      </Card>
      {paging && paging.total !== undefined ? (
        <Pagination
          page={paging.page}
          last={totalPages}
          hrefFor={(n) => pageHref(paging.basePath, n)}
        />
      ) : null}
    </div>
  );
}

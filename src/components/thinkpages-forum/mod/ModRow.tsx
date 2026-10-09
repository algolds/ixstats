"use client";

import { useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { pageCount } from "~/lib/thinkpages-forum/paging";
import { api, type RouterOutputs } from "~/trpc/react";
import { Pagination } from "../Pagination";

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

/** "Caphiria / Hub" for a realm category, "General" for a sitewide one. */
export function categoryLabel(category: { name: string; realm: { name: string } | null }): string {
  return category.realm ? `${category.realm.name} / ${category.name}` : category.name;
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

type ModList = "reports" | "warnings" | "bans" | "appeals" | "log" | "categoryModerators";

/** Refreshes a panel's list and the console context after a change. */
export function useModRefresh(list: ModList): () => Promise<void> {
  const utils = api.useUtils();
  return useCallback(async () => {
    await Promise.all([
      utils.thinkpagesForumMod[list].invalidate(),
      utils.thinkpagesForumMod.context.invalidate(),
    ]);
  }, [utils, list]);
}

/** Runs a filter change and drops `?page=`, so a new filter starts on its first page. */
export function useFilterChange(basePath: string, page: number): (apply: () => void) => void {
  const router = useRouter();
  return (apply) => {
    apply();
    if (page > 1) router.replace(basePath);
  };
}

interface ModRowProps {
  title: ReactNode;
  /** Short facts under the title, each its own span. */
  meta?: ReadonlyArray<ReactNode>;
  children?: ReactNode;
  actions?: ReactNode;
}

/** One row of a console list: a title line, facts, the body, then the row's actions. */
export function ModRow({ title, meta = [], children, actions }: ModRowProps) {
  const facts = meta.filter((fact) => fact !== null && fact !== false && fact !== "");
  return (
    <li className="space-y-1.5 px-4 py-3">
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
    </li>
  );
}

interface ListQuery {
  isLoading: boolean;
  error: { message: string } | null;
  refetch?: () => unknown;
}

interface ModPanelProps {
  content: "feed" | "data";
  /** The list's accessible name. */
  label: string;
  toolbar?: ReactNode;
  query: ListQuery;
  rowCount: number;
  emptyTitle: string;
  /** With `total`, page links under the list. */
  paging?: { total: number | undefined; perPage: number; page: number; basePath: string };
  children: ReactNode;
}

/** A console panel: its filters, then a card of rows (or loading, failure, empty), then page links. */
export function ModPanel({
  content,
  label,
  toolbar,
  query,
  rowCount,
  emptyTitle,
  paging,
  children,
}: ModPanelProps) {
  const body = (() => {
    if (query.isLoading) return <Skeleton className="h-40 w-full" />;
    if (query.error) {
      return (
        <EmptyState
          compact
          title="Could not load this list"
          message={query.error.message}
          action={
            query.refetch ? (
              <Button variant="secondary" onClick={() => void query.refetch?.()}>
                Retry
              </Button>
            ) : null
          }
        />
      );
    }
    if (rowCount === 0) return <EmptyState compact title={emptyTitle} />;
    return (
      <ul aria-label={label} className="divide-separator divide-y">
        {children}
      </ul>
    );
  })();
  return (
    <div className="space-y-3">
      {toolbar ? <div className="flex flex-wrap items-center gap-3">{toolbar}</div> : null}
      <Card content={content} className="overflow-hidden">
        {body}
      </Card>
      {paging && paging.total !== undefined ? (
        <Pagination
          basePath={paging.basePath}
          page={paging.page}
          totalPages={pageCount(paging.total, paging.perPage)}
        />
      ) : null}
    </div>
  );
}

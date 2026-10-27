"use client";
// src/app/admin/wikios-settings/ConflictLogSection.tsx
// The conflict log: every collision between WikiOS and classic MediaWiki, newest first. Each row shows the page, the
// change that was kept and on which wiki (with its trail), what it overwrote and by whom, who was told on which channel
// (and any notice that could not be delivered), and whether the settling is done. Old parks are history only: nobody was told of them.

import { GitMerge } from "iconoir-react";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { api, type RouterOutputs } from "~/trpc/react";

const PAGE_SIZE = 25;

type ConflictRow = RouterOutputs["wikios"]["listConflicts"]["items"][number];
type ShownChange = ConflictRow["winner"];

const WIKIS: Record<ShownChange["side"], string> = {
  wikios: "WikiOS",
  classic: "classic MediaWiki",
};

const CHANNELS: Record<ConflictRow["notices"][number]["channel"], string> = {
  "in-app": "in-app",
  discord: "Discord DM",
  "talk-page": "talk page",
};

const STATES: Record<ConflictRow["state"], string> = {
  legacy: "old park, nobody told",
  settled: "settled",
  pending: "pending",
};

const STATE_VARIANTS: Record<ConflictRow["state"], BadgeVariant> = {
  legacy: "outline",
  settled: "success",
  pending: "warning",
};

/** "revision 140 by alpha, on WikiOS". */
function changeText(change: ShownChange): string {
  const by = change.author ? ` by ${change.author}` : "";
  return `${change.label}${by}, on ${WIKIS[change.side]}`;
}

function ConflictLogRowView({ row }: { row: ConflictRow }) {
  return (
    <tr className="align-top">
      <td className="text-label-secondary px-2 py-1.5 whitespace-nowrap">
        {new Date(row.createdAt).toLocaleString()}
        <div className="font-mono">{row.shortId}</div>
      </td>
      <td className="text-label px-2 py-1.5 font-medium">{row.title}</td>
      <td className="px-2 py-1.5">
        <div className="text-label">{row.winner.label}</div>
        <div className="text-label-secondary">on {WIKIS[row.winner.side]}</div>
        {row.trail && <div className="text-label-secondary">Trail: {row.trail}</div>}
      </td>
      <td className="px-2 py-1.5">
        <ul className="space-y-0.5">
          {row.overwritten.map((change) => (
            <li key={change.ref}>{changeText(change)}</li>
          ))}
        </ul>
      </td>
      <td className="text-label-secondary px-2 py-1.5">
        <ul className="space-y-0.5">
          {row.notices.map((notice) => (
            <li key={`${notice.who}/${notice.channel}`}>
              {notice.who}, {CHANNELS[notice.channel]}
              {notice.undelivered && <div className="text-destructive">{notice.undelivered}</div>}
            </li>
          ))}
        </ul>
      </td>
      <td className="px-2 py-1.5">
        <Badge variant={STATE_VARIANTS[row.state]}>{STATES[row.state]}</Badge>
      </td>
    </tr>
  );
}

export function ConflictLogSection() {
  const conflicts = api.wikios.listConflicts.useInfiniteQuery(
    { limit: PAGE_SIZE },
    { getNextPageParam: (last) => last.nextCursor }
  );
  const rows = conflicts.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Card padding="lg" className="space-y-4">
      <div className="border-separator flex items-center gap-2 border-b pb-3">
        <GitMerge className="text-tint h-4 w-4" />
        <div>
          <h3 className="text-label text-caption">Conflict log</h3>
          <p className="text-label-secondary text-footnote">
            Every save one wiki overwrote on the other: the change that was kept, what it replaced,
            and who was told
          </p>
        </div>
      </div>

      {conflicts.isLoading ? (
        <Skeleton className="rounded-row h-16 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-label-secondary text-footnote">
          No conflicts: the two wikis have not overwritten each other.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-footnote w-full text-left">
            <thead className="text-label-secondary">
              <tr>
                <th className="px-2 py-1 font-medium">When</th>
                <th className="px-2 py-1 font-medium">Page</th>
                <th className="px-2 py-1 font-medium">Kept</th>
                <th className="px-2 py-1 font-medium">Overwritten</th>
                <th className="px-2 py-1 font-medium">Told</th>
                <th className="px-2 py-1 font-medium">State</th>
              </tr>
            </thead>
            <tbody className="divide-separator divide-y">
              {rows.map((row) => (
                <ConflictLogRowView key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {conflicts.hasNextPage && (
        <Button
          variant="secondary"
          size="sm"
          disabled={conflicts.isFetchingNextPage}
          onClick={() => void conflicts.fetchNextPage()}
        >
          Load older conflicts
        </Button>
      )}
    </Card>
  );
}

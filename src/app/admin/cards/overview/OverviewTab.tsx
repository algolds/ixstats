"use client";
/** Overview: card counts by type, rarity and realm, what waits on an admin, and the card-only activity feed. */
import { Activity, Clock, Database, Download, WarningTriangle } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Stat } from "~/components/ui/stat";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { CARD_TYPE_LABELS, RARITY_LABELS, labelOf } from "../shared/card-labels";

const REFRESH_MS = 30_000;

interface BreakdownRow {
  key: string;
  label: string;
  count: number;
}

interface FeedItem {
  id: string;
  at: Date;
  title: string;
  detail: string | null;
  ok: boolean;
}

/** A count, or "–" until it has loaded. */
const figure = (value: number | undefined) => (value === undefined ? "–" : value.toLocaleString());

function Breakdown({
  title,
  column,
  rows,
}: {
  title: string;
  column: string;
  rows: BreakdownRow[];
}) {
  return (
    <Card content="data">
      <CardHeader className="pt-5">
        <CardTitle icon={<Database />}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pb-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{column}</TableHead>
              <TableHead className="text-right">Cards</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.count.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ActivityFeed({ items }: { items: FeedItem[] | undefined }) {
  if (!items) return null;
  if (items.length === 0) {
    return (
      <EmptyState
        compact
        title="No card activity yet"
        message="Imports, reviews and admin actions show here."
      />
    );
  }
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-callout text-label">{item.title}</p>
            {item.detail && (
              <p className="text-footnote text-label-secondary truncate">{item.detail}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!item.ok && <Badge variant="destructive">Failed</Badge>}
            <time
              className="text-caption text-label-secondary"
              dateTime={new Date(item.at).toISOString()}
            >
              {new Date(item.at).toLocaleString()}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function OverviewTab() {
  const summary = api.cards.admin.overview.summary.useQuery(undefined, {
    refetchInterval: REFRESH_MS,
  });
  const activity = api.cards.admin.overview.activity.useQuery(
    { limit: 50 },
    { refetchInterval: REFRESH_MS }
  );
  const data = summary.data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card padding="md">
          <Stat label="Cards" value={figure(data?.total)} icon={<Database />} />
        </Card>
        <Card padding="md">
          <Stat label="Waiting for review" value={figure(data?.pendingReview)} icon={<Clock />} />
        </Card>
        <Card padding="md">
          <Stat label="Imports running" value={figure(data?.activeJobs)} icon={<Download />} />
        </Card>
        <Card padding="md">
          <Stat
            label="Open takedowns"
            value={figure(data?.openTakedowns)}
            icon={<WarningTriangle />}
            hint={data?.overdueTakedowns ? `${data.overdueTakedowns} overdue` : undefined}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Breakdown
          title="By type"
          column="Type"
          rows={(data?.byType ?? []).map((row) => ({
            ...row,
            label: labelOf(CARD_TYPE_LABELS, row.key),
          }))}
        />
        <Breakdown
          title="By rarity"
          column="Rarity"
          rows={(data?.byRarity ?? []).map((row) => ({
            ...row,
            label: labelOf(RARITY_LABELS, row.key),
          }))}
        />
        <Breakdown title="By realm" column="Realm" rows={data?.byRealm ?? []} />
      </div>

      <Card content="feed">
        <CardHeader className="pt-5">
          <CardTitle icon={<Activity />}>Card activity</CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <ActivityFeed items={activity.data} />
        </CardContent>
      </Card>
    </div>
  );
}

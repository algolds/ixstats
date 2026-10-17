"use client";
/**
 * Overview: card counts by type, rarity and realm, what waits on an admin, and the card-only activity feed, each item
 * with who acted.
 */
import { Activity, Clock, Database, Download, WarningTriangle } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
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
import { useRelativeTime } from "~/hooks/useRelativeTime";
import { CARD_TYPE_LABELS, RARITY_LABELS, labelOf } from "../shared/card-labels";
import { feedDetail } from "./feed-detail";

const REFRESH_MS = 30_000;

type Summary = RouterOutputs["cards"]["admin"]["overview"]["summary"];
type FeedItem = RouterOutputs["cards"]["admin"]["overview"]["activity"][number];

interface BreakdownRow {
  key: string;
  label: string;
  count: number;
}

/** A count, or "–" until it has loaded. */
const figure = (value: number | undefined) => (value === undefined ? "–" : value.toLocaleString());

/** What shows instead of a section whose query failed; the poll keeps retrying it. */
function LoadError({ what }: { what: string }) {
  return (
    <p role="alert" className="text-destructive text-footnote">
      {what} did not load. Retrying every {REFRESH_MS / 1000} seconds.
    </p>
  );
}

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

/** How long ago, kept fresh by the minute; the exact time is in the tooltip. */
function FeedTime({ at }: { at: Date }) {
  const ago = useRelativeTime(at);
  const when = new Date(at);
  return (
    <time
      className="text-caption text-label-secondary"
      dateTime={when.toISOString()}
      title={when.toLocaleString()}
    >
      {ago}
    </time>
  );
}

function ActivityFeed({ items, failed }: { items: FeedItem[] | undefined; failed: boolean }) {
  if (!items) return failed ? <LoadError what="Card activity" /> : null;
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
    <ul data-content="feed">
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-callout text-label">
              {item.subject ? `${item.title}: ${item.subject}` : item.title}
            </p>
            {item.detail && (
              <p className="text-footnote text-label-secondary truncate">
                {feedDetail(item.detail)}
              </p>
            )}
            <p className="text-caption text-label-secondary">{item.actor}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!item.ok && <Badge variant="destructive">Failed</Badge>}
            <FeedTime at={item.at} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function SummarySection({ data, failed }: { data: Summary | undefined; failed: boolean }) {
  if (!data && failed) return <LoadError what="Card counts" />;
  return (
    <>
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
    </>
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

  return (
    <div className="space-y-6">
      <SummarySection data={summary.data} failed={summary.isError} />

      <Card content="feed">
        <CardHeader className="pt-5">
          <CardTitle icon={<Activity />}>Card activity</CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <ActivityFeed items={activity.data} failed={activity.isError} />
        </CardContent>
      </Card>
    </div>
  );
}

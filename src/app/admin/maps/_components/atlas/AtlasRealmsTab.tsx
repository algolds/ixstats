"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavArrowDown, NavArrowUp } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ValueSelect } from "~/components/ui/value-select";
import { timeAgo } from "~/lib/format/compact";
import { jobLabel, STATUS_LABELS, statusTone } from "./job-labels";
import { RealmFlags } from "./RealmFlags";
import {
  DEFAULT_VIEW,
  reliefLabel,
  viewRealms,
  type RealmRow,
  type RealmsView,
  type SortKey,
} from "./realms-view";

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "name", label: "Realm" },
  { key: "layers", label: "Layers" },
  { key: "relief", label: "Relief" },
  { key: "linkage", label: "Linkage" },
  { key: "nations", label: "Nations" },
  { key: "claims", label: "Pending claims" },
  { key: "lastJob", label: "Last job" },
  { key: "flags", label: "Problems" },
];

export const realmHref = (slug: string) => `/admin/maps/realms/${encodeURIComponent(slug)}`;

function SortHeader({
  column,
  view,
  onSort,
}: {
  column: { key: SortKey; label: string };
  view: RealmsView;
  onSort: (key: SortKey) => void;
}) {
  const active = view.sort.key === column.key;
  const Arrow = view.sort.direction === "asc" ? NavArrowUp : NavArrowDown;
  return (
    <TableHead
      aria-sort={active ? (view.sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className="rounded-control focus-visible:outline-tint inline-flex items-center gap-1 focus-visible:outline-2"
      >
        {column.label}
        {active && <Arrow aria-hidden className="size-3.5" />}
      </button>
    </TableHead>
  );
}

function RealmTableRow({ row }: { row: RealmRow }) {
  const router = useRouter();
  const { nations, linkage, layers, lastJob } = row;
  return (
    <TableRow className="cursor-pointer" onClick={() => router.push(realmHref(row.slug))}>
      <TableCell>
        <Link
          href={realmHref(row.slug)}
          onClick={(event) => event.stopPropagation()}
          className="text-label focus-visible:outline-tint font-medium focus-visible:outline-2"
        >
          {row.name}
        </Link>
        <Badge className="ml-2">{row.status}</Badge>
      </TableCell>
      <TableCell>
        {layers.present} of {layers.total}
      </TableCell>
      <TableCell>{reliefLabel(row.relief)}</TableCell>
      <TableCell>
        {linkage.linked} of {linkage.total}
      </TableCell>
      <TableCell>
        {nations.total}
        <p className="text-label-secondary text-footnote">
          {nations.owned} owned, {nations.open} open, {nations.reserved} reserved
        </p>
      </TableCell>
      <TableCell>{row.pendingClaims}</TableCell>
      <TableCell>
        {lastJob ? (
          <>
            {jobLabel(lastJob)}
            <p className="text-footnote">
              <Badge variant={statusTone(lastJob.status)}>
                {STATUS_LABELS[lastJob.status] ?? lastJob.status}
              </Badge>{" "}
              <span className="text-label-secondary">{timeAgo(lastJob.at)}</span>
            </p>
          </>
        ) : (
          <span className="text-label-secondary">None</span>
        )}
      </TableCell>
      <TableCell>
        <RealmFlags row={row} />
      </TableCell>
    </TableRow>
  );
}

/** One row per realm with its map figures and problem chips; sortable, filterable, and each row opens the realm page. */
export function AtlasRealmsTab() {
  const { data, isLoading, error } = api.atlas.realms.overview.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [view, setView] = useState<RealmsView>(DEFAULT_VIEW);

  if (isLoading) return <Skeleton className="rounded-card h-64 w-full" />;
  if (!data) {
    return (
      <p className="text-label-secondary text-body">
        {error?.message ?? "Realms could not be read."}
      </p>
    );
  }

  const statuses = [...new Set(data.realms.map((row) => row.status))].sort();
  const rows = viewRealms(data.realms, view);
  const sortBy = (key: SortKey) =>
    setView((prev) => ({
      ...prev,
      sort: {
        key,
        direction: prev.sort.key === key && prev.sort.direction === "asc" ? "desc" : "asc",
      },
    }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <ValueSelect
          aria-label="Realm status"
          value={view.status}
          onValueChange={(status) => setView((prev) => ({ ...prev, status }))}
          options={[
            ["all", "All statuses"],
            ...statuses.map((status) => [status, status] as const),
          ]}
          className="w-44"
        />
        <div className="flex items-center gap-2">
          <Switch
            id="atlas-problems-only"
            checked={view.problemsOnly}
            onCheckedChange={(problemsOnly) => setView((prev) => ({ ...prev, problemsOnly }))}
          />
          <Label htmlFor="atlas-problems-only">Has problems</Label>
        </div>
      </div>
      {data.partial && (
        <p className="text-label-secondary text-footnote">
          The relief folders were not all checked in time. Realms marked unknown were left out of
          the check.
        </p>
      )}
      <Card content="data">
        {rows.length === 0 ? (
          <EmptyState compact title="No realms match" message="Change the filters to see more." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((column) => (
                  <SortHeader key={column.key} column={column} view={view} onSort={sortBy} />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <RealmTableRow key={row.id} row={row} />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

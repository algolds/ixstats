import type { RouterOutputs } from "~/trpc/react";

export type RealmRow = RouterOutputs["atlas"]["realms"]["overview"]["realms"][number];
export type RealmFlag = RealmRow["flags"][number];

export type SortKey =
  "name" | "layers" | "relief" | "linkage" | "nations" | "claims" | "lastJob" | "flags";
export type SortDirection = "asc" | "desc";

export interface RealmsView {
  sort: { key: SortKey; direction: SortDirection };
  /** A realm status, or "all" */
  status: string;
  problemsOnly: boolean;
}

export const DEFAULT_VIEW: RealmsView = {
  sort: { key: "name", direction: "asc" },
  status: "all",
  problemsOnly: false,
};

const FLAG_LABELS: Record<RealmFlag, string> = {
  "missing-layers": "Missing layers",
  relief: "Relief",
  "last-job-failed": "Last job failed",
  unlinked: "Unlinked features",
  "invalid-geometry": "Invalid geometry",
};

/** A chip's text; the relief chip says which way the relief is wrong. */
export function flagLabel(flag: RealmFlag, row: Pick<RealmRow, "relief">): string {
  return flag === "relief" ? `Relief ${row.relief}` : FLAG_LABELS[flag];
}

const RELIEF_LABELS: Record<RealmRow["relief"], string> = {
  built: "Built",
  missing: "Missing",
  failed: "Failed",
  unknown: "Unknown",
};

export const reliefLabel = (relief: RealmRow["relief"]) => RELIEF_LABELS[relief];

const share = ({ linked, total }: RealmRow["linkage"]) => (total === 0 ? 0 : linked / total);

const SORT_VALUE: Record<SortKey, (row: RealmRow) => string | number> = {
  name: (row) => row.name.toLowerCase(),
  layers: (row) => row.layers.present,
  relief: (row) => row.relief,
  linkage: (row) => share(row.linkage),
  nations: (row) => row.nations.total,
  claims: (row) => row.pendingClaims,
  lastJob: (row) => (row.lastJob ? row.lastJob.at.getTime() : 0),
  flags: (row) => row.flags.length,
};

/** The rows that pass the filters, in the chosen order (ties keep the name order). */
export function viewRealms(rows: readonly RealmRow[], view: RealmsView): RealmRow[] {
  const read = SORT_VALUE[view.sort.key];
  const sign = view.sort.direction === "asc" ? 1 : -1;
  return rows
    .filter((row) => view.status === "all" || row.status === view.status)
    .filter((row) => !view.problemsOnly || row.flags.length > 0)
    .sort((a, b) => {
      const left = read(a);
      const right = read(b);
      if (left === right) return a.name.localeCompare(b.name);
      return (left < right ? -1 : 1) * sign;
    });
}

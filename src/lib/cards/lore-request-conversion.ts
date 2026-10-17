/**
 * Old paid lore requests become free suggestions, with NO refund: a PENDING request stays PENDING, an APPROVED one
 * (paid, never made) goes back to PENDING, and every open one gets its home realm. Generated and rejected requests
 * stay as history.
 */
export interface RequestRow {
  id: string;
  status: string;
  userId: string;
  articleTitle: string;
  wikiSource: string;
  realmId: string | null;
}

export interface ConversionPlan {
  /** APPROVED requests to set back to PENDING. */
  reopen: string[];
  /** Open requests with no realm yet. */
  home: RequestRow[];
  byStatus: Record<string, number>;
}

export function planRequestConversion(rows: readonly RequestRow[]): ConversionPlan {
  const byStatus: Record<string, number> = {};
  for (const row of rows) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  const open = rows.filter((row) => row.status === "PENDING" || row.status === "APPROVED");
  return {
    reopen: open.filter((row) => row.status === "APPROVED").map((row) => row.id),
    home: open.filter((row) => row.realmId === null),
    byStatus,
  };
}

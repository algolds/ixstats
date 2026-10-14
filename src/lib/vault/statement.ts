import type { Prisma } from "@prisma/client";
import { sentenceCase } from "~/lib/format/sentence-case";
import { activitySourceLabel } from "./activity-labels";
import { parseDividendMetadata, utcDay, type DividendLine } from "./vault-dividend";

export interface StatementRow {
  id: string;
  createdAt: Date;
  /** Signed: credits in are positive, spends negative. */
  credits: number;
  balanceAfter: number;
  type: string;
  source: string;
  /** Usually a JSON string at runtime (the ledger stringifies it), sometimes an object. */
  metadata: Prisma.JsonValue | null;
}

export interface StatementDay {
  /** `yyyy-mm-dd`, a UTC day. */
  key: string;
  /** "Today", "Yesterday" or "14 October" (with the year outside the current one). */
  label: string;
  rows: StatementRow[];
}

export interface RowDescription {
  title: string;
  detail?: string;
  href?: string;
  /** The stored breakdown of a Vault dividend row. */
  lines?: DividendLine[];
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_MS = 86_400_000;

/** "14 October" for a `yyyy-mm-dd` day. */
function formatDay(day: string): string {
  const [, month, date] = day.split("-").map(Number);
  return `${date} ${MONTHS[(month ?? 1) - 1]}`;
}

function dayLabel(day: string, now: Date): string {
  const today = utcDay(now);
  if (day === today) return "Today";
  if (day === utcDay(new Date(Date.parse(`${today}T00:00:00.000Z`) - DAY_MS))) return "Yesterday";
  // The year only when it is not the current one (all UTC, like the dividend's days).
  return day.startsWith(`${now.getUTCFullYear()}-`)
    ? formatDay(day)
    : `${formatDay(day)} ${day.slice(0, 4)}`;
}

/** Groups newest-first rows by UTC day, keeping the order they came in. */
export function groupStatement(rows: StatementRow[], now: Date): StatementDay[] {
  const days = new Map<string, StatementDay>();
  for (const row of rows) {
    const key = utcDay(new Date(row.createdAt));
    const day = days.get(key) ?? { key, label: dayLabel(key, now), rows: [] };
    day.rows.push(row);
    days.set(key, day);
  }
  return [...days.values()];
}

type MetadataRecord = Record<string, Prisma.JsonValue | undefined>;

/** The object a row's metadata holds, reading a JSON string first; null for anything else. */
function metadataRecord(raw: Prisma.JsonValue | null): MetadataRecord | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as Prisma.JsonValue;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}

function text(record: MetadataRecord | null, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

const LOREWARD_SOURCE = "bonus:loreward:";
const ACHIEVEMENT_SOURCE = "bonus:achievement:";

function describeLoreward(source: string, metadata: MetadataRecord | null): RowDescription {
  const placed = text(metadata, "place");
  const place =
    placed === "winner" || placed === "runner-up"
      ? placed
      : source.endsWith(":runner-up")
        ? "runner-up"
        : "winner";
  const contest = text(metadata, "type");
  const page = text(metadata, "page");
  const date = text(metadata, "date");
  return {
    title: `Loreward: ${contest ? `${contest} ` : ""}${place}`,
    detail: page && date ? `${page} on ${date}` : (page ?? date),
    href: "/vault/achievements?tab=lorewards",
  };
}

function describeAchievement(source: string, metadata: MetadataRecord | null): RowDescription {
  const key = text(metadata, "achievementId") ?? source.slice(ACHIEVEMENT_SOURCE.length);
  const name = text(metadata, "achievementName") ?? sentenceCase(key);
  return {
    title: `Achievement: ${name}`,
    href: `/vault/achievements?a=${encodeURIComponent(key)}`,
  };
}

/** What a statement row says about itself: a title, a detail line, a link and (dividends) its lines. */
export function describeRow(row: StatementRow): RowDescription {
  const { source } = row;
  if (source === "VAULT_DIVIDEND") {
    const dividend = parseDividendMetadata(row.metadata);
    if (!dividend) return { title: activitySourceLabel(source) };
    return {
      title: activitySourceLabel(source),
      detail: `For ${formatDay(dividend.day)}`,
      lines: dividend.lines,
    };
  }
  if (source.startsWith(LOREWARD_SOURCE)) {
    return describeLoreward(source, metadataRecord(row.metadata));
  }
  if (source.startsWith(ACHIEVEMENT_SOURCE)) {
    return describeAchievement(source, metadataRecord(row.metadata));
  }
  return { title: activitySourceLabel(source) };
}

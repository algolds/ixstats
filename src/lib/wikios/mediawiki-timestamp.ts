// src/lib/wikios/mediawiki-timestamp.ts
// Parse MediaWiki timestamps (YYYYMMDDHHmmss) to ISO strings and Date objects.

/**
 * Parse a MediaWiki timestamp string (YYYYMMDDHHmmss) to an ISO 8601 string.
 * Returns null if the format is invalid.
 *
 * Examples:
 *   "20260328202033" -> "2026-03-28T20:20:33Z"
 *   "20251114023500" -> "2025-11-14T02:35:00Z"
 */
export function parseMWTimestamp(ts: string | number | null | undefined): string | null {
  if (!ts) return null;

  const s = String(ts);

  // Already ISO format (contains T or -)
  if (s.includes("T") || s.includes("-")) return s;

  // Must be exactly 14 digits
  if (!/^\d{14}$/.test(s)) return null;

  const year = s.slice(0, 4);
  const month = s.slice(4, 6);
  const day = s.slice(6, 8);
  const hour = s.slice(8, 10);
  const min = s.slice(10, 12);
  const sec = s.slice(12, 14);

  return `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
}

/**
 * Format a MediaWiki timestamp as a human-readable "time ago" string.
 */
export function formatMWTimeAgo(ts: string | number | null | undefined): string {
  const iso = parseMWTimestamp(ts);
  if (!iso) return "";

  const now = Date.now();
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";

  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Format a MediaWiki timestamp as a locale date string.
 */
export function formatMWDate(ts: string | number | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  const iso = parseMWTimestamp(ts);
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", options ?? {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

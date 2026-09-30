/**
 * timestamp.ts — MediaWiki 14-Digit Timestamp Converter
 *
 * MediaWiki stores revision timestamps in a compact 14-character string:
 * `YYYYMMDDhhmmss` (e.g., "20260228143000").
 * This module converts between MediaWiki 14-digit format, ISO 8601, and Date objects.
 */

/**
 * Parses a MediaWiki timestamp string or ISO string into an ISO 8601 string, or null if invalid.
 */
export function parseMWTimestamp(timestamp: string | Date | null | undefined): string | null {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp.toISOString();

  const trimmed = timestamp.trim();
  if (!trimmed) return null;

  // Handle 14-digit MediaWiki format: YYYYMMDDhhmmss
  if (/^\d{14}$/.test(trimmed)) {
    const year = trimmed.substring(0, 4);
    const month = trimmed.substring(4, 6);
    const day = trimmed.substring(6, 8);
    const hour = trimmed.substring(8, 10);
    const minute = trimmed.substring(10, 12);
    const second = trimmed.substring(12, 14);

    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  }

  // If already an ISO string or Date-parseable string
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;

  return d.toISOString();
}

/**
 * Parses a MediaWiki or ISO timestamp into a JavaScript Date object, or null if invalid.
 */
export function parseMWDateObject(timestamp: string | Date | null | undefined): Date | null {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return isNaN(timestamp.getTime()) ? null : timestamp;

  const iso = parseMWTimestamp(timestamp);
  if (!iso) return null;

  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a MediaWiki timestamp as a localized date string.
 */
export function formatMWDate(
  timestamp: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = parseMWDateObject(timestamp);
  if (!d) return "";

  return d.toLocaleDateString(
    undefined,
    options ?? {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
}

/**
 * Formats a MediaWiki timestamp as relative human-readable time ("5m ago", "2d ago").
 */
export function formatMWTimeAgo(timestamp: string | Date | null | undefined): string {
  const d = parseMWDateObject(timestamp);
  if (!d) return "";

  const now = Date.now();
  const diffMs = now - d.getTime();

  if (diffMs < 0) return "just now";

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

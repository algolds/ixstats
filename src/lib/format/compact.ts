/**
 * Format a number into a compact representation (e.g. 1.5B, 23.4M, 7.8T).
 */
export function formatCompact(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  return (num ?? 0).toLocaleString();
}

/**
 * Format a timestamp as a relative time string: "just now", "5m ago", "2h ago", "3d ago",
 * then a short date after 30 days. `{ suffix: false }` drops " ago" for compact list rows.
 *
 * The single relative-time formatter in the codebase (13 hand-rolled copies were folded
 * into it on 2026-09-25, plan 345). Accepts a Date, ISO string or epoch milliseconds.
 */
export function timeAgo(input: Date | string | number, opts: { suffix?: boolean } = {}): string {
  const date = input instanceof Date ? input : new Date(input);
  const diffMs = Date.now() - date.getTime();
  if (!Number.isFinite(diffMs)) return "";
  const suffix = opts.suffix === false ? "" : " ago";
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m${suffix}`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h${suffix}`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d${suffix}`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

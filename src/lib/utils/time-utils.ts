/**
 * Shared time formatting utilities.
 */

/**
 * Format a Date as a human-readable relative time string.
 * e.g. "just now", "5m ago", "3h ago", "2d ago"
 */
export function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  // For older items, show the actual date
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

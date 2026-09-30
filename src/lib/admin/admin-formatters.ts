// src/lib/admin/admin-formatters.ts
/**
 * Shared status and formatting helpers for Admin UI panels.
 */

export function getJobStatusBadgeColor(status: string): string {
  switch (status.toUpperCase()) {
    case "COMPLETED":
    case "SUCCESS":
      return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30";
    case "IN_PROGRESS":
    case "RUNNING":
      return "text-blue-600 dark:text-blue-400 bg-blue-500/15 border border-blue-500/30";
    case "PAUSED":
    case "WARNING":
      return "text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30";
    case "FAILED":
    case "ERROR":
      return "text-rose-600 dark:text-rose-400 bg-rose-500/15 border border-rose-500/30";
    default:
      return "text-muted-foreground bg-muted border border-border";
  }
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (!ms || ms < 0) return "N/A";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// src/lib/admin/admin-formatters.ts
/**
 * Shared formatting helpers for Admin UI panels. (Status colours come from `Badge` variants.)
 */

export function formatDurationMs(ms: number | null | undefined): string {
  if (!ms || ms < 0) return "N/A";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

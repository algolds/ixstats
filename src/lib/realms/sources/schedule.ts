/**
 * When a realm's source sync is due: enabled, with an interval, and never run or last run at least
 * `intervalHours` ago. The scheduled job (realm-source-sync) runs whatever is due, one realm at a time.
 */
const HOUR_MS = 60 * 60 * 1000;

export interface SchedulableSync {
  realmId: string;
  enabled: boolean;
  intervalHours: number | null;
  lastRunAt: Date | null;
}

export function isSyncDue(sync: SchedulableSync, now: Date): boolean {
  if (!sync.enabled || !sync.intervalHours || sync.intervalHours < 1) return false;
  if (!sync.lastRunAt) return true;
  return sync.lastRunAt.getTime() + sync.intervalHours * HOUR_MS <= now.getTime();
}

/** The due syncs, longest overdue first (never-run first). */
export function dueSyncs<T extends SchedulableSync>(syncs: readonly T[], now: Date): T[] {
  return syncs
    .filter((sync) => isSyncDue(sync, now))
    .sort((a, b) => (a.lastRunAt?.getTime() ?? 0) - (b.lastRunAt?.getTime() ?? 0));
}

/** When the next scheduled run falls, for the settings page; null when the sync is manual only or off. */
export function nextRunAt(sync: SchedulableSync, now: Date): Date | null {
  if (!sync.enabled || !sync.intervalHours) return null;
  if (!sync.lastRunAt) return now;
  return new Date(sync.lastRunAt.getTime() + sync.intervalHours * HOUR_MS);
}

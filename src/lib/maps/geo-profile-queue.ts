import { timeAgo } from "~/lib/format/compact";

/** What `geoCore.recalculateGeoProfiles` returns: the work queued and when the `geo-profiles` cron job last ran. */
export interface GeoProfileQueued {
  queued: number;
  lastRunAt: Date | null;
}

/**
 * The toast for a queued recalculation. Nothing has been recomputed yet: the `geo-profiles` job does it within its
 * 5-minute schedule, so the admin is told when it last ran, or that no run is recorded (it is not in
 * `CRON_ENABLED_JOBS` and the queue will not drain).
 */
export function describeQueuedGeoProfiles({ queued, lastRunAt }: GeoProfileQueued): string {
  if (queued === 0) return "No country has map geometry to recalculate.";
  const queuedLine = `Queued ${queued} ${queued === 1 ? "country" : "countries"} for recalculation.`;
  if (!lastRunAt) {
    return `${queuedLine} No geo-profiles run is recorded: add geo-profiles to CRON_ENABLED_JOBS so the job runs every 5 minutes.`;
  }
  return `${queuedLine} The geo-profiles job runs every 5 minutes; its last run was ${timeAgo(lastRunAt)}.`;
}

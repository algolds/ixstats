/**
 * mirror-alerts.ts — the Discord warning for mirror jobs that went dead, at most once in 30 minutes.
 *
 * A dead job means classic MediaWiki is out of sync for that title until an administrator acts, so the operators are
 * told. But a MediaWiki outage kills every queued job within the same few cycles, and a flapping job dies again
 * after each requeue: one message per job, or per cycle, would flood the channel. So the warning is one message, at
 * most once in `DEAD_ALERT_INTERVAL_MS`, about every job that went dead since the previous one (found in the outbox
 * itself, so a job that died while a warning was held back is still named by the next one). The time of the last
 * warning is kept in `SystemConfig`, and only once Discord has accepted the message: a webhook that is down or that
 * refuses it leaves that time as it was, so jobs nobody was told of are not held back for 30 minutes. The failed
 * attempt is stamped on its own (`ATTEMPT_KEY`) and the next one waits `ATTEMPT_BACKOFF_MS`, so a dead webhook is tried
 * every few minutes, not in every cycle of the worker (each try can wait out the webhook's 10 s timeout).
 *
 * The same throttle warns when the worker's window is saturated (`alertWindowSaturated`): a full window of jobs that
 * are neither finished nor dead means the mirror is falling behind, at most one message in 30 minutes, with the same
 * 5-minute backoff after a failed delivery, the times kept under their own keys.
 */

import { db } from "~/server/db";
import { discordWebhook } from "~/lib/discord/webhook";
import { MIRROR_SOURCE } from "./mirror-outbox";

export const DEAD_ALERT_INTERVAL_MS = 30 * 60_000;
export const DEAD_ALERT_KEY = "wikiMirror.deadAlertAt";
/** When the last warning was ATTEMPTED and not delivered (a failed delivery does not stamp `DEAD_ALERT_KEY`). */
export const ATTEMPT_KEY = "wikiMirror.deadAlertAttemptAt";
/** After a failed delivery, the next attempt waits this long. */
export const ATTEMPT_BACKOFF_MS = 5 * 60_000;
/** When the last saturated-window warning was delivered. */
export const SATURATION_ALERT_KEY = "wikiMirror.saturationAlertAt";
/** When the last saturated-window warning was ATTEMPTED and not delivered. */
export const SATURATION_ATTEMPT_KEY = "wikiMirror.saturationAlertAttemptAt";
/** Jobs named in the message; the rest are counted. */
const MAX_JOBS_LISTED = 5;
/** Discord's embed description holds 4096 characters; a job's last error can be 2000. */
const LINE_LIMIT = 300;

/** Whether `at` is less than `intervalMs` before `now`. */
const within = (at: Date | null, now: Date, intervalMs: number) =>
  at !== null && now.getTime() - at.getTime() < intervalMs;

/**
 * Whether a warning waits: one was delivered (`last`) less than 30 minutes ago, or the last attempt (`attemptKey`)
 * failed less than 5 minutes ago.
 */
async function heldBack(last: Date | null, attemptKey: string, now: Date): Promise<boolean> {
  if (within(last, now, DEAD_ALERT_INTERVAL_MS)) return true;
  return within(await timeAt(attemptKey), now, ATTEMPT_BACKOFF_MS);
}

async function timeAt(key: string): Promise<Date | null> {
  const row = await db.systemConfig.findUnique({
    where: { key },
    select: { value: true },
  });
  const at = row ? new Date(row.value) : null;
  return at && !Number.isNaN(at.getTime()) ? at : null;
}

const describeJob = (job: { kind: string; title: string; lastError: string | null }) =>
  `${job.kind} ${job.title}: ${job.lastError ?? "(no error recorded)"}`.slice(0, LINE_LIMIT);

const stamp = (key: string, at: Date) =>
  db.systemConfig.upsert({
    where: { key },
    create: { key, value: at.toISOString() },
    update: { value: at.toISOString() },
  });

/**
 * Warn about the jobs that went dead since the last warning, unless one was sent less than 30 minutes ago (they wait
 * for the next one). One job is told as `<kind> <title>: <error>`; several as a count and the newest few. Nothing is
 * looked up when no webhook is configured (there is nobody to tell), and the time of the warning is remembered only
 * when Discord delivered it.
 */
export async function alertDeadJobs(now = new Date()): Promise<void> {
  if (!discordWebhook.isEnabled()) return;
  const last = await timeAt(DEAD_ALERT_KEY);
  if (await heldBack(last, ATTEMPT_KEY, now)) return;

  const where = {
    source: MIRROR_SOURCE,
    state: "dead",
    ...(last ? { updatedAt: { gt: last } } : {}),
  };
  const [count, newest] = await Promise.all([
    db.wikiMirrorJob.count({ where }),
    db.wikiMirrorJob.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: MAX_JOBS_LISTED,
      select: { kind: true, title: true, lastError: true },
    }),
  ]);
  if (count === 0) return;

  const [only] = newest;
  let delivered: boolean;
  if (count === 1 && only) {
    delivered = await discordWebhook.sendWarning("WikiOS mirror job dead", describeJob(only));
  } else {
    const more = count > newest.length ? [`...and ${count - newest.length} more`] : [];
    delivered = await discordWebhook.sendWarning(
      "WikiOS mirror jobs dead",
      [
        `${count} mirror jobs went dead since the last warning:`,
        ...newest.map(describeJob),
        ...more,
      ].join("\n")
    );
  }
  await stamp(delivered ? DEAD_ALERT_KEY : ATTEMPT_KEY, now);
}

/**
 * Warn that the worker's window is full (`size` jobs that are neither finished nor dead), unless a warning was
 * delivered less than 30 minutes ago or the last attempt failed less than 5 minutes ago. A delivered warning stamps
 * `SATURATION_ALERT_KEY`, a failed one `SATURATION_ATTEMPT_KEY`.
 */
export async function alertWindowSaturated(size: number, now = new Date()): Promise<void> {
  if (!discordWebhook.isEnabled()) return;
  if (await heldBack(await timeAt(SATURATION_ALERT_KEY), SATURATION_ATTEMPT_KEY, now)) return;
  const delivered = await discordWebhook.sendWarning(
    "WikiOS mirror queue full",
    `At least ${size} mirror jobs are waiting, a full window: the mirror is falling behind and classic MediaWiki lags WikiOS.`
  );
  await stamp(delivered ? SATURATION_ALERT_KEY : SATURATION_ATTEMPT_KEY, now);
}

/**
 * mirror-alerts.ts — the Discord warning for mirror jobs that went dead, at most once in 30 minutes.
 *
 * A dead job means classic MediaWiki is out of sync for that title until an administrator acts, so the operators are
 * told. But a MediaWiki outage kills every queued job within the same few cycles, and a flapping job dies again
 * after each requeue: one message per job, or per cycle, would flood the channel. So the warning is one message, at
 * most once in `DEAD_ALERT_INTERVAL_MS`, about every job that went dead since the previous one (found in the outbox
 * itself, so a job that died while a warning was held back is still named by the next one). The time of the last
 * warning is kept in `SystemConfig`.
 */

import { db } from "~/server/db";
import { discordWebhook } from "~/lib/discord/webhook";
import { MIRROR_SOURCE } from "./mirror-outbox";

export const DEAD_ALERT_INTERVAL_MS = 30 * 60_000;
export const DEAD_ALERT_KEY = "wikiMirror.deadAlertAt";
/** Jobs named in the message; the rest are counted. */
const MAX_JOBS_LISTED = 5;
/** Discord's embed description holds 4096 characters; a job's last error can be 2000. */
const LINE_LIMIT = 300;

async function lastAlertAt(): Promise<Date | null> {
  const row = await db.systemConfig.findUnique({
    where: { key: DEAD_ALERT_KEY },
    select: { value: true },
  });
  const at = row ? new Date(row.value) : null;
  return at && !Number.isNaN(at.getTime()) ? at : null;
}

const describeJob = (job: { kind: string; title: string; lastError: string | null }) =>
  `${job.kind} ${job.title}: ${job.lastError ?? "(no error recorded)"}`.slice(0, LINE_LIMIT);

/**
 * Warn about the jobs that went dead since the last warning, unless one was sent less than 30 minutes ago (they wait
 * for the next one). One job is told as `<kind> <title>: <error>`; several as a count and the newest few.
 */
export async function alertDeadJobs(now = new Date()): Promise<void> {
  const last = await lastAlertAt();
  if (last && now.getTime() - last.getTime() < DEAD_ALERT_INTERVAL_MS) return;

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
  if (count === 1 && only) {
    await discordWebhook.sendWarning("WikiOS mirror job dead", describeJob(only));
  } else {
    const more = count > newest.length ? [`...and ${count - newest.length} more`] : [];
    await discordWebhook.sendWarning(
      "WikiOS mirror jobs dead",
      [
        `${count} mirror jobs went dead since the last warning:`,
        ...newest.map(describeJob),
        ...more,
      ].join("\n")
    );
  }
  await db.systemConfig.upsert({
    where: { key: DEAD_ALERT_KEY },
    create: { key: DEAD_ALERT_KEY, value: now.toISOString() },
    update: { value: now.toISOString() },
  });
}

/**
 * ThinkPages post views (SL-8).
 *
 * A view is a signed-in user opening a post's page (`/dashboard/post/[postId]`). Each viewer
 * counts once per post per UTC day, and the author's own views never count. Recording is cheap:
 *
 * 1. The (day, post, viewer) claim is a Redis `SET NX` with a 2-day expiry when Redis is ready,
 *    else an in-process set. Only a winning claim touches the database (one read to check the
 *    post is public or unlisted and not the viewer's own).
 * 2. Counted views collect in a pending tally (a Redis hash, else in-process memory) and are
 *    written in batches: once a minute or every 100 views from the recording process, and on
 *    every `thinkpages-trending` run. A flush adds to `ThinkpagesPostViewDay.views` (per post per
 *    day, read by the trending score) and to `ThinkpagesPost.impressions` (the lifetime count
 *    shown as views).
 *
 * The in-process fallback dedupes per process only, so with several web processes and no Redis
 * a viewer can count once per process per day.
 */
import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { getSharedRedis, isRedisReady } from "~/lib/cache/redis-client";

const DAY_MS = 24 * 60 * 60 * 1000;
const SEEN_TTL_SECONDS = 2 * 24 * 60 * 60;
const PENDING_KEY = "thinkpages:views:pending";
const FLUSH_INTERVAL_MS = 60_000;
const FLUSH_AT_PENDING = 100;
/** Visibilities whose views count (private and draft posts are the author's alone). */
const COUNTED_VISIBILITIES = new Set(["public", "unlisted"]);

type ViewsDb = Pick<PrismaClient, "thinkpagesPost" | "thinkpagesPostViewDay">;

interface PendingView {
  postId: string;
  /** UTC day, `YYYY-MM-DD`. */
  day: string;
  views: number;
}

/** The UTC day a view belongs to, as `YYYY-MM-DD`. */
export function viewDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Midday of a view day (clamped to `now`): when the trending score treats its views as made. */
export function viewDayMoment(day: Date, now: Date): Date {
  return new Date(Math.min(day.getTime() + DAY_MS / 2, now.getTime()));
}

// In-process fallback state.
const seen = new Map<string, Set<string>>();
const pending = new Map<string, number>();
let pendingCount = 0;
let lastFlushAt = Date.now();

function readyRedis(): Redis | null {
  const client = getSharedRedis();
  return isRedisReady(client) ? client : null;
}

const pendingField = (day: string, postId: string) => `${day}|${postId}`;

function parsePendingField(field: string, views: number): PendingView | null {
  const [day, postId] = field.split("|");
  if (!day || !postId || !Number.isFinite(views) || views <= 0) return null;
  return { day, postId, views };
}

/** True the first time this viewer is seen on this post today. */
async function claimView(day: string, postId: string, viewerId: string): Promise<boolean> {
  const redis = readyRedis();
  if (redis) {
    try {
      const set = await redis.set(
        `thinkpages:views:seen:${day}:${postId}:${viewerId}`,
        "1",
        "EX",
        SEEN_TTL_SECONDS,
        "NX"
      );
      return set === "OK";
    } catch (error) {
      console.warn("[post-views] Redis claim failed, using memory:", error);
    }
  }
  // Drop sets for earlier days so memory stays bounded.
  for (const key of seen.keys()) if (key !== day) seen.delete(key);
  const today = seen.get(day) ?? new Set<string>();
  seen.set(day, today);
  const key = `${postId}\u0000${viewerId}`;
  if (today.has(key)) return false;
  today.add(key);
  return true;
}

async function addPending(day: string, postId: string): Promise<void> {
  pendingCount++;
  const redis = readyRedis();
  if (redis) {
    try {
      await redis.hincrby(PENDING_KEY, pendingField(day, postId), 1);
      return;
    } catch (error) {
      console.warn("[post-views] Redis tally failed, using memory:", error);
    }
  }
  const field = pendingField(day, postId);
  pending.set(field, (pending.get(field) ?? 0) + 1);
}

/** Takes every pending tally (memory and Redis), leaving both empty. */
async function drainPending(): Promise<PendingView[]> {
  const drained: PendingView[] = [];
  for (const [field, views] of pending) {
    const entry = parsePendingField(field, views);
    if (entry) drained.push(entry);
  }
  pending.clear();
  pendingCount = 0;

  const redis = readyRedis();
  if (redis) {
    try {
      // Rename first so views recorded during the drain land in a fresh hash.
      const draining = `${PENDING_KEY}:draining:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      const renamed = await redis.rename(PENDING_KEY, draining).then(
        () => true,
        () => false // no pending hash
      );
      if (renamed) {
        const rows = await redis.hgetall(draining);
        await redis.del(draining);
        for (const [field, value] of Object.entries(rows)) {
          const entry = parsePendingField(field, Number(value));
          if (entry) drained.push(entry);
        }
      }
    } catch (error) {
      console.warn("[post-views] Redis drain failed:", error);
    }
  }
  return drained;
}

/**
 * Writes every pending view to the database. Returns the number of views written. A row that
 * fails (for example a post deleted since) is skipped.
 */
export async function flushPendingViews(db: ViewsDb): Promise<number> {
  lastFlushAt = Date.now();
  const drained = await drainPending();
  // Merge memory and Redis entries for the same post and day.
  const merged = new Map<string, PendingView>();
  for (const entry of drained) {
    const key = pendingField(entry.day, entry.postId);
    const existing = merged.get(key);
    if (existing) existing.views += entry.views;
    else merged.set(key, { ...entry });
  }

  let written = 0;
  for (const { postId, day, views } of merged.values()) {
    try {
      const dayDate = new Date(`${day}T00:00:00.000Z`);
      await db.thinkpagesPostViewDay.upsert({
        where: { postId_day: { postId, day: dayDate } },
        create: { postId, day: dayDate, views },
        update: { views: { increment: views } },
      });
      await db.thinkpagesPost.updateMany({
        where: { id: postId },
        data: { impressions: { increment: views } },
      });
      written += views;
    } catch (error) {
      console.warn(`[post-views] Dropped ${views} view(s) of post ${postId}:`, error);
    }
  }
  return written;
}

/**
 * Records that `viewerClerkId` opened `postId`. Returns true when the view counted (first view
 * today by someone other than the author, on a public or unlisted post).
 */
export async function recordPostView(
  db: ViewsDb,
  postId: string,
  viewerClerkId: string,
  now: Date = new Date()
): Promise<boolean> {
  const day = viewDay(now);
  if (!(await claimView(day, postId, viewerClerkId))) return false;

  const post = await db.thinkpagesPost.findUnique({
    where: { id: postId },
    select: { visibility: true, account: { select: { clerkUserId: true } } },
  });
  if (!post || !COUNTED_VISIBILITIES.has(post.visibility)) return false;
  if (post.account?.clerkUserId === viewerClerkId) return false;

  await addPending(day, postId);
  if (pendingCount >= FLUSH_AT_PENDING || Date.now() - lastFlushAt >= FLUSH_INTERVAL_MS) {
    void flushPendingViews(db).catch((error: unknown) =>
      console.error("[post-views] Flush failed:", error)
    );
  }
  return true;
}

/** Test hook: forget in-process claims and tallies. */
export function resetPostViewMemory(): void {
  seen.clear();
  pending.clear();
  pendingCount = 0;
  lastFlushAt = Date.now();
}

/**
 * Background achievement-evaluation queue.
 *
 * Event sites call `queueAchievementCheck(userId)` (one line, synchronous, never throws);
 * the worker in `service.ts` drains the queue and evaluates the user. Kept free of Prisma
 * and of the service itself so any router can import it without an import cycle.
 *
 * Backed by Redis (`achievements:queue`) when REDIS_ENABLED, otherwise an in-process list.
 * The `achievements-evaluate` cron job is the backstop for anything a restart drops.
 */
import { Redis } from "ioredis";

interface AchievementQueueItem {
  /** Internal `User.id` or Clerk id; the worker resolves either. */
  userId: string;
  /** Country to evaluate against; null/absent means the user's active country, if any. */
  countryId?: string | null;
}

const REDIS_KEY = "achievements:queue";
/** Hard cap on the in-process list so a process without a worker can't grow it forever. */
export const MAX_IN_MEMORY_QUEUE = 10_000;

const inMemoryQueue: AchievementQueueItem[] = [];
const pending = new Set<string>();

let redisClient: Redis | null = null;
function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && process.env.REDIS_ENABLED === "true") {
    try {
      redisClient = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
      redisClient.on("error", (err) => {
        console.warn("[Achievement Queue] Redis connection error:", err.message);
      });
      return redisClient;
    } catch (err) {
      console.warn("[Achievement Queue] Failed to initialize Redis client:", err);
    }
  }
  return null;
}

function queueKey(item: AchievementQueueItem): string {
  return `${item.userId}:${item.countryId ?? ""}`;
}

/**
 * Ask for a background achievement evaluation of this user. Non-blocking and
 * failure-tolerant: a missing id is ignored, duplicates already waiting are dropped,
 * and no error ever reaches the caller.
 */
export function queueAchievementCheck(
  userIdOrClerkId: string | null | undefined,
  countryId?: string | null
): void {
  try {
    if (!userIdOrClerkId) return;
    const item: AchievementQueueItem = { userId: userIdOrClerkId, countryId: countryId ?? null };
    const redis = getRedisClient();
    if (redis && redis.status === "ready") {
      // Shared queue: another process may pop it, so no local de-dupe (evaluation is idempotent)
      redis.rpush(REDIS_KEY, JSON.stringify(item)).catch((err) => {
        console.warn("[Achievement Queue] Redis enqueue failed, falling back to memory:", err);
        pushInMemory(item);
      });
      return;
    }
    pushInMemory(item);
  } catch (err) {
    console.warn("[Achievement Queue] enqueue failed:", err);
  }
}

function pushInMemory(item: AchievementQueueItem) {
  const key = queueKey(item);
  if (pending.has(key) || inMemoryQueue.length >= MAX_IN_MEMORY_QUEUE) return;
  pending.add(key);
  inMemoryQueue.push(item);
}

/** Take the next item (Redis first, then the in-process list), or null when empty. */
export async function dequeueAchievementCheck(): Promise<AchievementQueueItem | null> {
  const redis = getRedisClient();
  if (redis && redis.status === "ready") {
    try {
      const data = await redis.lpop(REDIS_KEY);
      if (data) return JSON.parse(data) as AchievementQueueItem;
    } catch (err) {
      console.warn("[Achievement Queue] Redis lpop failed, falling back to memory:", err);
    }
  }
  return inMemoryQueue.shift() ?? null;
}

/** Mark an item as processed so the same user can be queued again. */
export function completeAchievementCheck(item: AchievementQueueItem): void {
  pending.delete(queueKey(item));
}

/** Test hook. */
export function resetAchievementQueue(): void {
  inMemoryQueue.length = 0;
  pending.clear();
}

/** Items waiting in the in-process list (for tests and diagnostics). */
export function inMemoryQueueLength(): number {
  return inMemoryQueue.length;
}

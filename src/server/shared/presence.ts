/**
 * Online status (Settings → Privacy & Security → Online status, SL-4).
 *
 * Signed-in clients send a heartbeat (`users.heartbeat`) about once a minute while a tab is
 * visible. The last heartbeat time is kept cheaply: a Redis key per user (`presence:<clerkId>`,
 * expiring after `PRESENCE_TTL_SECONDS`) when Redis is ready, else an in-process map. Nothing
 * is written to the database.
 *
 * A user counts as online for `ONLINE_WINDOW_MS` after their last heartbeat, and only when they
 * have not turned `showOnlineStatus` off. Other viewers see nothing at all for a user who has.
 *
 * The in-process fallback is per process: with several web processes and no Redis, a user only
 * shows online to requests served by a process that received their heartbeat.
 */
import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { getSharedRedis, isRedisReady } from "~/lib/cache/redis-client";
import { usersWithSwitchOff } from "./privacy-permissions";

/** How long after the last heartbeat a user still counts as online. */
export const ONLINE_WINDOW_MS = 2 * 60_000;
/** The client's heartbeat interval. */
export const HEARTBEAT_INTERVAL_MS = 60_000;
const PRESENCE_TTL_SECONDS = 10 * 60;
const KEY_PREFIX = "presence:";

const memory = new Map<string, number>();

function readyRedis(): Redis | null {
  const client = getSharedRedis();
  return isRedisReady(client) ? client : null;
}

function pruneMemory(now: number) {
  if (memory.size < 5000) return;
  for (const [id, at] of memory) {
    if (now - at > PRESENCE_TTL_SECONDS * 1000) memory.delete(id);
  }
}

/** Records a heartbeat. Never throws. */
export async function recordHeartbeat(clerkId: string, now: Date = new Date()): Promise<void> {
  if (!clerkId) return;
  const at = now.getTime();
  const redis = readyRedis();
  if (redis) {
    try {
      await redis.set(`${KEY_PREFIX}${clerkId}`, String(at), "EX", PRESENCE_TTL_SECONDS);
      return;
    } catch {
      // Fall through to memory.
    }
  }
  pruneMemory(at);
  memory.set(clerkId, at);
}

/** Forgets a user's last heartbeat (Clear history). Never throws. */
export async function clearPresence(clerkId: string): Promise<void> {
  memory.delete(clerkId);
  const redis = readyRedis();
  if (redis) await redis.del(`${KEY_PREFIX}${clerkId}`).catch(() => 0);
}

/** Each user's last heartbeat time in ms (users with none are absent). */
async function lastHeartbeats(clerkIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const redis = readyRedis();
  if (redis && clerkIds.length > 0) {
    try {
      const values = await redis.mget(...clerkIds.map((id) => `${KEY_PREFIX}${id}`));
      clerkIds.forEach((id, i) => {
        const at = Number(values[i]);
        if (Number.isFinite(at) && at > 0) result.set(id, at);
      });
      return result;
    } catch {
      // Fall through to memory.
    }
  }
  for (const id of clerkIds) {
    const at = memory.get(id);
    if (at) result.set(id, at);
  }
  return result;
}

/**
 * Which of `clerkIds` are online and let others see it. Fails closed: on any error nobody is
 * shown online.
 */
export async function visibleOnlineUserIds(
  db: Pick<PrismaClient, "userConnection">,
  clerkIds: string[],
  now: Date = new Date()
): Promise<Set<string>> {
  const ids = [...new Set(clerkIds.filter(Boolean))];
  if (ids.length === 0) return new Set();
  try {
    const beats = await lastHeartbeats(ids);
    const recent = ids.filter((id) => {
      const at = beats.get(id);
      return at !== undefined && now.getTime() - at <= ONLINE_WINDOW_MS;
    });
    if (recent.length === 0) return new Set();
    const hidden = await usersWithSwitchOff(db, recent, "showOnlineStatus");
    return new Set(recent.filter((id) => !hidden.has(id)));
  } catch {
    return new Set();
  }
}

/** Test hook: empties the in-process store. */
export function resetPresenceForTests() {
  memory.clear();
}

import { db } from "~/server/db";

const configCache = new Map<string, boolean>();
let lastFetch = 0;
let inflight: Promise<void> | null = null;
const CACHE_TTL = 30_000;

async function refreshCache(): Promise<void> {
  try {
    const configs = await db.notificationEventConfig.findMany({
      select: { eventKey: true, enabled: true },
    });
    configCache.clear();
    for (const c of configs) {
      configCache.set(c.eventKey, c.enabled);
    }
  } catch {
    // DB unavailable — keep the previous config (unknown keys default to enabled)
  } finally {
    // Also on error, so a failing DB is retried once per TTL rather than on every call
    lastFetch = Date.now();
  }
}

function isCacheStale(): boolean {
  return Date.now() - lastFetch > CACHE_TTL;
}

/** Refresh at most once per TTL, sharing one in-flight query between concurrent callers. */
function ensureFresh(): Promise<void> {
  if (!inflight && isCacheStale()) {
    inflight = refreshCache().finally(() => {
      inflight = null;
    });
  }
  return inflight ?? Promise.resolve();
}

export async function isNotificationEventEnabled(eventKey: string): Promise<boolean> {
  await ensureFresh();
  // Unconfigured events default to enabled
  return configCache.get(eventKey) ?? true;
}

export async function guardNotificationEvent(eventKey: string): Promise<boolean> {
  const enabled = await isNotificationEventEnabled(eventKey);
  if (!enabled) {
    console.debug(`[NotificationGuard] Suppressed: ${eventKey} (disabled)`);
  }
  return enabled;
}

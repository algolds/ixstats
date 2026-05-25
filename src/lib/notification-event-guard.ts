import { db } from "~/server/db";

const configCache = new Map<string, boolean | null>();
let lastFetch = 0;
const CACHE_TTL = 30_000;

async function refreshCache(): Promise<void> {
  try {
    const configs = await db.notificationEventConfig.findMany({
      where: { enabled: true },
      select: { eventKey: true },
    });
    const enabledKeys = new Set(configs.map((c) => c.eventKey));

    const allKeys = await db.notificationEventConfig.findMany({
      select: { eventKey: true, enabled: true },
    });
    configCache.clear();
    for (const c of allKeys) {
      configCache.set(c.eventKey, c.enabled);
    }
    lastFetch = Date.now();
  } catch {
    // DB unavailable — default to enabled for all
  }
}

function isCacheStale(): boolean {
  return Date.now() - lastFetch > CACHE_TTL;
}

export async function isNotificationEventEnabled(eventKey: string): Promise<boolean> {
  if (isCacheStale() || !configCache.has(eventKey)) {
    await refreshCache();
  }

  const cached = configCache.get(eventKey);
  // Default to enabled if not in cache or on error
  return cached ?? true;
}

export async function guardNotificationEvent(eventKey: string): Promise<boolean> {
  const enabled = await isNotificationEventEnabled(eventKey);
  if (!enabled) {
    console.debug(`[NotificationGuard] Suppressed: ${eventKey} (disabled)`);
  }
  return enabled;
}

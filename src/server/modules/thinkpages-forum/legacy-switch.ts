/**
 * The legacy forum switch (phase 4, Task 6): while on, every `/forum/*` page of the old XenForo bridge redirects to
 * the native forum; while off (no row, or any value but "true"), the bridge renders as before. Flipped with
 * `bun run forum:legacy-redirect -- on|off|status`.
 *
 * The flag is a SystemConfig row read at most once per TTL per process (the WikiOS editing switch's pattern), so a
 * flip reaches every process within 15 s. The pages await `refreshLegacyForumRedirect()` (through the redirect).
 */
import { db } from "~/server/db";

export const LEGACY_FORUM_REDIRECT_KEY = "forum_legacy_redirect";
export const LEGACY_FORUM_TTL_MS = 15_000;

let cached = false;
let loadedAt = 0;
let inFlight: Promise<boolean> | null = null;

const stale = () => Date.now() - loadedAt > LEGACY_FORUM_TTL_MS;

export function refreshLegacyForumRedirect(force = false): Promise<boolean> {
  if (!force && !stale()) return Promise.resolve(cached);
  inFlight ??= db.systemConfig
    .findUnique({ where: { key: LEGACY_FORUM_REDIRECT_KEY }, select: { value: true } })
    .then((row) => {
      cached = row?.value === "true";
      return cached;
    })
    .catch((error: Error | string) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        "[forum] could not read the legacy redirect switch; keeping the last value:",
        message
      );
      return cached;
    })
    .finally(() => {
      loadedAt = Date.now();
      inFlight = null;
    });
  return inFlight;
}

export async function setLegacyForumRedirect(on: boolean): Promise<void> {
  const value = on ? "true" : "false";
  await db.systemConfig.upsert({
    where: { key: LEGACY_FORUM_REDIRECT_KEY },
    create: { key: LEGACY_FORUM_REDIRECT_KEY, value },
    update: { value },
  });
  cached = on;
  loadedAt = Date.now();
}

export function __resetLegacyForumSwitchForTests(): void {
  cached = false;
  loadedAt = 0;
  inFlight = null;
}

import type { PrismaClient } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

export function shouldTouchLastSeen(lastSeenAt: Date | null | undefined, now: Date): boolean {
  return !lastSeenAt || now.getTime() - lastSeenAt.getTime() > DAY_MS;
}

/** At most one write per user per day; never blocks or fails the request (feeds founder succession). */
export function touchLastSeen(
  database: Pick<PrismaClient, "user">,
  user: { id: string; lastSeenAt?: Date | null },
  now: Date = new Date()
): void {
  if (!shouldTouchLastSeen(user.lastSeenAt, now)) return;
  try {
    // Prisma can throw validation errors synchronously (before returning a promise), so the call
    // itself must be guarded, not just the returned promise's `.catch` — this write must never be
    // able to fail or block the request it rides in on.
    void database.user.update({ where: { id: user.id }, data: { lastSeenAt: now } }).catch(() => null);
  } catch {
    // swallow — see above
  }
}

/** How long a card takedown request has for an answer. Client-safe, so the admin copy reads the same number. */
export const TAKEDOWN_DEADLINE_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** When a takedown request received at `receivedAt` must be answered. */
export function takedownDueAt(receivedAt: Date): Date {
  return new Date(receivedAt.getTime() + TAKEDOWN_DEADLINE_DAYS * DAY_MS);
}

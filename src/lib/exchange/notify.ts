/**
 * Exchange notifications: bids, awards, payouts, disputes, expiries, share sales and
 * dividends. Sent after the money has moved (never inside the transaction) through the
 * shared notification API, which drops a notice the recipient's preferences filter out
 * (`recipientAccepts`: the "economic" category toggle and the minimum urgency). Best-effort:
 * a failure is logged, never thrown, so it can't undo or block a settled move.
 */

export type ExchangeNoticePriority = "low" | "medium" | "high";

export interface ExchangeNotice {
  /** Database User.id of the recipient. */
  userId: string;
  title: string;
  message: string;
  priority?: ExchangeNoticePriority;
  /** Defaults to the Exchange page. */
  href?: string;
}

const EXCHANGE_HREF = "/vault/exchange";

/** Send each notice; returns how many the API accepted (a filtered one counts as not sent). */
export async function sendExchangeNotices(notices: readonly ExchangeNotice[]): Promise<number> {
  if (notices.length === 0) return 0;
  let sent = 0;
  try {
    const { notificationAPI } = await import("~/lib/notifications/api");
    for (const n of notices) {
      try {
        const id = await notificationAPI.create({
          userId: n.userId,
          title: n.title,
          message: n.message,
          category: "economic",
          type: "info",
          priority: n.priority ?? "medium",
          href: n.href ?? EXCHANGE_HREF,
          source: "exchange",
        });
        if (id) sent++;
      } catch (error) {
        console.warn("[Exchange] notification failed:", n.title, error);
      }
    }
  } catch (error) {
    console.warn("[Exchange] notifications unavailable:", error);
  }
  return sent;
}

/** Fire and forget: callers return their result without waiting on delivery. */
export function notifyExchange(notices: readonly ExchangeNotice[]): void {
  void sendExchangeNotices(notices);
}

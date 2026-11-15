// Validation and rate limits for the client-originated realtime events (typing, read receipts).
import { z } from "zod";

const ID = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** Exactly one room reference: a conversation or a ThinkTank group. */
const roomRef = {
  conversationId: ID.optional(),
  groupId: ID.optional(),
};
const hasOneRoom = (v: { conversationId?: string; groupId?: string }) =>
  (v.conversationId === undefined) !== (v.groupId === undefined);

const typingSchema = z
  .object({ ...roomRef, isTyping: z.boolean() })
  .refine(hasOneRoom, "exactly one of conversationId or groupId");

const receiptSchema = z
  .object({ ...roomRef, messageId: ID })
  .refine(hasOneRoom, "exactly one of conversationId or groupId");

export type TypingInput = { conversationId?: string; groupId?: string; isTyping: boolean };
export type ReceiptInput = { conversationId?: string; groupId?: string; messageId: string };

/** The typing fields the server relays, or null when the payload is malformed. Extra keys are dropped. */
export function parseTypingPayload(payload: unknown): TypingInput | null {
  const parsed = typingSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/** The read-receipt fields the server relays, or null when the payload is malformed. Extra keys are dropped. */
export function parseReceiptPayload(payload: unknown): ReceiptInput | null {
  const parsed = receiptSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/** `limit` events per `windowMs` (fixed window); excess events are dropped, not queued. */
export function createRateLimiter(
  limit: number,
  windowMs = 1_000,
  now: () => number = Date.now
): () => boolean {
  let windowStart = 0;
  let count = 0;
  return () => {
    const t = now();
    if (t - windowStart >= windowMs) {
      windowStart = t;
      count = 0;
    }
    count += 1;
    return count <= limit;
  };
}

export const TYPING_PER_SECOND = 5;
export const RECEIPTS_PER_SECOND = 10;

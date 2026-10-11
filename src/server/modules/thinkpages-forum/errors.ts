import { Prisma } from "@prisma/client";
import { isMissingRecord, isUniqueViolation } from "~/lib/prisma-error";

export type ForumErrorCode =
  "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "BAD_REQUEST" | "TOO_MANY_REQUESTS";

/**
 * A refusal the router maps 1:1 to a TRPCError. `retryAfterSeconds`: how long until a rate-limited retry may succeed.
 * `context`: structured data the client reads from `error.data.context` (the advert refusal names the existing thread).
 */
export class ForumError extends Error {
  constructor(
    public readonly code: ForumErrorCode,
    message: string,
    public readonly retryAfterSeconds?: number,
    public readonly context?: Record<string, string>
  ) {
    super(message);
    this.name = "ForumError";
  }
}

export { isMissingRecord, isUniqueViolation };

/**
 * An interactive transaction that ran past its timeout or was closed under the write (Prisma P2028), for mapping to
 * CONFLICT: the write did not happen, and a retry may succeed.
 */
export function isTransactionTimeout<E>(error: E): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028";
}

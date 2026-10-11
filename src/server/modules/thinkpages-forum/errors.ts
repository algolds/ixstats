import { Prisma } from "@prisma/client";

export type ForumErrorCode =
  "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "BAD_REQUEST" | "TOO_MANY_REQUESTS";

/** A refusal the router maps 1:1 to a TRPCError. `retryAfterSeconds`: how long until a rate-limited retry may succeed. */
export class ForumError extends Error {
  constructor(
    public readonly code: ForumErrorCode,
    message: string,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "ForumError";
  }
}

/** A unique constraint lost to a concurrent insert (Prisma P2002), for mapping to CONFLICT. */
export function isUniqueViolation<E>(error: E): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * An interactive transaction that ran past its timeout or was closed under the write (Prisma P2028), for mapping to
 * CONFLICT: the write did not happen, and a retry may succeed.
 */
export function isTransactionTimeout<E>(error: E): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028";
}

/** A row deleted under a write (Prisma P2025, or P2003 for an insert whose parent is gone), for mapping to NOT_FOUND. */
export function isMissingRecord<E>(error: E): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2025" || error.code === "P2003")
  );
}

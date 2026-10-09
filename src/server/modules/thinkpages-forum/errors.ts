import { Prisma } from "@prisma/client";

export type ForumErrorCode = "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "BAD_REQUEST";

/** A refusal the router maps 1:1 to a TRPCError. */
export class ForumError extends Error {
  constructor(
    public readonly code: ForumErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ForumError";
  }
}

/** A unique constraint lost to a concurrent insert (Prisma P2002), for mapping to CONFLICT. */
export function isUniqueViolation<E>(error: E): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

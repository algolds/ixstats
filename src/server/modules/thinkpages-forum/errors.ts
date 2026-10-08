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

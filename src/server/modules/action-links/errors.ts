export type ActionLinkErrorCode = "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "BAD_REQUEST";

/** A refusal the router maps 1:1 to a TRPCError. */
export class ActionLinkError extends Error {
  constructor(
    public readonly code: ActionLinkErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ActionLinkError";
  }
}

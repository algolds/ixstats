/**
 * page-operation-error.ts — the refusal a WikiOS page or admin operation answers with (no such page, the destination
 * exists, a sync holds the lock). Its own module, so a service can refuse without importing the page-management
 * service and the graph behind it; page-management-service.ts re-exports it.
 */

/** IMMOBILE: the page is in a namespace WikiOS does not move pages in (the bot API's `immobilenamespace`). */
export type PageOperationErrorCode = "NOT_FOUND" | "CONFLICT" | "BAD_REQUEST" | "IMMOBILE";

/** A refusal the caller can act on (no such page, the destination exists); routers map it to a TRPCError. */
export class PageOperationError extends Error {
  constructor(
    readonly code: PageOperationErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PageOperationError";
  }
}

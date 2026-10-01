/**
 * page-busy-error.ts — a save that could not get its turn.
 *
 * Saves of one page queue on the page's row lock (`ArticleRepository.saveArticle`). A save that waits longer than it
 * may (the save in front of it is slow, or a long import of the same page holds the row) fails with PostgreSQL's lock
 * timeout (reported by Prisma as P2010) or Prisma's transaction error (P2028, or P2034 for a deadlock), which would
 * reach the caller as a 500. It is a
 * retryable "busy", and that is what `PageBusyError` says: tRPC answers it as a CONFLICT (an `AppError`, which the
 * error formatter maps), the bot API as `ratelimited` (error-map.ts), a bot's cue to wait and try again.
 */

import { Prisma } from "@prisma/client";
import { AppError, ConflictError } from "~/lib/app-error";

export class PageBusyError extends ConflictError {
  constructor() {
    super("The page is busy: another save of it did not finish in time. Try again in a moment.");
    this.name = "PageBusyError";
  }
}

/**
 * Prisma's text for a transaction that could not start or ran out of time. Inside a transaction the database client
 * turns Prisma's error into an `InternalError` that carries that text (src/server/db.ts), so the text is what is left to
 * recognise it by there.
 */
const TRANSACTION_TEXT =
  /Transaction API error|expired transaction|Unable to start a transaction|deadlock detected|lock timeout/i;

/** Whether `error` is a transaction that waited too long for its turn (or lost a deadlock): worth retrying. */
export function isTransactionBusy(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2010: a raw query PostgreSQL cancelled, here for `lock_timeout` (55P03) or a deadlock (40P01)
    return (
      error.code === "P2028" ||
      error.code === "P2034" ||
      (error.code === "P2010" && /55P03|40P01|lock timeout|deadlock/i.test(error.message))
    );
  }
  return (
    error instanceof AppError &&
    error.code === "INTERNAL_SERVER_ERROR" &&
    TRANSACTION_TEXT.test(error.message)
  );
}

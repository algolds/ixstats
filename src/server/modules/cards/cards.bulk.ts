/**
 * The contract every bulk change of cards keeps (curation's filter review, the Library's bulk hide): it acts on
 * exactly the cards an admin's read counted. The read's time is not in the future, so the change cannot take cards
 * made after the read; its count is at most MAX_FILTER_REVIEW; and the change's transaction recounts the matching
 * cards against it before it writes.
 */
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { MAX_FILTER_REVIEW } from "~/lib/cards/curation-limits";

/** An admin's read of the cards a bulk change takes: when it was made, and how many cards it counted. */
interface BulkRead {
  asOf: Date;
  expected: number;
}

/**
 * Refuses a read dated after now, and a count above the cap, before anything is read. `list` names what was read
 * ("The queue's"), `verb` the change ("Review").
 */
export function assertBulkRead(read: BulkRead, words: { list: string; verb: string }): void {
  if (read.asOf.getTime() > Date.now()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${words.list} read time is in the future. Reload and try again.`,
    });
  }
  if (read.expected > MAX_FILTER_REVIEW) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${words.verb} at most ${MAX_FILTER_REVIEW.toLocaleString()} cards at once. Narrow the filter.`,
    });
  }
}

/** In the change's transaction: refuses, with `conflict`'s message, unless as many cards match as the read counted. */
export async function assertBulkRecountTx(
  tx: Prisma.TransactionClient,
  where: Prisma.CardWhereInput,
  expected: number,
  conflict: (matching: number) => string
): Promise<void> {
  const matching = await tx.card.count({ where });
  if (matching !== expected) throw new TRPCError({ code: "CONFLICT", message: conflict(matching) });
}

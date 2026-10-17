import { type Prisma } from "@prisma/client";

/** Arbitrary constant; identifies these locks in pg_locks. */
const SERIAL_LOCK_NAMESPACE = 7331;

/**
 * Must be called inside `$transaction`. Takes the per-card serial lock for the life of the transaction (released at
 * commit or rollback). Re-entrant: a transaction may lock, check, then allocate.
 *
 * `$executeRaw`, not `$queryRaw`: Prisma cannot deserialize the `void` column `pg_advisory_xact_lock` returns.
 */
export async function lockCardSerialsTx(
  tx: Prisma.TransactionClient,
  cardId: string
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SERIAL_LOCK_NAMESPACE}::int, hashtext(${cardId}))`;
}

/**
 * The card's high-water mark: the highest serial held by a copy or recorded in the card's transfer events, 0 for none.
 * A revoked or voided copy's serial lives on in its trail. Read it under the card's serial lock.
 */
export async function highestIssuedSerialTx(
  tx: Prisma.TransactionClient,
  cardId: string
): Promise<number> {
  const held = await tx.cardOwnership.findFirst({
    where: { cardId },
    orderBy: { serialNumber: "desc" },
    select: { serialNumber: true },
  });
  // Postgres sorts nulls first in a descending order, hence the not-null filter
  const recorded = await tx.cardTransferEvent.findFirst({
    where: { cardId, serialNumber: { not: null } },
    orderBy: { serialNumber: "desc" },
    select: { serialNumber: true },
  });
  return Math.max(held?.serialNumber ?? 0, recorded?.serialNumber ?? 0);
}

/**
 * Must be called inside `$transaction`. Serializes serial allocation per card for the life of the transaction, so two
 * concurrent mints of one card cannot read the same `max(serial)`.
 *
 * The next serial is one past the card's high-water mark (`highestIssuedSerialTx`), so a revoked or voided copy's
 * serial is never issued again.
 */
export async function allocateSerialNumberTx(
  tx: Prisma.TransactionClient,
  cardId: string
): Promise<number> {
  await lockCardSerialsTx(tx, cardId);
  return (await highestIssuedSerialTx(tx, cardId)) + 1;
}

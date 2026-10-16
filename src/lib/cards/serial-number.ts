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
 * Must be called inside `$transaction`. Serializes serial allocation per card for the life of the transaction, so two
 * concurrent mints of one card cannot read the same `max(serial)`.
 */
export async function allocateSerialNumberTx(
  tx: Prisma.TransactionClient,
  cardId: string
): Promise<number> {
  await lockCardSerialsTx(tx, cardId);
  const max = await tx.cardOwnership.findFirst({
    where: { cardId },
    orderBy: { serialNumber: "desc" },
    select: { serialNumber: true },
  });
  return (max?.serialNumber ?? 0) + 1;
}

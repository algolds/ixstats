import { type Prisma } from "@prisma/client";

/** Arbitrary constant; identifies these locks in pg_locks. */
const SERIAL_LOCK_NAMESPACE = 7331;

/**
 * Must be called inside `$transaction`. Serializes serial allocation per card for
 * the life of the transaction (the advisory lock is released at commit/rollback),
 * so two concurrent awards of the same card cannot read the same `max(serial)`.
 *
 * `$executeRaw`, not `$queryRaw`: Prisma cannot deserialize the `void` column
 * `pg_advisory_xact_lock` returns.
 */
export async function allocateSerialNumberTx(
  tx: Prisma.TransactionClient,
  cardId: string
): Promise<number> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SERIAL_LOCK_NAMESPACE}::int, hashtext(${cardId}))`;
  const max = await tx.cardOwnership.findFirst({
    where: { cardId },
    orderBy: { serialNumber: "desc" },
    select: { serialNumber: true },
  });
  return (max?.serialNumber ?? 0) + 1;
}

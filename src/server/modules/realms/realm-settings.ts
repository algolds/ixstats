import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * A client that can lock the row: `$queryRaw` is required, so the lock is never skipped. A full client also has
 * `$transaction` (the update then runs inside one); a transaction client is already inside one and is used as it is.
 */
export type RealmSettingsDb = Pick<Prisma.TransactionClient, "realm" | "$queryRaw"> &
  Partial<Pick<PrismaClient, "$transaction">>;

/** Read-modify-write Realm.settings under a row lock so concurrent writers never drop each other's keys. */
export async function updateRealmSettings(
  db: RealmSettingsDb,
  realmId: string,
  mutate: (settings: unknown) => unknown,
  extraData?: Omit<Prisma.RealmUpdateInput, "settings">
): Promise<unknown> {
  const run = async (tx: RealmSettingsDb) => {
    await tx.$queryRaw`SELECT id FROM realms WHERE id = ${realmId} FOR UPDATE`;
    const row = await tx.realm.findUnique({ where: { id: realmId }, select: { settings: true } });
    const next = mutate(row?.settings ?? null);
    await tx.realm.update({
      where: { id: realmId },
      data: { ...extraData, settings: next as Prisma.InputJsonValue },
    });
    return next;
  };
  if (db.$transaction) return db.$transaction((tx) => run(tx));
  return run(db);
}

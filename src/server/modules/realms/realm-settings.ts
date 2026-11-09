import type { Prisma, PrismaClient } from "@prisma/client";

export type RealmSettingsDb =
  | PrismaClient
  | Prisma.TransactionClient
  | (Pick<Prisma.TransactionClient, "realm"> &
      Partial<Pick<PrismaClient, "$transaction" | "$queryRaw">>);

/** Read-modify-write Realm.settings under a row lock so concurrent writers never drop each other's keys. */
export async function updateRealmSettings(
  db: RealmSettingsDb,
  realmId: string,
  mutate: (settings: unknown) => unknown,
  extraData?: Omit<Prisma.RealmUpdateInput, "settings">
): Promise<unknown> {
  const run = async (
    tx: Pick<Prisma.TransactionClient, "realm"> & Partial<Pick<Prisma.TransactionClient, "$queryRaw">>
  ) => {
    if (typeof tx.$queryRaw === "function") {
      await tx.$queryRaw`SELECT id FROM realms WHERE id = ${realmId} FOR UPDATE`;
    }
    const row = await tx.realm.findUnique({ where: { id: realmId }, select: { settings: true } });
    const next = mutate(row?.settings ?? null);
    await tx.realm.update({
      where: { id: realmId },
      data: { ...extraData, settings: next as Prisma.InputJsonValue },
    });
    return next;
  };
  if ("$transaction" in db && typeof db.$transaction === "function") {
    return db.$transaction((tx) => run(tx));
  }
  return run(db);
}

// src/server/api/routers/admin/_config-kv.ts
// Shared SystemConfig key/value read + write used by the admin config procedures.
import type { Prisma, PrismaClient } from "@prisma/client";

/** Raw stored values for `keys` (keys with no row are absent from the result). */
export async function readConfigKeys(
  db: PrismaClient,
  keys: readonly string[]
): Promise<Record<string, string>> {
  const rows = await db.systemConfig.findMany({ where: { key: { in: [...keys] } } });
  return Object.fromEntries(rows.map((row) => [row.key, row.value] as const));
}

const upsertArgs = (key: string, value: string, description: string | undefined) => ({
  where: { key },
  update: { value },
  create: { key, value, description },
});

/** Upserts every `{ key, value }` in one transaction; `describe` fills `description` on create. */
export async function writeConfigKeys(
  db: PrismaClient,
  updates: readonly { key: string; value: string }[],
  describe?: (key: string) => string
): Promise<void> {
  await db.$transaction(
    updates.map(({ key, value }) => db.systemConfig.upsert(upsertArgs(key, value, describe?.(key))))
  );
}

/** Upserts one `{ key, value }` through `db`, which may be a transaction's client writing other rows with it. */
export async function writeConfigKey(
  db: Pick<Prisma.TransactionClient, "systemConfig">,
  key: string,
  value: string,
  description?: string
): Promise<void> {
  await db.systemConfig.upsert(upsertArgs(key, value, description));
}

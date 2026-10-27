/**
 * ThinkPages settings the admin panel (Admin → ThinkPages) saves to SystemConfig and the
 * feature reads back.
 */
import type { PrismaClient } from "@prisma/client";

export const DEFAULT_MAX_THINKPAGES_ACCOUNTS = 25;

/** How many feed accounts one user may create (the personal persona does not count). */
export async function maxThinkpagesAccountsPerUser(
  db: Pick<PrismaClient, "systemConfig">
): Promise<number> {
  const row = await db.systemConfig.findUnique({
    where: { key: "thinkpages_maxAccountsPerUser" },
    select: { value: true },
  });
  const parsed = parseInt(row?.value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_THINKPAGES_ACCOUNTS;
}

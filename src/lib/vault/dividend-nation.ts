/**
 * Which nation pays an account's daily dividend.
 *
 * One dividend per account per day, from the account's primary nation: the earliest-created nation it
 * owns (ties broken by id). It does not follow the active nation, so switching to a richer nation just
 * before a payout changes nothing. An account that owns no nation but acts as one (a legacy link, or a
 * system owner's override) is paid from that nation, as before.
 */
import type { PrismaClient } from "@prisma/client";

type DividendDb = {
  country: Pick<PrismaClient["country"], "findFirst">;
};

export async function resolveDividendCountryId(
  db: DividendDb,
  user: { id: string; countryId: string | null }
): Promise<string | null> {
  const primary = await db.country.findFirst({
    where: { ownerUserId: user.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  return primary?.id ?? user.countryId;
}

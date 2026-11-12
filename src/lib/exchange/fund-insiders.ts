/**
 * The wealth-fund insider rule (spec §11a, owner ruling 2026-11-09): a nation's wealth fund may not
 * trade with that nation's owner (`Country.ownerUserId`) or anyone acting as that nation
 * (`User.countryId`).
 */
import { ExchangeError } from "~/lib/vault/exchange-service";
import { countryIdOfFundUser } from "./fund-ids";
import type { Db } from "./guards";

/** Whether a fill between `a` and `b` pairs a nation's wealth fund with that nation's owner or acting user (spec §11a). */
export async function isFundInsiderPair(
  tx: Db,
  a: string | null,
  b: string | null
): Promise<boolean> {
  if (!a || !b) return false;
  const countryA = countryIdOfFundUser(a);
  const countryB = countryIdOfFundUser(b);
  if (!countryA && !countryB) return false;
  if (countryA && countryB) return countryA === countryB;

  const countryId = countryA ?? countryB;
  if (!countryId) return false;
  const otherUserId = countryA ? b : a;
  const country = await tx.country.findUnique({
    where: { id: countryId },
    select: { ownerUserId: true },
  });
  if (country?.ownerUserId === otherUserId) return true;
  const user = await tx.user.findUnique({
    where: { id: otherUserId },
    select: { countryId: true },
  });
  return user?.countryId === countryId;
}

export async function assertNotFundInsiderPair(
  tx: Db,
  a: string | null,
  b: string | null
): Promise<void> {
  if (await isFundInsiderPair(tx, a, b)) {
    throw new ExchangeError("FORBIDDEN", "A wealth fund can't trade with its own nation's owner");
  }
}

/**
 * The server side of the cross-realm rule: every country-to-country action (embassies, cultural exchanges,
 * foreign policy, alliance targets, relation goals, diplomatic scenarios, summits) refuses when the two nations
 * are in different realms. Realm-to-realm embassies and forum posts are not country actions and stay open.
 * Winding an interaction down (closing or severing an embassy, lifting a sanction, declining or withdrawing a
 * proposal, cancelling an exchange) is not guarded, so rows from before the rule can still be ended.
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { SAME_REALM_MESSAGE, sameRealm, type RealmRef } from "~/lib/realms/same-realm";

/** Refuses unless both realm ids name the same realm. */
export function assertRealmsMatch(a: RealmRef, b: RealmRef): void {
  if (!sameRealm(a, b)) throw new TRPCError({ code: "BAD_REQUEST", message: SAME_REALM_MESSAGE });
}

/**
 * Loads two nations' realms and refuses when they differ. A nation that is not found is left to the caller's own
 * not-found handling; the same nation twice needs no lookup.
 */
export async function assertSameRealm(
  db: Pick<PrismaClient, "country">,
  countryA: string,
  countryB: string
): Promise<void> {
  if (countryA === countryB) return;
  const [a, b] = await Promise.all(
    [countryA, countryB].map((id) =>
      db.country.findUnique({ where: { id }, select: { realmId: true } })
    )
  );
  if (a && b) assertRealmsMatch(a.realmId, b.realmId);
}

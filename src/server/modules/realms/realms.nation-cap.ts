/**
 * How many nations one account may hold in one realm: the smaller of the realm's cap
 * (`Realm.settings.maxNationsPerUser`, decision 15) and the account's tier cap. The builder, claims and
 * `assignNation` all ask `nationCapacity`, so the rule lives in one place.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { hasPremiumTier } from "~/lib/auth/premium";
import { realmSettings } from "./realms.settings";

/** Nations per realm an account's tier allows. Change here to move the monetisation lever. */
export const NATION_TIER_CAPS = {
  /** Every signed-in account. */
  free: 1,
  /** `hasPremiumTier(membershipTier)` — MyCountry Premium (or NEXT_PUBLIC_PREMIUM_FOR_ALL on test builds). */
  premium: 5,
} as const;

export function tierNationCap(membershipTier: string | null | undefined): number {
  return hasPremiumTier(membershipTier) ? NATION_TIER_CAPS.premium : NATION_TIER_CAPS.free;
}

export interface NationCapacity {
  /** Nations the user owns in the realm now. */
  held: number;
  /** The effective cap: min(realmCap, tierCap). */
  cap: number;
  realmCap: number;
  tierCap: number;
  /** True when the user may take one more nation in the realm. */
  canTakeAnother: boolean;
}

export type NationCapClient = {
  country: Pick<PrismaClient["country"], "count">;
  user: Pick<PrismaClient["user"], "findUnique">;
};

/**
 * The user's standing against the cap in one realm. `membershipTier` may be passed when the caller already
 * has it; otherwise it is read from the user row (a missing user counts as the free tier).
 */
export async function nationCapacity(
  client: NationCapClient,
  input: {
    userId: string;
    realmId: string;
    settings: Prisma.JsonValue | null | undefined;
    membershipTier?: string | null;
  }
): Promise<NationCapacity> {
  const membershipTier =
    input.membershipTier !== undefined
      ? input.membershipTier
      : ((
          await client.user.findUnique({
            where: { id: input.userId },
            select: { membershipTier: true },
          })
        )?.membershipTier ?? null);
  const held = await client.country.count({
    where: { ownerUserId: input.userId, realmId: input.realmId },
  });
  const realmCap = realmSettings(input.settings).maxNationsPerUser;
  const tierCap = tierNationCap(membershipTier);
  const cap = Math.min(realmCap, tierCap);
  return { held, cap, realmCap, tierCap, canTakeAnother: held < cap };
}

/** The refusal every cap check shows; it names Premium only when Premium would actually raise the limit. */
export function capReachedMessage(
  capacity: Pick<NationCapacity, "cap" | "realmCap" | "tierCap">
): string {
  const premiumWouldHelp =
    capacity.tierCap < capacity.realmCap && capacity.tierCap < NATION_TIER_CAPS.premium;
  const nations = capacity.cap === 1 ? "1 nation" : `${capacity.cap} nations`;
  return (
    `You already hold ${nations} in this realm, the most your account may hold there` +
    (premiumWouldHelp ? ". MyCountry Premium raises the limit." : ".")
  );
}

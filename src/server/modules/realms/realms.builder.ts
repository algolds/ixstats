/**
 * Which realm the country builder creates a nation in (decisions 13–15: create new nations freely, within the
 * nation cap). A realm is open to the builder while it is `active`; IxWorld (tenant 0) always is.
 */
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import {
  capacityOf,
  capReachedMessage,
  nationCapacity,
  type NationCapacity,
} from "./realms.nation-cap";

export type BuilderRealmErrorCode = "REALM_NOT_FOUND" | "REALM_CLOSED" | "CAP_REACHED";

export class BuilderRealmError extends Error {
  constructor(
    public readonly code: BuilderRealmErrorCode,
    message: string
  ) {
    super(message);
    this.name = "BuilderRealmError";
  }
}

type BuilderDb = {
  realm: Pick<PrismaClient["realm"], "findUnique" | "findMany">;
  country: Pick<PrismaClient["country"], "count" | "findMany">;
  user: Pick<PrismaClient["user"], "findUnique">;
};

export interface BuilderUser {
  /** Platform user id (`User.id`). */
  id: string;
  clerkUserId: string;
}

/** The user's tier and the realm of the nation they act as (the builder's default realm). */
async function builderProfile(db: BuilderDb, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { membershipTier: true, country: { select: { realmId: true } } },
  });
  return {
    membershipTier: user?.membershipTier ?? null,
    currentRealmId: user?.country?.realmId ?? DEFAULT_REALM_ID,
  };
}

const isOpen = (realmId: string, status: string) =>
  realmId === DEFAULT_REALM_ID || status === "active";

/**
 * The realm a new builder nation goes into: `realmId` when given, else the realm of the nation the user acts as,
 * else IxWorld. Refuses an unknown or closed realm, and a realm where the user is at their nation cap.
 */
export async function resolveBuilderRealm(
  db: BuilderDb,
  user: BuilderUser,
  realmId?: string | null
): Promise<{ realmId: string; capacity: NationCapacity }> {
  const profile = await builderProfile(db, user.id);
  const target = realmId ?? profile.currentRealmId;
  const realm = await db.realm.findUnique({
    where: { id: target },
    select: { id: true, status: true, settings: true },
  });
  // IxWorld needs no realm row (it predates realms); every other realm must exist and be open.
  if (!realm && target !== DEFAULT_REALM_ID) {
    throw new BuilderRealmError("REALM_NOT_FOUND", "Realm not found");
  }
  if (realm && !isOpen(realm.id, realm.status)) {
    throw new BuilderRealmError("REALM_CLOSED", "This realm is not open for new nations");
  }
  const capacity = await nationCapacity(db, {
    userId: user.id,
    realmId: target,
    settings: realm?.settings,
    membershipTier: profile.membershipTier,
  });
  if (!capacity.canTakeAnother) {
    throw new BuilderRealmError("CAP_REACHED", capReachedMessage(capacity));
  }
  return { realmId: target, capacity };
}

export interface BuilderRealmOption {
  id: string;
  slug: string;
  name: string;
  held: number;
  cap: number;
  canCreate: boolean;
}

/**
 * The realms the builder's picker offers: IxWorld, plus active realms that are public, that the user founded,
 * or where they already hold a nation (unlisted realms stay out of everyone else's list — decision 19).
 * `defaultRealmId` is the realm of the nation the user acts as.
 */
export async function listBuilderRealms(
  db: BuilderDb,
  user: BuilderUser
): Promise<{ defaultRealmId: string; realms: BuilderRealmOption[] }> {
  const profile = await builderProfile(db, user.id);
  const [realms, owned] = await Promise.all([
    db.realm.findMany({
      where: {
        OR: [
          { id: DEFAULT_REALM_ID },
          {
            status: "active",
            OR: [
              { visibility: "public" },
              { ownerId: user.clerkUserId },
              { countries: { some: { ownerUserId: user.id } } },
            ],
          },
        ],
      },
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true, settings: true },
    }),
    db.country.findMany({ where: { ownerUserId: user.id }, select: { realmId: true } }),
  ]);
  const heldIn = new Map<string, number>();
  for (const { realmId } of owned) heldIn.set(realmId, (heldIn.get(realmId) ?? 0) + 1);

  const options = realms.map((realm): BuilderRealmOption => {
    const capacity = capacityOf(heldIn.get(realm.id) ?? 0, realm.settings, profile.membershipTier);
    return {
      id: realm.id,
      slug: realm.slug,
      name: realm.name,
      held: capacity.held,
      cap: capacity.cap,
      canCreate: capacity.canTakeAnother,
    };
  });
  // IxWorld first, then by name (the query's order; Array.prototype.sort is stable).
  options.sort((a, b) => Number(b.id === DEFAULT_REALM_ID) - Number(a.id === DEFAULT_REALM_ID));
  const defaultRealmId = options.some((r) => r.id === profile.currentRealmId)
    ? profile.currentRealmId
    : DEFAULT_REALM_ID;
  return { defaultRealmId, realms: options };
}

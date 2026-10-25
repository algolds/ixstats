/**
 * Creating a realm row with its clock and forum categories, the one body behind `realms.adminCreateRealm` and
 * Studio's "New realm from this world". Every realm is founded with a clock (realm time design §1): a start date,
 * an era and a speed, continuous with Ixnay's time. A realm made from a world is a draft, unlisted, owned by the
 * admin who made it (a Clerk id, as `Realm.ownerId` is): nobody else sees it until the admin hands it over and opens
 * it through the realm admin.
 */
import type { PrismaClient, Realm } from "@prisma/client";
import { parsePrismaError } from "~/lib/prisma-error";
import { createRealmClock, type RealmFoundingClock } from "~/lib/realms/realm-clock";
import { ixnayClock } from "~/server/shared/realm-time";
import { seedRealmCategories } from "~/server/modules/thinkpages-forum";

/** A realm that can't be created; the router turns it into the matching tRPC error. */
export class RealmCreateError extends Error {
  constructor(
    readonly code: "CONFLICT",
    message: string
  ) {
    super(message);
    this.name = "RealmCreateError";
  }
}

export interface NewRealm {
  slug: string;
  name: string;
  description?: string;
  visibility: "public" | "unlisted";
  /** A Clerk user id ("system" until the realm's admin has an account) */
  ownerId: string;
  status: "draft" | "active";
  /** What the founder picked for its clock. */
  clock: RealmFoundingClock;
}

/** The realm, its clock and its forum categories commit together (N3). `slug` is unique across all realms. */
export async function createRealmWithCategories(
  db: Pick<PrismaClient, "$transaction">,
  { clock: founding, ...data }: NewRealm
): Promise<Realm> {
  const clock = createRealmClock({
    ...founding,
    globalNowMs: ixnayClock().now(),
    realNowMs: Date.now(),
  });
  try {
    return await db.$transaction(async (tx) => {
      const realm = await tx.realm.create({ data: { ...data, settings: { clock } } });
      await seedRealmCategories(tx, realm);
      return realm;
    });
  } catch (error) {
    if (parsePrismaError(error)?.type === "unique_constraint") {
      throw new RealmCreateError("CONFLICT", "That slug is taken");
    }
    throw error;
  }
}

/** A draft, unlisted realm owned by `admin`, for a world to be checked and applied onto. */
export async function createRealmFromWorld(
  db: Pick<PrismaClient, "$transaction">,
  admin: { clerkUserId: string },
  input: { name: string; slug: string; clock: RealmFoundingClock }
): Promise<{ realmId: string; slug: string }> {
  const realm = await createRealmWithCategories(db, {
    ...input,
    ownerId: admin.clerkUserId,
    visibility: "unlisted",
    status: "draft",
  });
  return { realmId: realm.id, slug: realm.slug };
}

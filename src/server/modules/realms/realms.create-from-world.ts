/**
 * Creating a realm row with its forum categories, the one body behind `realms.adminCreateRealm` and Studio's "New
 * realm from this world". A realm made from a world is a draft, unlisted, owned by the admin who made it (a Clerk id,
 * as `Realm.ownerId` is): nobody else sees it until the admin hands it over and opens it through the realm admin.
 */
import type { PrismaClient, Realm } from "@prisma/client";
import { parsePrismaError } from "~/lib/prisma-error";
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
}

/** The realm and its forum categories commit together (N3). `slug` is unique across all realms. */
export async function createRealmWithCategories(
  db: Pick<PrismaClient, "$transaction">,
  data: NewRealm
): Promise<Realm> {
  try {
    return await db.$transaction(async (tx) => {
      const realm = await tx.realm.create({ data });
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
  input: { name: string; slug: string }
): Promise<{ realmId: string; slug: string }> {
  const realm = await createRealmWithCategories(db, {
    ...input,
    ownerId: admin.clerkUserId,
    visibility: "unlisted",
    status: "draft",
  });
  return { realmId: realm.id, slug: realm.slug };
}

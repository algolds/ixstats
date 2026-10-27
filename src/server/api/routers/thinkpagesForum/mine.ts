/**
 * The `/thinkpages/r/mine` resolver's lookup. A server component has no tRPC session, so it reads the Clerk user id
 * itself and resolves as that viewer, built the way the forum routers build one (`viewerOf`).
 */
import type { PrismaClient } from "@prisma/client";
import { myRealmSlugOf } from "~/server/modules/thinkpages-forum";
import { viewerForClerkUser, type PermalinkDb } from "./permalink";

export type MineDb = PermalinkDb & Pick<PrismaClient, "country" | "realm">;

/** The slug of the realm of the viewer's primary nation, or null: signed out, no nation, or a realm hidden from them. */
export async function myRealmSlugFor(
  db: MineDb,
  clerkUserId: string | null
): Promise<string | null> {
  return myRealmSlugOf(db, await viewerForClerkUser(db, clerkUserId));
}

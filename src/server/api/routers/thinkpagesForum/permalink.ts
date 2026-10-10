/**
 * The `/thinkpages/post/<id>` permalink's lookup (P1). The page is a server component with no tRPC session, so it
 * reads the Clerk user id itself and resolves as that viewer, built the way the forum routers build one
 * (`viewerOf`). A member's own report thread, a private board and a moderator's hidden post then redirect on the
 * server, on the page that viewer's thread view shows.
 */
import type { PrismaClient } from "@prisma/client";
import {
  resolvePostLocation,
  type ForumViewer,
  type ReadsDb,
  type ScopeDb,
} from "~/server/modules/thinkpages-forum";
import { id, viewerOf } from "./viewer";

export type PermalinkDb = ScopeDb & Pick<ReadsDb, "forumPost"> & Pick<PrismaClient, "user">;

/** The forum viewer for a Clerk user id: null when signed out or when the user has no row yet. */
export async function viewerForClerkUser(
  db: PermalinkDb,
  clerkUserId: string | null
): Promise<ForumViewer> {
  if (!clerkUserId) return null;
  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: { id: true, clerkUserId: true, countryId: true, role: { select: { name: true, level: true } } },
  });
  return viewerOf(db, user);
}

/** Where the post sits for this viewer, or null: an id over the input bound, or a post they may not see. */
export async function locatePostFor(
  db: PermalinkDb,
  clerkUserId: string | null,
  postId: string
): Promise<{ threadId: string; page: number } | null> {
  if (!id.safeParse(postId).success) return null;
  return resolvePostLocation(db, await viewerForClerkUser(db, clerkUserId), postId);
}

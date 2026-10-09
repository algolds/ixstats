/**
 * Category moderators (M19) and finding members (M14). Site admins appoint and remove category moderators; realm
 * founders give their officers the `board` power instead. Moderators find a member by Passport handle or wiki
 * username and get back only an id and a public name.
 */
import type { PrismaClient } from "@prisma/client";
import { isSiteAdmin } from "~/server/modules/realms";
import type { ForumViewer } from "./access";
import { ForumError, isUniqueViolation } from "./errors";
import { logModAction } from "./mod-log";
import { assertCategoryRoleGrantable } from "./mod-promotion";
import { assertModerator, assertModeratesCategory, scopeOfCategory } from "./mod-scope";
import { authorsOf, loadCategory, type AuthorsDb, type CategoryLocator } from "./reads";
import type { RealmDb } from "./realm-access";

export type ModeratorsDb = Pick<
  PrismaClient,
  "user" | "forumBan" | "forumCategory" | "forumCategoryModerator" | "forumModLog" | "$transaction"
> &
  RealmDb &
  AuthorsDb;

export interface ResolvedMember {
  id: string;
  name: string;
}

/**
 * A member by Passport handle (unique, stored lowercase; a leading @ is ignored), else by wiki username, exactly. A
 * wiki username two accounts share resolves to nobody rather than to either. Moderators only.
 */
export async function resolveMember(
  db: Pick<PrismaClient, "user">,
  viewer: ForumViewer,
  input: { handle: string }
): Promise<ResolvedMember | null> {
  assertModerator(viewer);
  const query = input.handle.trim();
  const handle = query.replace(/^@/, "").toLowerCase();
  if (!handle) return null;
  const byHandle = await db.user.findUnique({
    where: { handle },
    select: { id: true, handle: true },
  });
  if (byHandle?.handle) return { id: byHandle.id, name: byHandle.handle };
  const byWiki = await db.user.findMany({
    where: { wikiUsername: query },
    select: { id: true, wikiUsername: true },
    take: 2,
  });
  const only = byWiki.length === 1 ? byWiki[0] : undefined;
  return only?.wikiUsername ? { id: only.id, name: only.wikiUsername } : null;
}

/** A category's moderators, for site admins and the category's own moderators. */
export async function listCategoryModerators(
  db: ModeratorsDb,
  viewer: ForumViewer,
  locator: CategoryLocator
) {
  const { category } = await loadCategory(db, viewer, locator);
  assertModeratesCategory(viewer, category);
  const rows = await db.forumCategoryModerator.findMany({
    where: { categoryId: category.id },
    orderBy: { createdAt: "asc" },
    select: { userId: true, grantedBy: true, createdAt: true },
  });
  const { users } = await authorsOf(
    db,
    rows.map((r) => r.userId),
    []
  );
  return rows.map((row) => ({
    userId: row.userId,
    name: users.get(row.userId)?.name ?? "Member",
    grantedBy: row.grantedBy,
    createdAt: row.createdAt,
  }));
}

/**
 * Site admins only (M19): grant (create the row) or revoke (delete it), with `moderator.grant`/`moderator.revoke`
 * logged in the same transaction at the category's scope. Granting twice or revoking a non-moderator is CONFLICT;
 * granting to a member banned there or sitewide is BAD_REQUEST (M9).
 */
export async function setCategoryModerator(
  db: ModeratorsDb,
  actor: ForumViewer,
  input: { locator: CategoryLocator; userId: string; grant: boolean }
): Promise<void> {
  if (actor === null || !isSiteAdmin(actor)) {
    throw new ForumError("FORBIDDEN", "Only site admins appoint category moderators.");
  }
  const { category } = await loadCategory(db, actor, input.locator);
  const member = await db.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!member) throw new ForumError("NOT_FOUND", "Member not found.");
  if (input.grant) await assertCategoryRoleGrantable(db, member.id, category);
  const row = { categoryId: category.id, userId: member.id };
  const already = new ForumError("CONFLICT", "They already moderate this category.");
  try {
    await db.$transaction(async (tx) => {
      if (input.grant) {
        if (await tx.forumCategoryModerator.findFirst({ where: row, select: { id: true } })) {
          throw already;
        }
        await tx.forumCategoryModerator.create({ data: { ...row, grantedBy: actor.id } });
      } else if ((await tx.forumCategoryModerator.deleteMany({ where: row })).count === 0) {
        throw new ForumError("CONFLICT", "They don't moderate this category.");
      }
      await logModAction(tx, {
        actorId: actor.id,
        action: input.grant ? "moderator.grant" : "moderator.revoke",
        targetType: "user",
        targetId: member.id,
        scope: scopeOfCategory(category),
        detail: { categoryId: category.id },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw already;
    throw error;
  }
}

/** The moderator's bans list (M14): live or finished bans in the viewer's scope, newest first, paged. */
import { MOD_ROWS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import type { ForumViewer } from "./access";
import { appealStatusesOf } from "./mod-appeal-status";
import { ACTIVE_BAN_SELECT, liveAt, type BansDb } from "./mod-bans";
import { banScopeOf, listingScope, pageWindow, scopedRowsWhere } from "./mod-scope";

export const BANS_PER_PAGE = MOD_ROWS_PER_PAGE;

/**
 * Bans in the viewer's scope, newest first: live ones (`active`), or lifted and expired ones; each with its appeal's
 * status (null when not appealed).
 */
export async function listBans(
  db: Pick<BansDb, "forumBan" | "forumCategory" | "forumAppeal">,
  viewer: ForumViewer,
  filter: { active: boolean; realmId?: string | null; userId?: string },
  page: number
) {
  const now = new Date();
  const state = filter.active
    ? { liftedAt: null, ...liveAt(now) }
    : { OR: [{ liftedAt: { not: null } }, { expiresAt: { lte: now } }] };
  const where = {
    AND: [
      state,
      scopedRowsWhere(await listingScope(db, viewer, filter.realmId)),
      filter.userId ? { userId: filter.userId } : {},
    ],
  };
  const [rows, total] = await Promise.all([
    db.forumBan.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...pageWindow(page, BANS_PER_PAGE),
      select: {
        ...ACTIVE_BAN_SELECT,
        userId: true,
        issuedBy: true,
        liftedAt: true,
        liftedBy: true,
        createdAt: true,
      },
    }),
    db.forumBan.count({ where }),
  ]);
  const appeals = await appealStatusesOf(
    db,
    "ban",
    rows.map((row) => row.id)
  );
  return {
    rows: rows.map((row) => ({
      ...row,
      scope: banScopeOf(row.scope),
      appealStatus: appeals.get(row.id) ?? null,
    })),
    total,
  };
}

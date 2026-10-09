/** The moderator's warnings list (M14): warnings in the viewer's scope, newest first, paged. */
import { MOD_ROWS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import type { ForumViewer } from "./access";
import { appealStatusesOf } from "./mod-appeal-status";
import { listingScope, pageWindow } from "./mod-scope";
import type { WarningsDb } from "./mod-warnings";

export const WARNINGS_PER_PAGE = MOD_ROWS_PER_PAGE;

/**
 * Warnings in the viewer's scope (their categories; site admins everything), newest first, each with its appeal's
 * status (null when not appealed).
 */
export async function listWarnings(
  db: Pick<WarningsDb, "forumWarning" | "forumCategory" | "forumAppeal">,
  viewer: ForumViewer,
  filter: { userId?: string; realmId?: string | null; activeOnly?: boolean },
  page: number
) {
  const listing = await listingScope(db, viewer, filter.realmId);
  const where = {
    AND: [
      filter.activeOnly ? { revokedAt: null, expiresAt: { gt: new Date() } } : {},
      listing === null ? {} : { categoryId: { in: listing.categoryIds } },
      filter.userId ? { userId: filter.userId } : {},
    ],
  };
  const [rows, total] = await Promise.all([
    db.forumWarning.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...pageWindow(page, WARNINGS_PER_PAGE),
      select: {
        id: true,
        userId: true,
        issuedBy: true,
        reason: true,
        points: true,
        targetType: true,
        targetId: true,
        categoryId: true,
        expiresAt: true,
        revokedAt: true,
        revokedBy: true,
        createdAt: true,
      },
    }),
    db.forumWarning.count({ where }),
  ]);
  const appeals = await appealStatusesOf(
    db,
    "warning",
    rows.map((r) => r.id)
  );
  return { rows: rows.map((r) => ({ ...r, appealStatus: appeals.get(r.id) ?? null })), total };
}

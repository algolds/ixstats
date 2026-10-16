/**
 * The candidate threads of the watched count: the columns read for each, and which of them the member
 * may read (see `thread-listing.ts`).
 */
import type { Prisma } from "@prisma/client";
import { isBoardCategory } from "~/lib/thinkpages-forum/categories";
import { canSeeThread, type ForumViewer } from "./access";
import { advertRealmHiddenFrom, ADVERT_REALM_SELECT } from "./advert-access";
import { canSeeRealm, loadForumRealms } from "./realm-access";
import type { ReadsDb } from "./reads";

export const candidateSelect = (userId: string) =>
  ({
    id: true,
    title: true,
    authorUserId: true,
    authorPersonaId: true,
    importedAuthorName: true,
    xenforoThreadId: true,
    pinned: true,
    locked: true,
    hidden: true,
    postCount: true,
    lastPostAt: true,
    category: {
      select: {
        id: true,
        key: true,
        name: true,
        style: true,
        scope: true,
        realmId: true,
        visibility: true,
      },
    },
    advertRealm: { select: ADVERT_REALM_SELECT },
    reads: { where: { userId }, select: { readAt: true } },
  }) as const satisfies Prisma.ForumThreadSelect;

export type Candidate = Prisma.ForumThreadGetPayload<{
  select: ReturnType<typeof candidateSelect>;
}>;

/**
 * What the member may read: not the board, not hidden, the thread rule, and a realm that is visible to them. The
 * distinct realms of the rows that pass are loaded in one read, then each row is checked against its realm.
 */
export async function readable(
  db: ReadsDb,
  viewer: NonNullable<ForumViewer>,
  rows: readonly Candidate[]
): Promise<Candidate[]> {
  const passing = rows.filter(
    (row) =>
      !isBoardCategory(row.category) &&
      !row.hidden &&
      canSeeThread(viewer, row, row.category) &&
      !advertRealmHiddenFrom(viewer, row.advertRealm)
  );
  const realmIds = new Set<string>();
  for (const { category } of passing) {
    if (category.scope === "realm" && category.realmId) realmIds.add(category.realmId);
  }
  const realms = await loadForumRealms(db, [...realmIds]);
  return passing.filter(({ category }) => {
    if (category.scope !== "realm") return true;
    const realm = category.realmId ? realms.get(category.realmId) : undefined;
    return !!realm && canSeeRealm(viewer, realm);
  });
}

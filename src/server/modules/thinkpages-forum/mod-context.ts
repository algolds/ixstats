/**
 * What the moderation console shows a viewer (M10, M14): whether they are a site admin, the realms they moderate
 * (every realm for site admins, IxWorld included without a row, D8) and the categories they moderate with their
 * realm's slug and name. Members get empty lists, never an error, and cost no query.
 */
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { isSiteAdmin } from "~/server/modules/realms";
import type { ForumViewer } from "./access";
import { isModerator } from "./mod-scope";
import { canonicalRealm, IXWORLD_REALM, REALM_SELECT, type ForumRealm } from "./realm-access";

export type ContextDb = Pick<PrismaClient, "realm" | "forumCategory">;

export interface ModerationContext {
  isSiteAdmin: boolean;
  realms: Array<{ id: string; slug: string; name: string }>;
  categories: Array<{
    id: string;
    key: string;
    name: string;
    realm: { slug: string; name: string } | null;
  }>;
}

const EMPTY: ModerationContext = { isSiteAdmin: false, realms: [], categories: [] };

/** The realms by id (every realm when `ids` is null); IxWorld is synthesized when asked for and rowless. */
async function realmsById(
  db: Pick<ContextDb, "realm">,
  ids: readonly string[] | null
): Promise<Map<string, ForumRealm>> {
  if (ids !== null && ids.length === 0) return new Map();
  const rows = await db.realm.findMany({
    where: ids === null ? {} : { id: { in: [...ids] } },
    select: REALM_SELECT,
  });
  const realms = new Map(rows.map((row) => [row.id, canonicalRealm(row)]));
  if (!realms.has(DEFAULT_REALM_ID) && (ids === null || ids.includes(DEFAULT_REALM_ID))) {
    realms.set(DEFAULT_REALM_ID, IXWORLD_REALM);
  }
  return realms;
}

export async function moderationContext(
  db: ContextDb,
  viewer: ForumViewer
): Promise<ModerationContext> {
  if (viewer === null || !isModerator(viewer)) return EMPTY;
  const admin = isSiteAdmin(viewer);
  const realmIds = viewer.mod?.realmIds ?? [];
  const categoryIds = viewer.mod?.categoryIds ?? [];
  const categories = await db.forumCategory.findMany({
    where: admin
      ? {}
      : {
          OR: [
            { scope: "realm", realmId: { in: [...realmIds] } },
            { id: { in: [...categoryIds] } },
          ],
        },
    orderBy: { order: "asc" },
    select: { id: true, key: true, name: true, scope: true, realmId: true },
  });
  const placed = categories.flatMap((c) => (c.scope === "realm" && c.realmId ? [c.realmId] : []));
  const realms = await realmsById(db, admin ? null : [...new Set([...realmIds, ...placed])]);
  const realmOf = (c: { scope: string; realmId: string | null }) => {
    const realm = c.scope === "realm" && c.realmId ? realms.get(c.realmId) : undefined;
    return realm ? { slug: realm.slug, name: realm.name } : null;
  };
  const named = categories.map((c) => ({ id: c.id, key: c.key, name: c.name, realm: realmOf(c) }));
  const moderated = [...realms.values()].filter((r) => admin || realmIds.includes(r.id));
  return {
    isSiteAdmin: admin,
    realms: moderated
      .map((r) => ({ id: r.id, slug: r.slug, name: r.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    // Sitewide first, then by realm name; the query's order holds within each.
    categories: named.sort((a, b) => (a.realm?.name ?? "").localeCompare(b.realm?.name ?? "")),
  };
}

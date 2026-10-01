/**
 * page-management-service.ts — WikiOS Native Page Operations, Renames, Soft Deletes & Media Usage
 *
 * Provides atomic, transactional page moves with redirect preservation,
 * soft deletion/restoration, reverse asset lookups, and maintenance diagnostics.
 */

import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { toArticleSlug } from "./domain-types";
import { canonicalizeTitle, NAMESPACE_CANONICAL_NAMES, type CanonicalTitle } from "./title";
import { enqueueDeleteJob, enqueueMoveJob, scheduleMirrorKick } from "../services/mirror-outbox";
import { enqueueRender, invalidateTemplateDependents } from "../services/render-service";
import { evictWikiTitleCaches } from "../services/title-cache-eviction";
import { notifyWatchers, type HeadChange } from "../services/watchlist-notify";

/** Tell the page's watchers without making the operation wait for them (or fail on them). */
function notifyWatchersInBackground(change: HeadChange): void {
  void notifyWatchers(change).catch((error) => {
    console.warn("[PageManagement] Could not notify watchers:", error);
  });
}

/** Who performed an operation: the WikiOS user row (for the foreign keys) and the name the log shows. */
export interface PageActor {
  userId: string;
  name: string;
}

export type PageOperationErrorCode = "NOT_FOUND" | "CONFLICT" | "BAD_REQUEST";

/** A refusal the caller can act on (no such page, the destination exists); routers map it to a TRPCError. */
export class PageOperationError extends Error {
  constructor(
    readonly code: PageOperationErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PageOperationError";
  }
}

export interface MoveOneResult {
  oldTitle: string;
  newTitle: string;
  oldSlug: string;
  newSlug: string;
  redirectArticleId: string | null;
  movedArticleId: string;
  linksUpdated: number;
}

export interface MovePageResult extends MoveOneResult {
  success: boolean;
  /** The talk page that moved with the page, or null when none did. */
  talk: MoveOneResult | null;
}

export interface MovePageOptions {
  /** Leave `#REDIRECT [[new]]` at the old title (default true). */
  leaveRedirect?: boolean;
  /** Move the talk page along when it exists and the destination talk page does not (default true). */
  moveTalk?: boolean;
  /**
   * May a deleted (archived) page be moved (default false: to the mover it does not exist)? Only for a
   * caller who holds both `deletedhistory` and `undelete`. No redirect is left for a deleted page.
   */
  includeArchived?: boolean;
}

/** The protections that follow a page when it moves; create-protection belongs to the title, so it stays. */
const PORTABLE_RESTRICTIONS = ["edit", "move", "upload"];

/** What `WikiArticle.protectionLevel` shows for a restriction level: ALL | AUTOCONFIRMED | SYSOP. */
export function legacyProtectionLevel(level: string | undefined): string {
  if (level === "autoconfirmed") return "AUTOCONFIRMED";
  return level ? "SYSOP" : "ALL";
}

export interface MediaUsageItem {
  articleId: string;
  articleSlug: string;
  articleTitle: string;
  status: string;
  snippet?: string;
}

/** The canonical title of the talk page of `title`, or null when it has none (a talk page, Special:, another wiki's page). */
export function talkTitleOf(title: string, realm = "ixwiki"): string | null {
  const canon = canonicalizeTitle(title, { source: realm });
  if (!canon || realm !== "ixwiki" || canon.namespaceId < 0 || canon.namespaceId % 2 === 1) {
    return null;
  }
  const prefix = NAMESPACE_CANONICAL_NAMES[canon.namespaceId + 1];
  return prefix ? `${prefix}:${canon.base}` : null;
}

/** The page `ref` (a slug or a title) names in `realm`, inside `client`. */
function findPage(client: Prisma.TransactionClient, ref: string, realm: string) {
  return client.wikiArticle.findFirst({
    where: { source: realm, OR: [{ slug: toArticleSlug(ref) }, { title: ref.replace(/_/g, " ") }] },
    // Never the wikitext, the raw HTML or the rendered view bundle: a page operation needs none of them.
    select: { id: true, title: true, namespace: true, status: true },
  });
}

function redirectWikitext(target: CanonicalTitle): string {
  return `#REDIRECT [[${target.title}]]`;
}

export class PageManagementService {
  /**
   * Atomic Page Move / Rename with Redirect Creation & Link Graph Updates. The page keeps its row,
   * so its revisions, categories and watchers stay attached; the old title gets a redirect page
   * (with its own `#REDIRECT` revision) when `leaveRedirect`; the talk page moves too when `moveTalk`.
   */
  static async movePage(
    oldSlugOrTitle: string,
    newTitle: string,
    reason: string,
    actor: PageActor,
    realm = "ixwiki",
    { leaveRedirect = true, moveTalk = true, includeArchived = false }: MovePageOptions = {}
  ): Promise<MovePageResult> {
    const target = canonicalizeTitle(newTitle, { source: realm });
    if (!target) throw new PageOperationError("BAD_REQUEST", "Invalid title");
    if (toArticleSlug(oldSlugOrTitle) === target.slug) {
      throw new PageOperationError("BAD_REQUEST", "Old and new page names are identical.");
    }

    const result = await db.$transaction(async (tx) => {
      const move = { reason, actor, realm, leaveRedirect, includeArchived };
      const moved = await this.moveOne(tx, oldSlugOrTitle, target, move);
      const fromTalk = moveTalk ? talkTitleOf(oldSlugOrTitle, realm) : null;
      const toTalk = moveTalk ? talkTitleOf(target.title, realm) : null;
      const talkTarget = toTalk ? canonicalizeTitle(toTalk, { source: realm }) : null;
      const talk =
        fromTalk &&
        talkTarget &&
        (await this.canMoveTalk(tx, fromTalk, talkTarget, realm, includeArchived))
          ? await this.moveOne(tx, fromTalk, talkTarget, move)
          : null;
      return { success: true, ...moved, talk };
    });
    // The move jobs are committed with it: let the mirror worker send them to MediaWiki in a moment.
    scheduleMirrorKick();

    // A moved page is stale under its new name: render it off the read path, and forget what the
    // caches hold under either of its names (the old one is a redirect now).
    for (const moved of [result, result.talk]) {
      if (!moved) continue;
      enqueueRender(moved.movedArticleId);
      await evictWikiTitleCaches(moved.oldTitle, realm, moved.movedArticleId);
      await evictWikiTitleCaches(moved.newTitle, realm, moved.movedArticleId);
      // A moved template or module: its users render with the new name, or find the old one a redirect.
      void invalidateTemplateDependents(moved.oldTitle, realm);
      void invalidateTemplateDependents(moved.newTitle, realm);
      // watchlist: the page's watchers stay with its row: tell them it moved (the mover is left out).
      notifyWatchersInBackground({
        kind: "moved",
        articleId: moved.movedArticleId,
        title: moved.newTitle,
        fromTitle: moved.oldTitle,
        editor: actor.name,
        editorUserId: actor.userId,
        summary: reason,
      });
    }
    return result;
  }

  /** Whether the talk page `fromTalk` exists and the destination talk page is free. */
  private static async canMoveTalk(
    tx: Prisma.TransactionClient,
    fromTalk: string,
    talkTarget: CanonicalTitle,
    realm: string,
    includeArchived: boolean
  ): Promise<boolean> {
    const [source, destination] = await Promise.all([
      findPage(tx, fromTalk, realm),
      findPage(tx, talkTarget.title, realm),
    ]);
    const movable = source !== null && (includeArchived || source.status !== "ARCHIVED");
    return movable && destination === null;
  }

  private static async moveOne(
    tx: Prisma.TransactionClient,
    oldSlugOrTitle: string,
    target: CanonicalTitle,
    {
      reason,
      actor,
      realm,
      leaveRedirect,
      includeArchived,
    }: {
      reason: string;
      actor: PageActor;
      realm: string;
      leaveRedirect: boolean;
      includeArchived: boolean;
    }
  ): Promise<MoveOneResult> {
    const { title: newCanonicalTitle, slug: newSlug } = target;
    const oldSlug = toArticleSlug(oldSlugOrTitle);

    // 1. Fetch original article
    const original = await findPage(tx, oldSlugOrTitle, realm);
    if (!original) {
      throw new PageOperationError(
        "NOT_FOUND",
        `Article "${oldSlugOrTitle}" not found in realm "${realm}".`
      );
    }

    // A deleted page does not exist for a mover who may not see deleted pages.
    if (original.status === "ARCHIVED" && !includeArchived) {
      throw new PageOperationError(
        "NOT_FOUND",
        `Article "${oldSlugOrTitle}" not found in realm "${realm}".`
      );
    }

    // 2. Check if target title already exists
    const existingTarget = await tx.wikiArticle.findFirst({
      where: { source: realm, OR: [{ slug: newSlug }, { title: newCanonicalTitle }] },
      select: { id: true },
    });
    if (existingTarget && existingTarget.id !== original.id) {
      throw new PageOperationError(
        "CONFLICT",
        `Destination title "${newCanonicalTitle}" already exists.`
      );
    }

    // 3. Protections follow the page; the mirrored protectionLevel follows its edit protection
    const edit = await this.moveRestrictions(tx, realm, original.title, newCanonicalTitle);

    // 4. Update original article to new title and slug
    const movedArticle = await tx.wikiArticle.update({
      where: { id: original.id },
      data: {
        title: newCanonicalTitle,
        slug: newSlug,
        namespace: target.namespaceId,
        namespacePrefix: target.namespacePrefix,
        protectionLevel: legacyProtectionLevel(edit?.level),
        protectionExpiry: edit?.expiresAt ?? null,
        // The page's name is part of how it renders ({{PAGENAME}}, the display title): stale.
        htmlSyncedAt: null,
        lastEditorId: actor.userId,
        updatedAt: new Date(),
      },
      select: { id: true },
    });

    // 5. Create a redirect at the old location: a page with its own `#REDIRECT` revision
    // (none for a deleted page: there is nothing to redirect to)
    const redirectArticleId =
      leaveRedirect && original.status !== "ARCHIVED"
        ? await this.createRedirect(tx, original, oldSlug, target, actor, realm)
        : null;

    // 6. Update Link Graph: Repoint incoming links to new article ID
    const linkUpdateResult = await tx.wikiLink.updateMany({
      where: { targetArticleId: original.id },
      data: { targetArticleId: movedArticle.id },
    });

    // 7. Log the move action
    const log = await tx.wikiLog.create({
      data: {
        logType: "move",
        action: "move",
        title: newCanonicalTitle,
        actorName: actor.name,
        comment: reason,
        params: {
          oldTitle: original.title,
          oldSlug,
          newTitle: newCanonicalTitle,
          newSlug,
          reason,
          redirectCreated: redirectArticleId !== null,
        },
        userId: actor.userId,
        articleId: movedArticle.id,
      },
      select: { id: true },
    });

    // 8. The move for classic MediaWiki, in the same transaction. A deleted page is not there to move.
    if (original.status !== "ARCHIVED") {
      await enqueueMoveJob(tx, {
        title: original.title,
        articleId: movedArticle.id,
        logId: log.id,
        source: realm,
        to: newCanonicalTitle,
        reason,
        leaveRedirect: redirectArticleId !== null,
      });
    }

    return {
      oldTitle: original.title,
      newTitle: newCanonicalTitle,
      oldSlug,
      newSlug,
      redirectArticleId,
      movedArticleId: movedArticle.id,
      linksUpdated: linkUpdateResult.count,
    };
  }

  /**
   * Move the page's edit/move/upload protections from `oldTitle` to `newTitle` (create-protection stays
   * with the title). Rows already at the destination are stale and replaced. Returns the moved edit
   * restriction, if any.
   */
  static async moveRestrictions(
    tx: Prisma.TransactionClient,
    realm: string,
    oldTitle: string,
    newTitle: string
  ): Promise<{ level: string; expiresAt: Date | null } | null> {
    const action = { in: PORTABLE_RESTRICTIONS };
    await tx.wikiRestriction.deleteMany({ where: { source: realm, title: newTitle, action } });
    await tx.wikiRestriction.updateMany({
      where: { source: realm, title: oldTitle, action },
      data: { title: newTitle },
    });
    return tx.wikiRestriction.findUnique({
      where: { source_title_action: { source: realm, title: newTitle, action: "edit" } },
      select: { level: true, expiresAt: true },
    });
  }

  private static async createRedirect(
    tx: Prisma.TransactionClient,
    original: { title: string; namespace: number },
    oldSlug: string,
    target: CanonicalTitle,
    actor: PageActor,
    realm: string
  ): Promise<string> {
    const wikitext = redirectWikitext(target);
    const summary = `Redirected to [[${target.title}]] via page move`;
    const redirectArticle = await tx.wikiArticle.create({
      data: {
        title: original.title,
        slug: oldSlug,
        source: realm,
        namespace: original.namespace,
        status: "PUBLISHED",
        format: "WIKITEXT",
        wikitext,
        contentHtml: `<div class="redirect-banner">Redirect to <a href="/wiki/${target.slug}">${target.title}</a></div>`,
        // The column holds the target's canonical TITLE (plan 402); the move reason stays off the article excerpt.
        redirectTargetSlug: target.title,
        summary: null,
        authorId: actor.userId,
        lastEditorId: actor.userId,
      },
      select: { id: true },
    });
    const byteSize = Buffer.byteLength(wikitext, "utf8");
    await tx.wikiRevision.create({
      data: {
        articleId: redirectArticle.id,
        wikitext,
        summary,
        source: realm,
        author: actor.name,
        authorId: actor.userId,
        byteSize,
        byteDelta: byteSize,
      },
    });
    return redirectArticle.id;
  }

  /**
   * Soft Delete / Archive an Article (MediaWiki "delete"; revisions stay, readers get NOT_FOUND).
   */
  static async archiveArticle(
    slugOrTitle: string,
    reason: string,
    actor: PageActor,
    realm = "ixwiki"
  ): Promise<{ success: boolean; articleId: string }> {
    const { title, articleId } = await db.$transaction(async (tx) => {
      const article = await findPage(tx, slugOrTitle, realm);
      if (!article) {
        throw new PageOperationError("NOT_FOUND", `Article "${slugOrTitle}" not found.`);
      }
      if (article.status === "ARCHIVED") {
        throw new PageOperationError("CONFLICT", `"${article.title}" is already deleted.`);
      }

      await tx.wikiArticle.update({
        where: { id: article.id },
        data: { status: "ARCHIVED", lastEditorId: actor.userId, updatedAt: new Date() },
        select: { id: true },
      });
      const log = await tx.wikiLog.create({
        data: {
          logType: "delete",
          action: "delete",
          title: article.title,
          actorName: actor.name,
          comment: reason,
          params: { reason, previousStatus: article.status },
          userId: actor.userId,
          articleId: article.id,
        },
        select: { id: true },
      });
      await enqueueDeleteJob(tx, "delete", {
        title: article.title,
        articleId: article.id,
        logId: log.id,
        source: realm,
        reason,
      });
      return { title: article.title, articleId: article.id };
    });
    scheduleMirrorKick();
    // A deleted page must not be read out of a cache.
    await evictWikiTitleCaches(title, realm, articleId);
    // A deleted template or module: the pages that use it render without it.
    void invalidateTemplateDependents(title, realm);
    // watchlist: tell the page's watchers it is gone (the deleter is left out).
    notifyWatchersInBackground({
      kind: "deleted",
      articleId,
      title,
      editor: actor.name,
      editorUserId: actor.userId,
      summary: reason,
    });
    return { success: true, articleId };
  }

  /**
   * Restore an Archived Article (MediaWiki "undelete").
   */
  static async restoreArticle(
    slugOrTitle: string,
    actor: PageActor,
    realm = "ixwiki",
    reason = "Restored from archive"
  ): Promise<{ success: boolean; articleId: string }> {
    const { title, articleId } = await db.$transaction(async (tx) => {
      const article = await findPage(tx, slugOrTitle, realm);
      if (!article) {
        throw new PageOperationError("NOT_FOUND", `Archived article "${slugOrTitle}" not found.`);
      }
      if (article.status !== "ARCHIVED") {
        throw new PageOperationError("CONFLICT", `"${article.title}" is not deleted.`);
      }

      await tx.wikiArticle.update({
        where: { id: article.id },
        data: {
          status: "PUBLISHED",
          // Its view was built for a page that was out of the link graph, the category lists and the caches:
          // stale until the render queued below replaces it (readers see the old bundle meanwhile).
          htmlSyncedAt: null,
          lastEditorId: actor.userId,
          updatedAt: new Date(),
        },
        select: { id: true },
      });
      const log = await tx.wikiLog.create({
        data: {
          logType: "delete",
          action: "restore",
          title: article.title,
          actorName: actor.name,
          comment: reason,
          params: { reason, restoredFrom: "ARCHIVED" },
          userId: actor.userId,
          articleId: article.id,
        },
        select: { id: true },
      });
      await enqueueDeleteJob(tx, "undelete", {
        title: article.title,
        articleId: article.id,
        logId: log.id,
        source: realm,
        reason,
      });
      return { title: article.title, articleId: article.id };
    });
    scheduleMirrorKick();
    // The page was "missing" while deleted: forget that, and anything cached from before, and render it again off the read path.
    enqueueRender(articleId);
    await evictWikiTitleCaches(title, realm, articleId);
    // A restored template or module: the pages that use it render with it again.
    void invalidateTemplateDependents(title, realm);
    // watchlist: the page's watchers stayed with its row: tell them it is back (the restorer is left out).
    notifyWatchersInBackground({
      kind: "restored",
      articleId,
      title,
      editor: actor.name,
      editorUserId: actor.userId,
      summary: reason,
    });
    return { success: true, articleId };
  }

  /**
   * Reverse Media Asset Usage Lookups
   */
  static async getMediaUsage(assetFilenameOrSlug: string, limit = 50): Promise<MediaUsageItem[]> {
    const clean = assetFilenameOrSlug.replace(/^File:/i, "").trim();

    const articles = await db.wikiArticle.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { wikitext: { contains: clean, mode: "insensitive" } },
          { contentHtml: { contains: clean, mode: "insensitive" } },
          { leadImageUrl: { contains: clean, mode: "insensitive" } },
        ],
      },
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        wikitext: true,
      },
    });

    return articles.map((a) => ({
      articleId: a.id,
      articleSlug: a.slug,
      articleTitle: a.title,
      status: a.status,
      snippet: a.wikitext?.substring(0, 160),
    }));
  }

  /**
   * Maintenance Diagnostic: Orphan Pages (0 Incoming Links)
   */
  static async getOrphanPages(
    limit = 50,
    realm = "ixwiki"
  ): Promise<Array<{ id: string; title: string; slug: string; length: number }>> {
    try {
      const orphans = await db.wikiArticle.findMany({
        where: {
          source: realm,
          namespace: 0,
          status: "PUBLISHED",
          redirectTargetSlug: null,
          incomingLinks: {
            none: {},
          },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          wikitext: true,
        },
      });

      return (orphans || []).map((o) => ({
        id: o.id,
        title: o.title,
        slug: o.slug,
        length: o.wikitext ? o.wikitext.length : 0,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Maintenance Diagnostic: Dead-End Pages (0 Outgoing Links)
   */
  static async getDeadEndPages(
    limit = 50,
    realm = "ixwiki"
  ): Promise<Array<{ id: string; title: string; slug: string; length: number }>> {
    try {
      const deadEnds = await db.wikiArticle.findMany({
        where: {
          source: realm,
          namespace: 0,
          status: "PUBLISHED",
          redirectTargetSlug: null,
          outgoingLinks: {
            none: {},
          },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          wikitext: true,
        },
      });

      return (deadEnds || []).map((d) => ({
        id: d.id,
        title: d.title,
        slug: d.slug,
        length: d.wikitext ? d.wikitext.length : 0,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Maintenance Diagnostic: Broken Redirects. `redirectTargetSlug` holds the target's canonical
   * TITLE (the column name is historical), so a redirect is broken when no published article of
   * the same realm has that title. `targetSlug` in the result is that title.
   */
  static async getBrokenRedirects(
    limit = 50,
    realm = "ixwiki"
  ): Promise<Array<{ id: string; title: string; slug: string; targetSlug: string }>> {
    try {
      const redirects = await db.wikiArticle.findMany({
        where: {
          source: realm,
          redirectTargetSlug: { not: null },
        },
        take: limit * 2,
        select: {
          id: true,
          title: true,
          slug: true,
          redirectTargetSlug: true,
        },
      });

      if (!redirects || redirects.length === 0) return [];

      // A stored target is canonical when the app wrote it; canonicalizing again also covers
      // values the SQL backfill derived without a canonical namespace prefix.
      const withTargets = redirects.flatMap((r) =>
        r.redirectTargetSlug
          ? [
              {
                ...r,
                target:
                  canonicalizeTitle(r.redirectTargetSlug, { source: realm })?.title ??
                  r.redirectTargetSlug,
              },
            ]
          : []
      );

      const existingTargets = await db.wikiArticle.findMany({
        where: {
          source: realm,
          title: { in: withTargets.map((r) => r.target) },
          status: "PUBLISHED",
        },
        select: { title: true },
      });

      const validTargetSet = new Set(existingTargets.map((t) => t.title));

      return withTargets
        .filter((r) => !validTargetSet.has(r.target))
        .slice(0, limit)
        .map((r) => ({
          id: r.id,
          title: r.title,
          slug: r.slug,
          targetSlug: r.target,
        }));
    } catch {
      return [];
    }
  }
}

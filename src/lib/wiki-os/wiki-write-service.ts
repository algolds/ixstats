import { getWikiAuth } from "~/lib/wiki-os/auth";
import { getWikiDbPool } from "~/lib/wiki-bridge";
import { getUserSessionAndToken, invalidateCsrfToken } from "~/lib/wiki-os/csrf-cache";
import { invalidateCache } from "~/lib/wiki-os/parsoid-client";
import { invalidateArticleShadow, recordArticleRevision } from "~/lib/wiki-os/article-store";
import { db } from "~/server/db";
import { resolveActiveCountryId } from "~/lib/wiki-os/storage";
import { resolveWikiPlaceholdersInternal } from "~/server/api/routers/wiki";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";

export async function getOrCreateWikiActorId(pool: Pool, wikiUsername: string): Promise<number | null> {
  const [actorRows] = await pool.execute<RowDataPacket[]>(
    "SELECT actor_id FROM actor WHERE actor_name = ? LIMIT 1",
    [wikiUsername]
  );
  if (actorRows && actorRows.length > 0) {
    return actorRows[0]!.actor_id as number;
  }

  const [userRows] = await pool.execute<RowDataPacket[]>(
    "SELECT user_id FROM user WHERE user_name = ? LIMIT 1",
    [wikiUsername]
  );
  if (!userRows || userRows.length === 0) {
    console.error(`[WikiWriteService] MediaWiki user "${wikiUsername}" not found in user table`);
    return null;
  }
  const userId = userRows[0]!.user_id as number;

  try {
    const [insertResult] = await pool.execute<ResultSetHeader>(
      "INSERT INTO actor (actor_user, actor_name) VALUES (?, ?)",
      [userId, wikiUsername]
    );
    return insertResult.insertId;
  } catch (err: any) {
    const [retryRows] = await pool.execute<RowDataPacket[]>(
      "SELECT actor_id FROM actor WHERE actor_name = ? LIMIT 1",
      [wikiUsername]
    );
    if (retryRows && retryRows.length > 0) {
      return retryRows[0]!.actor_id as number;
    }
    console.error("[WikiWriteService] Failed to create actor row:", err);
    return null;
  }
}

export async function updateRevisionActor(revid: number, wikiUsername: string): Promise<boolean> {
  const pool = getWikiDbPool() as Pool;
  try {
    const actorId = await getOrCreateWikiActorId(pool, wikiUsername);
    if (!actorId) return false;

    const [userRows] = await pool.execute<RowDataPacket[]>(
      "SELECT user_id FROM user WHERE user_name = ? LIMIT 1",
      [wikiUsername]
    );
    const userId = userRows && userRows.length > 0 ? (userRows[0]!.user_id as number) : 0;

    await pool.execute("UPDATE revision SET rev_actor = ? WHERE rev_id = ?", [actorId, revid]);
    await pool.execute(
      "UPDATE recentchanges SET rc_actor = ?, rc_user = ?, rc_user_text = ? WHERE rc_this_oldid = ?",
      [actorId, userId, wikiUsername, revid]
    );

    const [revRows] = await pool.execute<RowDataPacket[]>(
      "SELECT rev_page, rev_timestamp FROM revision WHERE rev_id = ? LIMIT 1",
      [revid]
    );
    if (revRows && revRows.length > 0) {
      const pageId = revRows[0]!.rev_page as number;
      const timestamp = revRows[0]!.rev_timestamp as string;

      await pool.execute(
        "UPDATE logging SET log_actor = ?, log_user = ?, log_user_text = ? WHERE log_page = ? AND log_timestamp = ?",
        [actorId, userId, wikiUsername, pageId, timestamp]
      );
    }

    console.log(`[WikiWriteService] Updated revision ${revid} actor to "${wikiUsername}"`);
    return true;
  } catch (err) {
    console.error(`[WikiWriteService] Failed to update revision ${revid} actor:`, err);
    return false;
  }
}

export async function updateFileUploadActor(filename: string, wikiUsername: string): Promise<boolean> {
  const pool = getWikiDbPool() as Pool;
  try {
    const actorId = await getOrCreateWikiActorId(pool, wikiUsername);
    if (!actorId) return false;

    const [userRows] = await pool.execute<RowDataPacket[]>(
      "SELECT user_id FROM user WHERE user_name = ? LIMIT 1",
      [wikiUsername]
    );
    const userId = userRows && userRows.length > 0 ? (userRows[0]!.user_id as number) : 0;

    const dbFilename = filename.replace(/ /g, "_");
    await pool.execute(
      "UPDATE image SET img_actor = ?, img_user = ?, img_user_text = ? WHERE img_name = ?",
      [actorId, userId, wikiUsername, dbFilename]
    );

    const [pageRows] = await pool.execute<RowDataPacket[]>(
      "SELECT page_id, page_latest FROM page WHERE page_title = ? AND page_namespace = 6 LIMIT 1",
      [dbFilename]
    );
    if (pageRows && pageRows.length > 0) {
      const pageId = pageRows[0]!.page_id as number;
      const latestRev = pageRows[0]!.page_latest as number;

      await pool.execute("UPDATE revision SET rev_actor = ? WHERE rev_id = ?", [actorId, latestRev]);
      await pool.execute(
        "UPDATE recentchanges SET rc_actor = ?, rc_user = ?, rc_user_text = ? WHERE rc_this_oldid = ?",
        [actorId, userId, wikiUsername, latestRev]
      );
      await pool.execute(
        "UPDATE logging SET log_actor = ?, log_user = ?, log_user_text = ? WHERE log_namespace = 6 AND log_title = ?",
        [actorId, userId, wikiUsername, dbFilename]
      );
    }

    console.log(`[WikiWriteService] Updated file upload "${filename}" actor to "${wikiUsername}"`);
    return true;
  } catch (err) {
    console.error(`[WikiWriteService] Failed to update file upload "${filename}" actor:`, err);
    return false;
  }
}

export function cleanHtmlForParsoid(html: string): string {
  let cleaned = html;
  cleaned = cleaned.replace(
    /<a[^>]*href="([^"]*Coords[^"]*)"[^>]*>(?:<span[^>]*>📍<\/span>)?\s*(.*?)<\/a>/gi,
    (match: string, href: string, label: string) => {
      const cleanLabel = label.replace(/📍/g, "").trim();
      return `<a href="${href}">${cleanLabel}</a>`;
    }
  );
  cleaned = cleaned.replace(
    /<a[^>]*href="([^"]*MapEmbed[^"]*)"[^>]*>(?:<span[^>]*>🗺️<\/span>)?\s*(.*?)<\/a>/gi,
    (match: string, href: string, label: string) => {
      const cleanLabel = label.replace(/🗺️/g, "").trim();
      return `<a href="${href}">${cleanLabel}</a>`;
    }
  );
  return cleaned;
}

export async function notifyStashOwners(
  pageTitle: string,
  editorUserId: string | null | undefined,
  revisionId: number | null
): Promise<void> {
  const stashItems = await db.loreStashItem.findMany({
    where: { pageTitle },
    include: { stash: { select: { userId: true } } },
  });

  const userIds = [...new Set(stashItems.map((i) => i.stash.userId))].filter(
    (uid) => uid !== editorUserId
  );

  if (userIds.length === 0) return;

  const pageSlug = encodeURIComponent(pageTitle.replace(/ /g, "_"));
  const href = revisionId
    ? `/wiki/diff?from=${revisionId - 1}&to=${revisionId}`
    : `/wiki/${pageSlug}`;

  await db.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title: `"${pageTitle}" was edited`,
      description: `A page in your stash was updated.`,
      type: "wiki_edit",
      category: "wiki",
      href,
      metadata: JSON.stringify({ pageTitle, revisionId }),
    })),
  });
}

export async function syncCustomTemplates(wikitext: string, ctx: any): Promise<void> {
  const regex = /\{\{((?:MyCountry|CountryData|BusinessData):[^\}\n]+?)\}\}/gi;
  const placeholders = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(wikitext)) !== null) {
    if (match[1]) {
      placeholders.add(match[1]);
    }
  }

  if (placeholders.size === 0) return;

  const keys = Array.from(placeholders);
  const activeCountryId = (await resolveActiveCountryId(ctx)) ?? undefined;
  const resolved = await resolveWikiPlaceholdersInternal(keys, ctx, activeCountryId);

  for (const key of keys) {
    const data = resolved[key];
    const valStr = data ? data.value : "N/A";
    const normalizedKey = key.replace(/ /g, "_");
    const templateTitle = `Template:${normalizedKey}`;
    const templateWikitext = `<span class="wikios-stat-placeholder" data-key="${normalizedKey}">${valStr}</span>`;

    try {
      let currentContent = "";
      try {
        const [rows] = await (getWikiDbPool() as Pool).execute<RowDataPacket[]>(
          `SELECT t.old_text FROM page p
           JOIN slots s ON s.slot_revision_id = p.page_latest
           JOIN content c ON c.content_id = s.slot_content_id
           JOIN text t ON t.old_id = SUBSTRING(c.content_address, 4)
           WHERE p.page_title = ? AND p.page_namespace = 10 LIMIT 1`,
          [templateTitle.replace(/ /g, "_")]
        );
        if (rows && rows.length > 0) {
          currentContent = String(rows[0]!.old_text);
        }
      } catch (_err) {}

      if (currentContent.trim() !== templateWikitext.trim()) {
        await saveToMediaWiki(
          templateTitle,
          templateWikitext,
          "Update dynamic stat template value",
          true,
          ctx,
          undefined,
          true
        );
      }
    } catch (err: any) {
      console.error(`[WikiWriteService] Failed to sync template ${templateTitle}:`, err.message);
    }
  }
}

export async function saveToMediaWiki(
  title: string,
  wikitext: string,
  summary: string,
  minor: boolean,
  ctx: any,
  basetimestamp?: string,
  isTemplateSync = false
): Promise<{ success: boolean; revisionId: number | null; editConflict?: boolean }> {
  const apiBase = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";
  const { cookies, csrfToken } = await getUserSessionAndToken(ctx);
  const { wikiUsername } = getWikiAuth(ctx);

  const editParams = new URLSearchParams({
    action: "edit",
    title,
    text: wikitext,
    summary: `${summary} (via WikiOS)`,
    token: csrfToken,
    format: "json",
  });
  if (minor) editParams.set("minor", "1");
  if (basetimestamp) {
    editParams.set("basetimestamp", basetimestamp);
    editParams.set("starttimestamp", new Date().toISOString());
  }

  const editRes = await fetch(apiBase, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies.join("; "),
    },
    body: editParams.toString(),
  });

  const editData = (await editRes.json()) as {
    edit?: { result: string; newrevid?: number };
    error?: { code: string; info: string };
  };

  if (editData.error) {
    if (editData.error.code === "editconflict") {
      return { success: false, revisionId: null, editConflict: true };
    }
    if (editData.error.code === "badtoken") {
      invalidateCsrfToken();
    }
    throw new Error(`MediaWiki edit failed: ${editData.error.info}`);
  }

  const revId = editData.edit?.newrevid ?? null;

  if (revId && wikiUsername) {
    await updateRevisionActor(revId, wikiUsername);
  }

  invalidateCache(title);

  const { userId } = getWikiAuth(ctx);
  const editor = wikiUsername ?? userId;
  void recordArticleRevision({
    title,
    wikitext,
    mwRevId: revId,
    author: editor,
    summary,
    minor,
  }).then((ok) => {
    if (!ok) void invalidateArticleShadow(title);
  });

  notifyStashOwners(title, userId, revId).catch((err: unknown) => {
    console.error("[WikiWriteService] Background op failed:", (err as Error).message);
  });

  if (!isTemplateSync && editData.edit?.result === "Success") {
    syncCustomTemplates(wikitext, ctx).catch((err) => {
      console.error("[WikiWriteService] Background template sync failed:", err);
    });
  }

  return {
    success: editData.edit?.result === "Success",
    revisionId: revId,
  };
}

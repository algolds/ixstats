import { getWikiAuth, type WikiAuthContext } from "~/lib/wiki-os/auth";
import { DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { getWikiDbPool } from "./bridge";
import { getUserSessionAndToken, invalidateCsrfToken } from "~/lib/wiki-os/adapters/mediawiki/csrf-cache";
import { invalidateCache } from "./parsoid";
import { invalidateArticleShadow, recordArticleRevision } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { db } from "~/server/db";
import { resolveActiveCountryId } from "~/lib/wiki-os/storage";
import { resolveWikiPlaceholdersInternal } from "~/server/shared/wiki-placeholders";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import type { Prisma } from "@prisma/client";

export interface WikiWriteContext extends WikiAuthContext {
  user?: {
    id?: string | null;
    clerkUserId?: string | null;
    wikiUsername?: string | null;
    wikiUserId?: number | null;
    countryId?: string | null;
    country?: { id?: string; name?: string | null; flag?: string | null } | null;
    role?: { id?: string; name?: string | null; level?: number | null } | null;
  } | null;
  auth?: { userId: string | null } | null;
  headers?: Headers;
  db?: Prisma.TransactionClient | typeof db;
}

/**
 * Ensures a MediaWiki user and actor row exist in MySQL for the given username.
 */
export async function getOrCreateWikiActorId(
  pool: Pool,
  wikiUsername: string
): Promise<number | null> {
  const [actorRows] = await pool.execute<RowDataPacket[]>(
    "SELECT actor_id FROM actor WHERE actor_name = ? LIMIT 1",
    [wikiUsername]
  );
  if (actorRows && actorRows.length > 0) {
    return actorRows[0]!.actor_id as number;
  }

  let userId = 0;
  const [userRows] = await pool.execute<RowDataPacket[]>(
    "SELECT user_id FROM user WHERE user_name = ? LIMIT 1",
    [wikiUsername]
  );

  if (userRows && userRows.length > 0) {
    userId = userRows[0]!.user_id as number;
  } else {
    try {
      const [insertUserResult] = await pool.execute<ResultSetHeader>(
        "INSERT INTO user (user_name, user_real_name, user_password, user_email, user_touched, user_registration, user_editcount) VALUES (?, ?, '', '', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), 0)",
        [wikiUsername, wikiUsername]
      );
      userId = insertUserResult.insertId;
    } catch (_userErr: unknown) {
      const [retryUser] = await pool.execute<RowDataPacket[]>(
        "SELECT user_id FROM user WHERE user_name = ? LIMIT 1",
        [wikiUsername]
      );
      if (retryUser && retryUser.length > 0) {
        userId = retryUser[0]!.user_id as number;
      }
    }
  }

  try {
    const [insertResult] = await pool.execute<ResultSetHeader>(
      "INSERT INTO actor (actor_user, actor_name) VALUES (?, ?)",
      [userId || null, wikiUsername]
    );
    return insertResult.insertId;
  } catch (err: unknown) {
    const [retryRows] = await pool.execute<RowDataPacket[]>(
      "SELECT actor_id FROM actor WHERE actor_name = ? LIMIT 1",
      [wikiUsername]
    );
    if (retryRows && retryRows.length > 0) {
      return retryRows[0]!.actor_id as number;
    }
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
    const userId = userRows && userRows.length > 0 ? (userRows[0]!.user_id as number) : null;

    if (userId) {
      await pool.execute(
        "UPDATE user SET user_editcount = user_editcount + 1, user_touched = DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') WHERE user_id = ?",
        [userId]
      );
    }

    // Attribute revision to actor
    await pool.execute(
      "UPDATE revision SET rev_actor = ? WHERE rev_id = ?",
      [actorId, revid]
    );

    try {
      await pool.execute(
        "UPDATE recentchanges SET rc_actor = ? WHERE rc_this_oldid = ?",
        [actorId, revid]
      );
    } catch (_rcErr) {
      // recentchanges update is best effort
    }

    const [revRows] = await pool.execute<RowDataPacket[]>(
      "SELECT rev_page FROM revision WHERE rev_id = ? LIMIT 1",
      [revid]
    );
    if (revRows && revRows.length > 0) {
      const pageId = revRows[0]!.rev_page as number;
      await pool.execute(
        "UPDATE page SET page_touched = DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') WHERE page_id = ?",
        [pageId]
      );
    }

    return true;
  } catch (err) {
    console.error("[WikiWriteService] Error updating revision actor:", err);
    return false;
  }
}

export interface MediaWikiWriteResult {
  success: boolean;
  pageId?: number;
  title?: string;
  revisionId?: number;
  noChange?: boolean;
  result?: Record<string, unknown>;
  error?: string;
}

export async function executeMediaWikiWrite(
  params: Record<string, string | number>,
  ctxOrSource?: WikiWriteContext | string
): Promise<MediaWikiWriteResult> {
  const ctx = typeof ctxOrSource === "object" ? ctxOrSource : undefined;
  const { cookies, csrfToken } = await getUserSessionAndToken(ctx);
  const sessionCookie = cookies.join("; ");

  const bodyParams = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    bodyParams.set(key, String(val));
  }
  bodyParams.set("token", csrfToken);
  bodyParams.set("format", "json");
  bodyParams.set("formatversion", "2");

  const apiBase = process.env.WIKIOS_MEDIAWIKI_API ?? "https://ixwiki.com/api.php";
  const res = await fetch(apiBase, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      "User-Agent": DEFAULT_USER_AGENT,
    },
    body: bodyParams,
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    throw new Error(`MediaWiki write failed (${res.status})`);
  }

  const data = (await res.json()) as {
    edit?: {
      result: string;
      pageid?: number;
      title?: string;
      newrevid?: number;
      nochange?: boolean;
      oldrevid?: number;
    };
    error?: { code: string; info: string };
  };

  if (data.error) {
    if (data.error.code === "badtoken") {
      invalidateCsrfToken();
    }
    throw new Error(data.error.info || `Action ${params.action} failed: ${data.error.code}`);
  }

  const edit = data.edit;
  const username = ctx?.user?.wikiUsername;

  if (edit?.newrevid && username) {
    try {
      await updateRevisionActor(edit.newrevid, username);
    } catch (_attrErr) {
      // Actor attribution is best-effort
    }
  }

  return {
    success: edit?.result === "Success",
    pageId: edit?.pageid,
    title: edit?.title,
    revisionId: edit?.newrevid,
    noChange: edit?.nochange,
    result: data as any,
  };
}

export function cleanHtmlForParsoid(html: string): string {
  return html
    .replace(/<div\s+class="[^"]*toc[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<aside\s+class="[^"]*infobox[^"]*"[^>]*>[\s\S]*?<\/aside>/gi, "")
    .replace(/<div\s+class="[^"]*infobox[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<div\s+class="[^"]*wikios-country-profile[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
    .trim();
}

export async function saveToMediaWiki(
  title: string,
  wikitext: string,
  summary: string,
  minor: boolean,
  ctx?: any,
  basetimestamp?: string
): Promise<MediaWikiWriteResult> {
  const result = await executeMediaWikiWrite({
    action: "edit",
    title: title.replace(/_/g, " "),
    text: wikitext,
    summary: summary || "Edited via WikiOS",
    minor: minor ? 1 : 0,
    ...(basetimestamp ? { basetimestamp } : {}),
  }, ctx);

  invalidateCache(title);
  invalidateArticleShadow(title);

  return result;
}

import type { WikiAuthContext } from "~/lib/wiki-os/auth";
import { DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { getUserSessionAndToken, invalidateCsrfToken } from "~/lib/wiki-os/adapters/mediawiki/csrf-cache";
import { invalidateCache } from "./parsoid";
import { invalidateArticleShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import type { Prisma } from "@prisma/client";
import { type db } from "~/server/db";

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

export interface MediaWikiWriteResult {
  success: boolean;
  pageId?: number;
  title?: string;
  revisionId?: number;
  noChange?: boolean;
  result?: Record<string, unknown>;
  error?: string;
}

/**
 * Best-effort actor attribution logger for WikiOS edits.
 */
export async function updateRevisionActor(_revid: number, _wikiUsername: string): Promise<boolean> {
  // WikiOS revisions in PostgreSQL track author directly via WikiRevision.author
  return true;
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

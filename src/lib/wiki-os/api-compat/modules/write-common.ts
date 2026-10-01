/**
 * write-common.ts — what every writing action shares (plan 410): only a bot-password session may
 * write, with its CSRF token, and a page is named by `title` or `pageid`.
 */

import { tokenIsValid, type TokenType } from "../auth";
import { ApiError, invalidTitle, missingOneOf, missingParam, mixedParams } from "../errors";
import type { ApiParams } from "../params";
import type { ApiContext } from "../types";
import { getWikiActorLabel, requireWikiUserId } from "~/lib/wiki-os/auth";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import type { PageActor } from "~/lib/wiki-os/core/page-management-service";
import { PageOperationError } from "~/lib/wiki-os/core/page-management-service";
import type { PageRow } from "../store-types";

/** Characters of an edit summary or log reason MediaWiki keeps (a comment is at most 500). */
export const MAX_COMMENT_CHARS = 500;

/**
 * An edit summary or log reason as it is stored: NUL characters (which PostgreSQL text columns
 * refuse) gone, at most `MAX_COMMENT_CHARS` characters (a surrogate pair is never cut in half).
 */
export function cleanComment(raw: string): string {
  const text = raw.replaceAll("\u0000", "");
  if (text.length <= MAX_COMMENT_CHARS) return text;
  const cut = text.slice(0, MAX_COMMENT_CHARS);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/** A write needs a bot-password session: a signed-in browser or an anonymous caller may only read. */
export function requireBotSession(rc: ApiContext): void {
  if (rc.session.kind !== "bot") {
    throw new ApiError(
      "writeapidenied",
      "You're not allowed to edit this wiki through the API. Log in with a bot password."
    );
  }
}

/** The request's `token` must be the session's token of `type`. */
export function checkToken(rc: ApiContext, type: TokenType = "csrf"): void {
  const token = rc.params.string("token");
  if (token === undefined) throw missingParam("token");
  if (!tokenIsValid(rc.session, type, token)) {
    throw new ApiError("badtoken", `Invalid ${type === "csrf" ? "CSRF" : type} token.`);
  }
}


/** Who a log entry names as the actor. */
export function actorOf(rc: ApiContext): PageActor {
  return { userId: requireWikiUserId(rc.session.ctx), name: getWikiActorLabel(rc.session.ctx) };
}

export interface NamedPage {
  /** Canonical title. */
  title: string;
  /** The live page, or null when it does not exist (or is deleted). */
  row: PageRow | null;
}

/** A page as a request names it: by title or by page id, under these parameter names. */
export interface PageRef {
  rawTitle: string | undefined;
  pageId: number | undefined;
  /** The parameter names, for error messages. */
  names: { title: string; id: string };
}

/** Read the parameters that name a page (reading only: `resolvePage` judges them). */
export function readPageRef(p: ApiParams, names: { title: string; id: string }): PageRef {
  return { rawTitle: p.string(names.title), pageId: p.optionalInteger(names.id, 1), names };
}

/**
 * The page a write names by title or by page id (exactly one). A page id must exist
 * (`nosuchpageid`); a title only has to be valid.
 */
export async function resolvePage(rc: ApiContext, ref: PageRef): Promise<NamedPage> {
  const { rawTitle, pageId, names } = ref;
  if (rawTitle !== undefined && pageId !== undefined) throw mixedParams([names.title, names.id]);
  if (pageId !== undefined) {
    const [row] = await rc.deps.store.pagesById([pageId]);
    if (!row) throw new ApiError("nosuchpageid", `There is no page with ID ${pageId}.`);
    return { title: row.title, row };
  }
  if (rawTitle === undefined) throw missingOneOf([names.title, names.id]);
  const canon = canonicalizeTitle(rawTitle);
  if (!canon) throw invalidTitle(rawTitle);
  if (canon.namespaceId < 0) throw new ApiError("invalidtitle", `Special pages cannot be changed: ${canon.title}.`);
  const [row] = await rc.deps.store.pagesByTitle([canon.title]);
  return { title: canon.title, row: row ?? null };
}

/** Run a page operation, answering its refusals with the MediaWiki code the caller maps them to. */
export async function withPageCodes<T>(
  work: Promise<T>,
  codes: Partial<Record<PageOperationError["code"], string>>
): Promise<T> {
  try {
    return await work;
  } catch (error) {
    const code = error instanceof PageOperationError ? codes[error.code] : undefined;
    if (error instanceof PageOperationError && code) throw new ApiError(code, error.message);
    throw error;
  }
}

/**
 * The stored body of a forum write: light-editor HTML goes through `prepareBody` (sanitized last), Canvas wikitext
 * through render.ts (guards, per-user limit, MediaWiki render with the in-process fallback). Both end in the same
 * action-token check, so a token is plain text whatever the editor.
 */
import type { PrismaClient } from "@prisma/client";
import { countActionTokens, countTextActionTokens } from "~/lib/action-links";
import { getBasePath } from "~/lib/base-path";
import { guardWikitext } from "~/lib/thinkpages-forum/wikitext-guards";
import { hasImageSrc } from "~/lib/thinkpages-forum/html-urls";
import { sanitizeUserContent, stripHtml } from "~/lib/utils/sanitize-html";
import { ForumError } from "./errors";
import { renderPostWikitext } from "./render";

export const MAX_POST_HTML = 50_000;

/** Exactly one of `html` (light editor) or `wikitext` (Canvas) carries the text. */
export interface PostInput {
  html?: string;
  wikitext?: string;
  personaId?: string | null;
}

export interface PreparedBody {
  contentHtml: string;
  plainText: string;
}

export interface StoredBody extends PreparedBody {
  contentWikitext: string | null;
  rendererVersion: string | null;
  renderedAt: Date | null;
  templates: string[];
}

/** `"pending"`: the wiki was unavailable, so the stored HTML is a fallback until the stale cron re-renders it. */
export type Formatting = "done" | "pending";

/** A token inside a tag or attribute would never render as a card and must never be cut by the renderer. */
export function assertTokensArePlainText(contentHtml: string, plainText: string): void {
  const rendered = countTextActionTokens(contentHtml);
  if (rendered !== countActionTokens(contentHtml) || rendered !== countActionTokens(plainText)) {
    throw new ForumError("BAD_REQUEST", "Action links must be plain text in the post body");
  }
}

export function prepareBody(html: string): PreparedBody {
  if (html.length > MAX_POST_HTML) {
    throw new ForumError("BAD_REQUEST", `A post can be at most ${MAX_POST_HTML} characters.`);
  }
  const contentHtml = sanitizeUserContent(html);
  const plainText = stripHtml(contentHtml);
  // An image is content too (an image-only post), as the Realm Board archive keeps them.
  if (!plainText && !hasImageSrc(contentHtml, getBasePath())) {
    throw new ForumError("BAD_REQUEST", "A post needs some text.");
  }
  assertTokensArePlainText(contentHtml, plainText);
  return { contentHtml, plainText };
}

export async function bodyFromInput(
  input: PostInput,
  threadId: string,
  userId: string
): Promise<StoredBody> {
  if (input.wikitext !== undefined) {
    const rendered = await renderPostWikitext(input.wikitext, threadId, userId);
    assertTokensArePlainText(rendered.contentHtml, rendered.plainText);
    return {
      contentHtml: rendered.contentHtml,
      plainText: rendered.plainText,
      // The guarded text (the render passed it, so it cannot refuse): the stale cron re-renders what is stored.
      contentWikitext: guardWikitext(input.wikitext),
      rendererVersion: rendered.rendererVersion,
      renderedAt: rendered.renderedAt,
      templates: rendered.templates,
    };
  }
  if (input.html === undefined) throw new ForumError("BAD_REQUEST", "A post needs some text.");
  return {
    ...prepareBody(input.html),
    contentWikitext: null,
    rendererVersion: null,
    renderedAt: null,
    templates: [],
  };
}

export function formattingOf(body: StoredBody): Formatting {
  return body.contentWikitext !== null && body.renderedAt === null ? "pending" : "done";
}

/** The columns a post row takes from a body (`templates` are separate rows). */
export function postColumns(body: StoredBody) {
  return {
    contentHtml: body.contentHtml,
    plainText: body.plainText,
    contentWikitext: body.contentWikitext,
    rendererVersion: body.rendererVersion,
    renderedAt: body.renderedAt,
  };
}

/** Writes the templates a render used (inside the post's transaction); `replace` drops the previous ones first. */
export async function writeTemplates(
  tx: Pick<PrismaClient, "forumPostTemplate">,
  postId: string,
  templates: string[],
  replace: boolean
): Promise<void> {
  if (replace) await tx.forumPostTemplate.deleteMany({ where: { postId } });
  if (templates.length > 0) {
    await tx.forumPostTemplate.createMany({
      data: templates.map((title) => ({ postId, title })),
      skipDuplicates: true,
    });
  }
}

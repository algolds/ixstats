/**
 * Canvas posts render once at save, through the same MediaWiki parse and view-bundle pipeline as WikiOS articles
 * (spec §3), so a post looks exactly like the wiki. MediaWiki unavailable: the in-process compiler's render is stored
 * with renderedAt = null and the stale cron (render-stale.ts) replaces it. Reads never call MediaWiki.
 */
import { renderArticleViaMediaWiki } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import { OutboundLimiter, ThrottledError } from "~/lib/wiki-os/services/outbound-limiter";
import {
  buildViewBundle,
  RENDERER_VERSION,
  type ViewBundle,
} from "~/lib/wiki-os/services/view-bundle";
import { cleanWikiMarkup, parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";
import { stripPositioning } from "~/lib/thinkpages-forum/strip-positioning";
import { guardWikitext, WikitextRefusal } from "~/lib/thinkpages-forum/wikitext-guards";
import { ForumError } from "./errors";

export const FORUM_RENDERER_VERSION = `forum-4:${RENDERER_VERSION}`;
const PER_USER_PER_MINUTE = 10;

export interface RenderedPost {
  contentHtml: string;
  plainText: string;
  rendererVersion: string;
  renderedAt: Date | null;
  templates: string[];
}

function newEngine(): OutboundLimiter {
  return new OutboundLimiter({ name: "forum-render", maxConcurrent: 2, perMinute: 120 });
}

// ponytail: per-process limits; a shared Redis limiter if the app runs more than one process.
let engine = newEngine();
let perUser = new Map<string, number[]>();

export function resetRenderLimitsForTests(): void {
  engine = newEngine();
  perUser = new Map();
}

const SWEEP_ABOVE_USERS = 1_000;

function sweepStaleUsers(now: number): void {
  for (const [id, times] of perUser) {
    if (times.every((t) => now - t >= 60_000)) perUser.delete(id);
  }
}

export function renderLimitUsersForTests(): number {
  return perUser.size;
}

function takeUserSlot(userId: string): void {
  const now = Date.now();
  const recent = (perUser.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= PER_USER_PER_MINUTE) {
    throw new ForumError(
      "TOO_MANY_REQUESTS",
      "You're posting faster than the wiki can format. Try again in a few seconds."
    );
  }
  recent.push(now);
  perUser.set(userId, recent);
  if (perUser.size > SWEEP_ABOVE_USERS) sweepStaleUsers(now);
}

export function composePostHtml(bundle: ViewBundle): string {
  const notices = bundle.noticesHtml
    ? `<div class="wikios-notices-container">${bundle.noticesHtml}</div>`
    : "";
  const infobox = bundle.infoboxHtml
    ? `<div class="forum-infobox">${bundle.infoboxHtml}</div>`
    : "";
  return stripPositioning(
    `<div class="mw-parser-output">${notices}${infobox}${bundle.bodyHtml}</div>`
  );
}

function fallback(wikitext: string): RenderedPost {
  const contentHtml = stripPositioning(
    `<div class="mw-parser-output">${sanitizeWikiArticleHtml(parseWikitextToHtml(wikitext))}</div>`
  );
  return {
    contentHtml,
    plainText: cleanWikiMarkup(wikitext),
    rendererVersion: FORUM_RENDERER_VERSION,
    renderedAt: null,
    templates: [],
  };
}

/** One MediaWiki render (behind the engine limiter); null when MediaWiki is down or the limiter is full. */
export async function renderViaWiki(
  wikitext: string,
  threadId: string
): Promise<RenderedPost | null> {
  const page = await engine
    .run(() => renderArticleViaMediaWiki(wikitext, `ThinkPages:${threadId}`))
    .catch((error: Error) => {
      if (error instanceof ThrottledError) return null;
      throw error;
    });
  if (!page) return null;
  return {
    contentHtml: composePostHtml(buildViewBundle(page.html)),
    plainText: cleanWikiMarkup(wikitext),
    rendererVersion: FORUM_RENDERER_VERSION,
    renderedAt: new Date(),
    templates: (page.metadata.templates ?? []).map((t) => t.title),
  };
}

export async function renderPostWikitext(
  raw: string,
  threadId: string,
  userId: string
): Promise<RenderedPost> {
  let wikitext: string;
  try {
    wikitext = guardWikitext(raw);
  } catch (error) {
    if (error instanceof WikitextRefusal) throw new ForumError("BAD_REQUEST", error.message);
    throw error;
  }
  takeUserSlot(userId);
  return (await renderViaWiki(wikitext, threadId)) ?? fallback(wikitext);
}

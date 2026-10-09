/**
 * Action-linked posts (spec docs/superpowers/specs/2026-10-07-action-linked-posts-design.md): a post
 * embeds one of its country's ActivityFeed entries as `[ixaction=<id>]`. Pure helpers only; the
 * ownership check and persistence live in `~/server/modules/action-links`.
 */
import { IxTime } from "~/lib/ixtime";

export const MAX_ACTIONS_PER_POST = 10;

/**
 * Where a linked post lives. "xenforo" rows predate the native forum: the XenForo import remaps them to "native"
 * (and its rollback restores them), so the type stays while such rows may exist; nothing creates new ones.
 */
export type PostSource = "native" | "xenforo";

const TOKEN = /\[ixaction=([A-Za-z0-9_-]{1,64})\]/g;

/** Distinct activity ids embedded in `body`, in first-seen order. Callers enforce MAX_ACTIONS_PER_POST. */
export function parseActionTokens(body: string): string[] {
  return [...new Set(Array.from(body.matchAll(TOKEN), (m) => m[1]!))];
}

/**
 * One run of an HTML string: a whole tag or comment (`markup`), or the text between two of them. Tokens are only
 * ever cut inside text runs, so a token sitting in an attribute value never splits a tag in two.
 */
interface HtmlRun {
  markup: boolean;
  text: string;
}

// A whole start or end tag (quoted attribute values may hold `>`), or a comment. Sanitized output quotes every
// attribute and escapes `<` in text as `&lt;` (DOMPurify drops comments under sanitizeUserContent's tag list), so
// every literal `<` begins one of these.
const MARKUP = /<!--[\s\S]*?-->|<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^>"'])*>/g;
const TAG_NAME = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/;
const VOID_TAGS = new Set([
  "area",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

function htmlRuns(html: string): HtmlRun[] {
  const runs: HtmlRun[] = [];
  let last = 0;
  for (const m of html.matchAll(MARKUP)) {
    if (m.index > last) runs.push({ markup: false, text: html.slice(last, m.index) });
    runs.push({ markup: true, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < html.length) runs.push({ markup: false, text: html.slice(last) });
  return runs;
}

/** `html` with `markup` applied to every tag and comment and `text` to every run between them (each defaults to as-is). */
export function mapHtmlRuns(
  html: string,
  map: { markup?: (tag: string) => string; text?: (text: string) => string }
): string {
  return htmlRuns(html)
    .map((run) => (run.markup ? (map.markup ?? String)(run.text) : (map.text ?? String)(run.text)))
    .join("");
}

/** `text` with every `[ixaction=<id>]` removed, again until none is left (a removal can join a new one). */
export function withoutActionTokens(text: string): string {
  let out = text;
  let previous: string;
  do {
    previous = out;
    out = out.replace(TOKEN, "");
  } while (out !== previous);
  return out;
}

/**
 * `html` with every action token cut out of its tags, comments and attribute values; tokens in text stay. Callers
 * sanitize after this (never before): cutting a token out of an attribute can form a new URL
 * (`java[ixaction=a]script:`), which only a later pass refuses.
 */
export function withoutTokensInTags(html: string): string {
  return mapHtmlRuns(html, { markup: withoutActionTokens });
}

/** A text run that may be cut: one holding a stray `<` never is, so no half-tag can reach the page. */
const cuttable = (run: HtmlRun): boolean => !run.markup && !run.text.includes("<");

/** `[ixaction=<id>]` occurrences anywhere in `text`, tags and attribute values included. */
export function countActionTokens(text: string): number {
  return text.match(TOKEN)?.length ?? 0;
}

/** `[ixaction=<id>]` occurrences in the text of `html`, outside every tag and attribute: the ones that render. */
export function countTextActionTokens(html: string): number {
  return htmlRuns(html)
    .filter(cuttable)
    .reduce((n, run) => n + countActionTokens(run.text), 0);
}

export type BodySegment = { kind: "html"; text: string } | { kind: "action"; id: string };

interface OpenTag {
  name: string;
  tag: string;
}

interface Splitter {
  segments: BodySegment[];
  /** Elements open at this point of the body, outermost first. */
  open: OpenTag[];
  /** The html segment being built. */
  html: string;
  /** The segment holds text or an image, so it is worth keeping. */
  filled: boolean;
}

const hasText = (text: string): boolean => text.replace(/&nbsp;|&#160;/g, "").trim() !== "";

/** Keeps `open` in step with one tag: start tags push, end tags pop back to their match, void tags do nothing. */
function track(open: OpenTag[], tag: string): void {
  const m = TAG_NAME.exec(tag);
  if (!m) return;
  const name = m[2]!.toLowerCase();
  if (m[1]) {
    const at = open.map((o) => o.name).lastIndexOf(name);
    if (at >= 0) open.length = at;
  } else if (!VOID_TAGS.has(name) && !tag.endsWith("/>")) {
    open.push({ name, tag });
  }
}

function append(state: Splitter, run: HtmlRun): void {
  state.html += run.text;
  if (run.markup) track(state.open, run.text);
  state.filled ||= run.markup ? /^<img\b/i.test(run.text) : hasText(run.text);
}

/** Closes every open element, emits the action, and reopens them for the html after it. */
function cut(state: Splitter, id: string): void {
  const closing = state.open.map((o) => `</${o.name}>`).reverse();
  if (state.filled) state.segments.push({ kind: "html", text: state.html + closing.join("") });
  state.segments.push({ kind: "action", id });
  state.html = state.open.map((o) => o.tag).join("");
  state.filled = false;
}

/**
 * `body` (sanitized HTML) cut on the `[ixaction=<id>]` tokens in its text, in order. Every element open at a
 * token is closed before it and reopened after it, so each html segment is balanced: `<p>a [t] b</p>` gives
 * `<p>a </p>`, the action, `<p> b</p>`, at any depth (lists, quotes, headings, inline tags). Segments left with
 * no text or image are dropped.
 *
 * Security boundary: PostBody injects every html segment as markup, so a segment must never begin or end inside a
 * tag. Tokens inside a tag or attribute value are therefore never cut and stay inert attribute text.
 */
export function splitActionTokens(body: string): BodySegment[] {
  const state: Splitter = { segments: [], open: [], html: "", filled: false };
  for (const run of htmlRuns(body)) {
    if (!cuttable(run)) {
      append(state, run);
      continue;
    }
    run.text.split(TOKEN).forEach((part, i) => {
      if (i % 2 === 1) cut(state, part);
      else append(state, { markup: false, text: part });
    });
  }
  if (!state.segments.length) return body ? [{ kind: "html", text: body }] : [];
  if (state.filled) state.segments.push({ kind: "html", text: state.html });
  return state.segments;
}

/**
 * A linked post's permalink: native posts by the ThinkPages permalink; a XenForo post by its legacy `/forum/post/`
 * path, which 308s to the imported post (or the forum home) through the import id map.
 */
export function postPermalinkPath(source: PostSource, postRef: string): string {
  return source === "native"
    ? `/thinkpages/post/${encodeURIComponent(postRef)}`
    : `/forum/post/${encodeURIComponent(postRef)}`;
}

export interface ChainWikiEntry {
  title: string;
  type: string;
  ixTime: number;
  url: string;
}

const WIKITEXT_MARKUP = /[[\]{}|<>&]|'{2,}|~{3,}|_{2,}/g;

/**
 * Player text inside wikitext, as a single plain line: no link, template, table, entity, bold or
 * italic, signature or magic-word syntax survives, and no newline can start a new heading.
 */
function plain(text: string): string {
  let out = text;
  let prev: string;
  do {
    prev = out;
    out = out.replace(WIKITEXT_MARKUP, "");
  } while (out !== prev);
  return out.replace(/\s+/g, " ").trim();
}

/** The section appended to the chain's wiki page on approval. */
export function chainWikiSection(input: {
  title: string;
  approvedIxTime: number;
  entries: ChainWikiEntry[];
}): string {
  const lines = input.entries.map(
    (e) => `* ${IxTime.formatIxTime(e.ixTime)}: [${e.url} ${plain(e.title)}] (${plain(e.type)})`
  );
  return [
    `== Story chain: ${plain(input.title)} ==`,
    `''Recorded ${IxTime.formatIxTime(input.approvedIxTime)}.''`,
    ...lines,
  ].join("\n");
}

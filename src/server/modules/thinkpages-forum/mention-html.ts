/**
 * @mentions in a post's HTML (spec section 5). Server modules only: it loads parse5, the parser jsdom (and so the
 * sanitizer) parses with, and a browser must never bundle it; parse5 is read lazily, as `dom-depth.ts` does.
 *
 * The grammar (`~/lib/thinkpages-forum/mentions`) runs over the text nodes of the HTML, so a name in an attribute never
 * counts, and over nothing inside `a`, `code`, `pre`, `blockquote`, `style`, `script` or the other elements whose text
 * is not prose: the mention of a quote, a code sample or a link is not a mention. A body the parser nests too deep, or
 * that is larger than the sanitizer's ceiling, is not parsed at all (no mentions, no links). It is parsed as jsdom
 * parses it (scripting off, so the contents of a `<noscript>` are elements) and serialized the same way.
 *
 * A mention link is only ever made here. Whatever `a.forum-mention` a member sends is forged (`unwrapMentionAnchors`
 * runs before linking), and `mentionAnchorNames` trusts an anchor only when its href is the canonical profile path of
 * the name it shows.
 */
import type { DefaultTreeAdapterMap } from "parse5";
import { handleProfileHref, personaProfileHref } from "~/lib/thinkpages-forum/links";
import { MENTION_CLASS, MENTION_PATTERN, mentionNamesIn } from "~/lib/thinkpages-forum/mentions";
import { leavesAlone } from "~/lib/wiki-os/transformers/dom-depth";

type Parse5 = typeof import("parse5");
type Fragment = DefaultTreeAdapterMap["documentFragment"];
type Parent = DefaultTreeAdapterMap["parentNode"];
type TextNode = DefaultTreeAdapterMap["textNode"];
type Element = DefaultTreeAdapterMap["element"];

let parse5: Parse5 | null = null;
const parser = (): Parse5 => (parse5 ??= require("parse5") as Parse5);

/** jsdom parses with scripting off, so a `<noscript>` holds elements; parse and serialize alike. */
const SCRIPTING_OFF = { scriptingEnabled: false } as const;

/** Elements whose text is not prose (nor, for the raw-text ones, a place to put a link). */
const SKIPPED = new Set([
  "a",
  "code",
  "pre",
  "blockquote",
  "style",
  "script",
  "template",
  "textarea",
  "noscript",
  "xmp",
  "iframe",
  "noembed",
  "noframes",
  "plaintext",
  "title",
]);

function parse(html: string): Fragment | null {
  if (leavesAlone(html)) return null;
  return parser().parseFragment(html, SCRIPTING_OFF);
}

const serialize = (root: Fragment): string => parser().serialize(root, SCRIPTING_OFF);

function collectText(parent: Parent, found: TextNode[]): void {
  const adapter = parser().defaultTreeAdapter;
  for (const child of parent.childNodes) {
    if (adapter.isTextNode(child)) found.push(child);
    else if (adapter.isElementNode(child) && !SKIPPED.has(child.tagName)) collectText(child, found);
  }
}

/** The names mentioned in the eligible text of `html`, lower-cased, once each, in order. */
export function mentionNamesInHtml(html: string): string[] {
  if (!html.includes("@")) return [];
  const root = parse(html);
  if (!root) return [];
  const texts: TextNode[] = [];
  collectText(root, texts);
  return mentionNamesIn(texts.map((node) => node.value).join("\n"));
}

const classTokens = (element: Element): string[] =>
  (element.attrs.find((attr) => attr.name === "class")?.value ?? "").split(/\s+/).filter(Boolean);

const isMentionToken = (token: string): boolean => token.toLowerCase() === MENTION_CLASS;

const hasMentionClass = (element: Element): boolean => classTokens(element).some(isMentionToken);

/** Removes the mention class from `element` (any case, as quirks mode matches classes loosely). */
function dropMentionClass(element: Element): void {
  const kept = classTokens(element).filter((token) => !isMentionToken(token));
  element.attrs = element.attrs.filter((attr) => attr.name !== "class");
  if (kept.length > 0) element.attrs.push({ name: "class", value: kept.join(" ") });
}

/** All the text under `node`, as the DOM's textContent gives it. */
function textContentOf(node: Parent): string {
  const adapter = parser().defaultTreeAdapter;
  return node.childNodes
    .map((child) => {
      if (adapter.isTextNode(child)) return child.value;
      return adapter.isElementNode(child) ? textContentOf(child) : "";
    })
    .join("");
}

/** Unwraps mention anchors to their text and drops the class elsewhere under `parent`; true when anything changed. */
function unwrapMentions(parent: Parent): boolean {
  const adapter = parser().defaultTreeAdapter;
  let changed = false;
  for (const child of [...parent.childNodes]) {
    if (!adapter.isElementNode(child)) continue;
    if (child.tagName === "a" && hasMentionClass(child)) {
      adapter.insertTextBefore(parent, textContentOf(child), child);
      adapter.detachNode(child);
      changed = true;
      continue;
    }
    if (hasMentionClass(child)) {
      dropMentionClass(child);
      changed = true;
    }
    changed = unwrapMentions(child) || changed;
    if ("content" in child) changed = unwrapMentions(child.content) || changed;
  }
  return changed;
}

/**
 * `html` without any mention link the member sent. A member can type any HTML, so an `a.forum-mention` that arrives
 * is a forgery (it would name a victim, or send the reader elsewhere), and a stored one comes back when a post is
 * edited: either way it is unwrapped to its text, and `linkMentionsInHtml` makes the real link again if `@name`
 * resolves. The class is dropped from any other element. The same string comes back when there was none.
 */
export function unwrapMentionAnchors(html: string): string {
  if (!/class/i.test(html)) return html;
  const root = parse(html);
  if (!root) return html;
  return unwrapMentions(root) ? serialize(root) : html;
}

/** The only text a mention link shows: `@name`, nothing else. */
const LINK_TEXT = /^@([A-Za-z0-9_]{3,24})$/;

/** The text children of `element` joined (a mention link holds one text node). */
function textOf(element: Element): string {
  const adapter = parser().defaultTreeAdapter;
  return element.childNodes
    .map((child) => (adapter.isTextNode(child) ? child.value : "\u0000"))
    .join("");
}

/** The lower-case name a mention link stands for, or null when it is not the one the server writes. */
function trustedAnchorName(anchor: Element): string | null {
  if (!classTokens(anchor).includes(MENTION_CLASS)) return null;
  const typed = LINK_TEXT.exec(textOf(anchor))?.[1];
  if (!typed) return null;
  const name = typed.toLowerCase();
  const href = anchor.attrs.find((attr) => attr.name === "href")?.value.toLowerCase();
  return href === handleProfileHref(name) || href === personaProfileHref(name).toLowerCase()
    ? name
    : null;
}

function collectAnchors(parent: Parent, names: string[]): void {
  const adapter = parser().defaultTreeAdapter;
  for (const child of parent.childNodes) {
    if (!adapter.isElementNode(child)) continue;
    if (child.tagName === "a") {
      const name = trustedAnchorName(child);
      if (name) names.push(name);
    } else if (!SKIPPED.has(child.tagName)) {
      collectAnchors(child, names);
    }
  }
}

/**
 * The names of the mention links a saved post carries, once each, in order (what was linked at save is what is
 * notified). Only the server's own anchors count: `a.forum-mention` outside quotes and code, showing `@name` and
 * pointing at that name's canonical profile path (`/id/<handle>` or `/dashboard/profile/<username>`).
 */
export function mentionAnchorNames(html: string): string[] {
  if (!html.includes(MENTION_CLASS)) return [];
  const root = parse(html);
  if (!root) return [];
  const names: string[] = [];
  collectAnchors(root, names);
  return [...new Set(names)];
}

/** Replaces the mentions in one text node with text and links; false when none was linked. */
function wrapText(node: TextNode, hrefOf: (name: string) => string | null): boolean {
  const { parentNode } = node;
  if (!parentNode) return false;
  const adapter = parser().defaultTreeAdapter;
  const namespace = parser().html.NS.HTML;
  const text = node.value;
  let copied = 0;
  let linked = false;
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const href = hrefOf((match[1] ?? "").toLowerCase());
    if (!href) continue;
    const at = match.index ?? 0;
    if (at > copied) adapter.insertTextBefore(parentNode, text.slice(copied, at), node);
    const anchor = adapter.createElement("a", namespace, [
      { name: "class", value: MENTION_CLASS },
      { name: "href", value: href },
    ]);
    adapter.insertText(anchor, match[0]);
    adapter.insertBefore(parentNode, anchor, node);
    copied = at + match[0].length;
    linked = true;
  }
  if (!linked) return false;
  if (copied < text.length) adapter.insertTextBefore(parentNode, text.slice(copied), node);
  adapter.detachNode(node);
  return true;
}

/**
 * `html` with each resolved `@name` in eligible text wrapped as `<a class="forum-mention" href="...">@name</a>`. The
 * text and the link are built as parser nodes and serialized, so nothing typed can become markup. The same string
 * comes back when nothing was linked, so an untouched post is never re-serialized, and when the links would push the
 * body past the nesting ceiling (the sanitizer would then show the whole post as source).
 */
export function linkMentionsInHtml(html: string, hrefOf: (name: string) => string | null): string {
  if (!html.includes("@")) return html;
  const root = parse(html);
  if (!root) return html;
  const texts: TextNode[] = [];
  collectText(root, texts);
  let changed = false;
  for (const node of texts) changed = wrapText(node, hrefOf) || changed;
  if (!changed) return html;
  const linked = serialize(root);
  return leavesAlone(linked) ? html : linked;
}

/**
 * Old forum links in imported XenForo posts and where they point on the native forum. Pure: the import's link pass
 * (`src/server/modules/thinkpages-forum/import-forum-links.ts`) looks the ids up and passes what it found.
 * Every target is built from links.ts helpers (or a handle, encoded), so it is always an app path on this site.
 *
 * An old link is a forum.ixwiki.com URL (XenForo's friendly or `index.php?` form, or a root-relative XenForo path such
 * as `/threads/x.12/`), or a path of the retired IxStates bridge (`/forum/...`, on ixwiki.com or root-relative, with
 * or without the app's base path). In post HTML only an anchor's href is read and rewritten; text, images and every
 * other attribute stay as written. A stored notification link is rewritten whole (`rewriteNotificationHref`).
 */
import { mapHtmlRuns } from "~/lib/action-links";
import { mediaWikiHostPattern } from "~/lib/wiki-os/config";
import { categoryHref, FORUM_HOME, postHref, threadHref } from "../links";
import { escapeHtml, unescapeHtml } from "./html-text";
import type { NodeMapFile, NodeTarget } from "./node-map";

/** An old forum link's target, by XenForo id: a forum node, a thread, a post or a member; or the front page. */
export type ForumRef =
  | { kind: "home" }
  | { kind: "forum"; nodeId: number }
  | { kind: "thread"; threadId: number }
  | { kind: "post"; postId: number }
  | { kind: "member"; userId: number };

/** What the import found for a ref: native ids, the category (realm slug for a realm one) and a member's handle. */
export interface ForumLookups {
  threadId: string | null;
  postId: string | null;
  category: { key: string; realmSlug: string | null } | null;
  handle: string | null;
}

/** A member's profile; the handle is encoded, so it stays one path segment. */
const memberHref = (handle: string): string => `/@${encodeURIComponent(handle)}`;

function categoryTarget(category: ForumLookups["category"]): string | null {
  if (!category) return null;
  const realm = category.realmSlug ? { slug: category.realmSlug } : null;
  return categoryHref({ key: category.key, realm });
}

/** The native page for a ref, given what was found; null when nothing was. */
export function forumRefTarget(ref: ForumRef, found: ForumLookups): string | null {
  switch (ref.kind) {
    case "home":
      return FORUM_HOME;
    case "thread":
      return found.threadId ? threadHref(found.threadId) : null;
    case "post":
      return found.postId ? postHref(found.postId) : null;
    case "forum":
      return categoryTarget(found.category);
    case "member":
      return found.handle ? memberHref(found.handle) : null;
  }
}

/** A node's seeded target from the applied node map: a sitewide category, or a realm (by slug) category. */
export type NodeLanding = Extract<NodeTarget, { scope: string }>;

/**
 * The run's applied node map (`appliedNodeMap`) as each node's landing. Archive and skip entries have none: an
 * archived node lands through its archive key `xf-<nodeId>`, a skipped one nowhere.
 */
export function nodeLandings(nodeMap: NodeMapFile): ReadonlyMap<number, NodeLanding> {
  const landings = new Map<number, NodeLanding>();
  for (const [nodeId, target] of Object.entries(nodeMap.nodes)) {
    if ("scope" in target) landings.set(Number(nodeId), target);
  }
  return landings;
}

/**
 * XenForo's route segments. A root-relative path starting with one (`/threads/x.12/`, written on the old forum
 * without its host) is a XenForo path: no IxStates route or rewrite starts with any of them.
 */
const XENFORO_SEGMENTS = ["threads", "posts", "forums", "categories", "members", "goto"] as const;

/**
 * Text that a stored row holding an old forum link contains, matched in any case: the import's passes read only
 * those rows. `/forum` covers the bridge's paths (and `//forum.ixwiki.com`).
 */
export const FORUM_LINK_MARKERS: readonly string[] = [
  "forum.ixwiki.com",
  "/forum",
  ...XENFORO_SEGMENTS.map((segment) => `/${segment}/`),
];

/** XenForo ids are positive and the native columns are Int: anything past int4 cannot match a row. */
const MAX_ID = 2_147_483_647;

/** A XenForo id from its digits (a link's, or a bridge-era stash title's), or null when it cannot name a row. */
export function xenforoId(digits: string | undefined): number | null {
  // Digits only: Number() would also read "1e3", "0x10", " 7" or "+4". The range bounds the length.
  if (!digits || !/^\d+$/.test(digits)) return null;
  const id = Number(digits);
  return id >= 1 && id <= MAX_ID ? id : null;
}

const home = (): ForumRef[] => [{ kind: "home" }];
const thread = (threadId: number): ForumRef => ({ kind: "thread", threadId });
const post = (postId: number): ForumRef => ({ kind: "post", postId });
const node = (nodeId: number): ForumRef => ({ kind: "forum", nodeId });
const member = (userId: number): ForumRef => ({ kind: "member", userId });

/** The refs to try, in order; digits that are not a XenForo id add none. */
function refsOf(...candidates: Array<[string | undefined, (id: number) => ForumRef]>): ForumRef[] {
  return candidates.flatMap(([digits, make]) => {
    const id = xenforoId(digits);
    return id === null ? [] : [make(id)];
  });
}

/** A link's path, query and fragment, once its origin (and base path) is cut off. */
interface UrlParts {
  path: string;
  query: string;
  fragment: string;
}

function urlParts(rest: string): UrlParts {
  const [beforeHash = "", fragment = ""] = rest.split(/#(.*)/s);
  const [path = "", query = ""] = beforeHash.split(/\?(.*)/s);
  return { path, query, fragment };
}

const postFragment = (fragment: string) => /^post-(\d+)$/.exec(fragment)?.[1];
const queryId = (query: string) => /(?:^|&)id=(\d+)(?:&|$)/.exec(query)?.[1];

type Route = [RegExp, (match: RegExpExecArray, url: UrlParts) => ForumRef[]];

/** A XenForo id, bare (`100`) or after its slug (`welcome.100`). */
const SLUG_ID = String.raw`(?:[^/]*\.)?(\d+)`;

/** XenForo's routes; a thread's `post-P` (or `#post-P`) is tried before the thread. */
const XENFORO_ROUTES: readonly Route[] = [
  [/^(?:\/?|\/forums\/?|\/index\.php)$/, home],
  [
    new RegExp(String.raw`^/threads/${SLUG_ID}(?:/(?:page-\d+|unread|latest|post-(\d+)))?/?$`),
    (m, url) => refsOf([m[2] ?? postFragment(url.fragment), post], [m[1], thread]),
  ],
  [/^\/posts\/(\d+)\/?$/, (m) => refsOf([m[1], post])],
  [/^\/goto\/post\/?$/, (_, url) => refsOf([queryId(url.query), post])],
  [
    new RegExp(String.raw`^/(?:forums|categories)/${SLUG_ID}(?:/page-\d+)?/?$`),
    (m) => refsOf([m[1], node]),
  ],
  [new RegExp(String.raw`^/members/${SLUG_ID}/?$`), (m) => refsOf([m[1], member])],
];

/** The retired bridge's routes: its home, `/forum/<nodeId>`, `/forum/thread/<id>[#post-<id>]`, posts, members. */
const BRIDGE_ROUTES: readonly Route[] = [
  [/^\/forum\/?$/, home],
  [
    /^\/forum\/thread\/(\d+)\/?$/,
    (m, url) => refsOf([postFragment(url.fragment), post], [m[1], thread]),
  ],
  [/^\/forum\/post\/(\d+)\/?$/, (m) => refsOf([m[1], post])],
  [/^\/forum\/members\/(\d+)\/?$/, (m) => refsOf([m[1], member])],
  [/^\/forum\/(\d+)\/?$/, (m) => refsOf([m[1], node])],
];

const XENFORO_ORIGIN = /^(?:https?:)?\/\/(?:www\.)?forum\.ixwiki\.com(?::\d{1,5})?(?=[/?#]|$)/i;
/** A root-relative XenForo path: nothing to cut, its route starts right away. */
const XENFORO_ROOT_PATH = new RegExp(`^(?=/(?:${XENFORO_SEGMENTS.join("|")})/)`);
/** XenForo's unfriendly form: `/index.php?threads/x.12/&page=2` is the route `/threads/x.12/`, query `page=2`. */
const XENFORO_INDEX_ROUTE = /^\/index\.php\?([^&#]*)&?/i;
/** Where the bridge's paths start: the wiki's host or root-relative, with or without the app's base path. */
const BRIDGE_ORIGIN = new RegExp(
  String.raw`^(?:https?://${mediaWikiHostPattern()})?(?:/projects/ixstate?s)?(?=/forum(?:[/?#]|$))`
);

function routeRefs(routes: readonly Route[], url: UrlParts): ForumRef[] {
  for (const [pattern, refs] of routes) {
    const match = pattern.exec(url.path);
    if (match) return refs(match, url);
  }
  return [];
}

/**
 * What an href points at on the old forum: the refs to try in order (a post's link falls back to its thread), or
 * none for a dead link (an old forum page with no native counterpart). Null when it is not an old forum link.
 */
export function classifyForumHref(href: string): ForumRef[] | null {
  const xenforo = XENFORO_ORIGIN.exec(href) ?? XENFORO_ROOT_PATH.exec(href);
  if (xenforo) {
    const rest = href.slice(xenforo[0].length).replace(XENFORO_INDEX_ROUTE, "/$1?");
    return routeRefs(XENFORO_ROUTES, urlParts(rest));
  }
  const bridge = BRIDGE_ORIGIN.exec(href);
  return bridge ? routeRefs(BRIDGE_ROUTES, urlParts(href.slice(bridge[0].length))) : null;
}

/** An anchor start tag up to its href value, and the value (the sanitizer double-quotes every attribute). */
const ANCHOR_HREF = /^(<a(?=[\s>/])(?:"[^"]*"|'[^']*'|[^>"'])*?\shref=")([^"]*)(?=")/i;
/** `<a` itself, not a custom element such as `<a-x>`. */
const ANCHOR_START = /^<a(?=[\s>/])/i;
const ANCHOR_END = /^<\/a\s*>$/i;

/** An anchor start tag holding an old forum link: the tag before and after its href value, and the link's refs. */
interface OldLink {
  head: string;
  tail: string;
  refs: ForumRef[];
}

/** A tag's old forum link, when it is an anchor start tag holding one; its href is decoded first (`&amp;`). */
function oldLinkOf(tag: string): OldLink | null {
  const match = ANCHOR_HREF.exec(tag);
  if (!match) return null;
  const refs = classifyForumHref(unescapeHtml(match[2] ?? "").trim());
  return refs ? { head: match[1] ?? "", tail: tag.slice(match[0].length), refs } : null;
}

/** Every ref the HTML's anchors could resolve through, in order (a ref may repeat). */
export function forumHrefRefs(html: string): ForumRef[] {
  const refs: ForumRef[] = [];
  mapHtmlRuns(html, {
    markup: (tag) => {
      refs.push(...(oldLinkOf(tag)?.refs ?? []));
      return tag;
    },
  });
  return refs;
}

export interface ForumHrefRewrite {
  html: string;
  /** Links pointed at their native page. */
  mapped: number;
  /** Links unwrapped to what they held: nothing they point at resolves. */
  unwrapped: number;
}

/** The first of the refs `targetOf` resolves, or null. */
function firstTarget(
  refs: readonly ForumRef[],
  targetOf: (ref: ForumRef) => string | null
): string | null {
  for (const ref of refs) {
    const target = targetOf(ref);
    if (target !== null) return target;
  }
  return null;
}

/**
 * Each anchor's old forum link pointed at the first of its refs `targetOf` resolves. A link nothing resolves is
 * unwrapped ("drop": its start and end tags go, what they held stays) or left as written ("keep", while threads are
 * still missing). Other anchors, every other attribute and every text run are unchanged.
 */
export function rewriteForumHrefs(
  html: string,
  targetOf: (ref: ForumRef) => string | null,
  unresolved: "drop" | "keep"
): ForumHrefRewrite {
  const out: ForumHrefRewrite = { html, mapped: 0, unwrapped: 0 };
  /** Per open anchor, whether its start tag was cut (then its end tag goes too). */
  const cut: boolean[] = [];
  const startTag = (tag: string): string => {
    const link = oldLinkOf(tag);
    const target = link ? firstTarget(link.refs, targetOf) : null;
    if (link && target !== null) {
      cut.push(false);
      out.mapped += 1;
      return `${link.head}${escapeHtml(target)}${link.tail}`;
    }
    const drop = link !== null && unresolved === "drop";
    cut.push(drop);
    if (drop) out.unwrapped += 1;
    return drop ? "" : tag;
  };
  out.html = mapHtmlRuns(html, {
    markup: (tag) => {
      if (ANCHOR_END.test(tag)) return cut.pop() ? "" : tag;
      return ANCHOR_START.test(tag) ? startTag(tag) : tag;
    },
  });
  return out;
}

/** The app's base path, which a stored notification link may carry; the old one (`/projects/ixstats`) goes. */
const APP_BASE_PATH = "/projects/ixstates";

export interface NotificationHrefRewrite {
  href: string;
  /** Whether it points at its native page (else at the forum home: nothing public is there). */
  mapped: boolean;
}

/**
 * A stored notification link that is an old forum link, pointed at the first of its refs `targetOf` resolves (a
 * post's link falls back to its thread). With nothing resolved it goes to the forum home ("drop"), or is left as
 * written ("keep", while threads are still missing). The current base path is kept when the link starts with it;
 * any other origin or base path goes (the app adds its base path to a bare path). Null when the link is not an old
 * forum link, or is kept.
 */
export function rewriteNotificationHref(
  href: string,
  targetOf: (ref: ForumRef) => string | null,
  unresolved: "drop" | "keep"
): NotificationHrefRewrite | null {
  const refs = classifyForumHref(href);
  if (refs === null) return null;
  const target = firstTarget(refs, targetOf);
  if (target === null && unresolved === "keep") return null;
  const base = href.startsWith(`${APP_BASE_PATH}/`) ? APP_BASE_PATH : "";
  return { href: `${base}${target ?? FORUM_HOME}`, mapped: target !== null };
}

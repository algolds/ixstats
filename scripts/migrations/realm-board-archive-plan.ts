/**
 * Pure planner for scripts/migrations/archive-realm-boards.ts: one Realm Board's feed posts become one archived,
 * locked "Realm Board archive" thread in the realm's Hub (phase 2, D7/D11/D12). No database access here.
 *
 * A board post is rich-editor HTML or plain text, as anywhere in the ThinkPages feed. Its body is built the way the
 * feed displays it: feed-only markers are removed, then `formatThinkpagesContentForDisplay` sanitizes HTML or
 * formats plain text. An `[ixaction=…]` token inside a tag or attribute is then removed, so a token only ever sits
 * in a text run, where it renders as a card. Attachments are appended (https or site-relative URLs only), and the
 * whole is sanitized last and stripped, as the forum's writes.ts stores a post.
 */
import { countActionTokens } from "~/lib/action-links";
import { escapeHtml, sanitizeUserContent, stripHtml } from "~/lib/utils/sanitize-html";
import { formatThinkpagesContentForDisplay } from "~/lib/utils/text-formatter";

export const ARCHIVE_TITLE = "Realm Board archive";
export const threadSourceRef = (groupId: string) => `realm_board:${groupId}`;
export const postSourceRef = (postId: string) => `thinkpages_post:${postId}`;

export interface BoardPostRow {
  id: string;
  content: string;
  createdAt: Date;
  visibility: string;
  account: { id: string; clerkUserId: string; accountType: string; displayName: string };
  media: Array<{ url: string; type: string }>;
}

export interface ArchivePlan {
  thread: {
    sourceRef: string;
    title: string;
    authorUserId: string;
    authorPersonaId: string | null;
    createdAt: Date;
    lastPostAt: Date;
    postCount: number;
  } | null;
  posts: Array<{
    sourceRef: string;
    authorUserId: string;
    authorPersonaId: string | null;
    contentHtml: string;
    plainText: string;
    createdAt: Date;
  }>;
  /** `blank`: posts with no text and no usable attachment. `empty`: 1 when the board leaves nothing to archive. */
  skipped: {
    removed: number;
    noUser: number;
    alreadyMigrated: number;
    blank: number;
    empty: number;
  };
}

type PlannedPost = ArchivePlan["posts"][number];

// https, or a site-relative path; never `//host` or `/\host`, which browsers read as another origin.
const SAFE_MEDIA_URL = /^(?:https:\/\/|\/(?![/\\]))/;

// Feed-only markers the feed never displays: HTML comments (the sports-bulletin data block among them), the
// IxTwitter sync's `[DiscordMsg:<id>]` and a blurb's `[blurb:<slug>|<title>]` header (useThinkpagesPost.ts).
const FEED_MARKERS = [
  /<!--[\s\S]*?-->\n*/g,
  /\s*\[DiscordMsg:\d+\]/gi,
  /^\[blurb:[^\]|]+\|[^\]]+\]\n\n/,
];

const withoutFeedMarkers = (content: string) =>
  FEED_MARKERS.reduce((text, marker) => text.replace(marker, ""), content.replace(/\r\n?/g, "\n"));

// A whole start or end tag (quoted attribute values may hold `>`), as action-links reads sanitized HTML.
const TAG = /<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^>"'])*>/g;
const ACTION_TOKEN = /\[ixaction=[A-Za-z0-9_-]{1,64}\]/g;

const withoutTokensInTags = (html: string) =>
  html.replace(TAG, (tag) => tag.replace(ACTION_TOKEN, ""));

function mediaBlock({ url, type }: { url: string; type: string }): string | null {
  if (!SAFE_MEDIA_URL.test(url) || countActionTokens(url) > 0) return null;
  const href = escapeHtml(url);
  return type === "image"
    ? `<p><img src="${href}" alt=""></p>`
    : `<p><a href="${href}">Attachment</a></p>`;
}

/** A board post and its attachments as stored forum HTML plus its plain text, as the feed displays it. */
export function boardPostBody(row: Pick<BoardPostRow, "content" | "media">): {
  contentHtml: string;
  plainText: string;
} {
  const text = withoutTokensInTags(
    formatThinkpagesContentForDisplay(withoutFeedMarkers(row.content))
  );
  const media = row.media.map(mediaBlock).filter((block): block is string => block !== null);
  // Sanitizing is the last transform: cutting a token out of an attribute can form a new URL
  // (`java[ixaction=a]script:` becomes `javascript:`), which only a later pass can refuse.
  const contentHtml = sanitizeUserContent([text, ...media].join(""));
  return { contentHtml, plainText: stripHtml(contentHtml) };
}

/** Nothing worth a post: no text and no image. */
const isBlank = (body: { contentHtml: string; plainText: string }) =>
  !body.plainText && !/<img\b/i.test(body.contentHtml);

const oldestFirst = (a: BoardPostRow, b: BoardPostRow) =>
  a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);

/** D12: the persona the post was made under, unless it is the user's personal persona. */
const personaOf = (account: BoardPostRow["account"]) =>
  account.accountType === "personal" ? null : account.id;

type Skip = Exclude<keyof ArchivePlan["skipped"], "empty">;

function planPost(
  row: BoardPostRow,
  userIdByClerk: ReadonlyMap<string, string>,
  migrated: ReadonlySet<string>
): PlannedPost | Skip {
  const sourceRef = postSourceRef(row.id);
  if (row.visibility === "removed") return "removed";
  if (migrated.has(sourceRef)) return "alreadyMigrated";
  const authorUserId = userIdByClerk.get(row.account.clerkUserId);
  if (!authorUserId) return "noUser";
  const body = boardPostBody(row);
  if (isBlank(body)) return "blank";
  return {
    sourceRef,
    authorUserId,
    authorPersonaId: personaOf(row.account),
    ...body,
    createdAt: row.createdAt,
  };
}

function threadOf(groupId: string, posts: PlannedPost[]): ArchivePlan["thread"] {
  const first = posts[0];
  const last = posts[posts.length - 1];
  if (!first || !last) return null;
  return {
    sourceRef: threadSourceRef(groupId),
    title: ARCHIVE_TITLE,
    authorUserId: first.authorUserId,
    authorPersonaId: first.authorPersonaId,
    createdAt: first.createdAt,
    lastPostAt: last.createdAt,
    postCount: posts.length,
  };
}

/** One board's archive: the posts still to write, oldest first, and why the others are left out. */
export function planBoardArchive(input: {
  groupId: string;
  posts: readonly BoardPostRow[];
  userIdByClerk: ReadonlyMap<string, string>;
  migrated: ReadonlySet<string>;
}): ArchivePlan {
  const skipped = { removed: 0, noUser: 0, alreadyMigrated: 0, blank: 0, empty: 0 };
  const posts: PlannedPost[] = [];
  for (const row of [...input.posts].sort(oldestFirst)) {
    const planned = planPost(row, input.userIdByClerk, input.migrated);
    if (typeof planned === "string") skipped[planned] += 1;
    else posts.push(planned);
  }
  if (posts.length === 0 && skipped.alreadyMigrated === 0) skipped.empty = 1;
  return { thread: threadOf(input.groupId, posts), posts, skipped };
}

const skippedText = (s: ArchivePlan["skipped"]) =>
  `skipped ${s.removed} removed, ${s.noUser} no user, ${s.alreadyMigrated} already migrated, ${s.blank} blank`;

/** One line per realm, then the totals. */
export function summarizeArchive(rows: Array<{ realm: string } & ArchivePlan>): string[] {
  const total = { removed: 0, noUser: 0, alreadyMigrated: 0, blank: 0, empty: 0 };
  let toCreate = 0;
  const lines = rows.map((row) => {
    toCreate += row.posts.length;
    for (const key of Object.keys(total) as Array<keyof typeof total>)
      total[key] += row.skipped[key];
    const empty = row.skipped.empty ? "; empty board" : "";
    return `${row.realm}: ${row.posts.length} to create; ${skippedText(row.skipped)}${empty}`;
  });
  const boards = `${rows.length} board${rows.length === 1 ? "" : "s"}`;
  const empties = `${total.empty} empty board${total.empty === 1 ? "" : "s"}`;
  return [
    ...lines,
    `Total: ${toCreate} to create across ${boards}; ${skippedText(total)}; ${empties}`,
  ];
}

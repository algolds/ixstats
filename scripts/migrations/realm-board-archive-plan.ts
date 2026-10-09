/**
 * Pure planner for scripts/migrations/archive-realm-boards.ts: one Realm Board's feed posts become one archived,
 * locked "Realm Board archive" thread in the realm's Hub (phase 2, D7/D11/D12). No database access here.
 *
 * Board posts are plain text with media attachments. A body is escaped, laid out as paragraphs, then sanitized and
 * stripped exactly as the forum's writes.ts stores a post. Attachment URLs must be https or site-relative and hold
 * no `[ixaction=…]` token, so an action token can only ever sit in a text run, where it renders as a card.
 */
import { countActionTokens } from "~/lib/action-links";
import { escapeHtml, sanitizeUserContent, stripHtml } from "~/lib/utils/sanitize-html";

export const ARCHIVE_TITLE = "Realm Board archive";
export const threadSourceRef = (groupId: string) => `realm_board:${groupId}`;
export const postSourceRef = (postId: string) => `thinkpages_post:${postId}`;

/** The production database's name: the runner refuses it unless `--production` is passed. */
const PRODUCTION_DATABASE = "ixstats";

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

function paragraphs(content: string): string[] {
  return content
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`);
}

function mediaBlock({ url, type }: { url: string; type: string }): string | null {
  if (!SAFE_MEDIA_URL.test(url) || countActionTokens(url) > 0) return null;
  const href = escapeHtml(url);
  return type === "image"
    ? `<p><img src="${href}" alt=""></p>`
    : `<p><a href="${href}">Attachment</a></p>`;
}

/** Plain board text and its attachments as stored forum HTML plus its plain text. */
export function boardPostBody(row: Pick<BoardPostRow, "content" | "media">): {
  contentHtml: string;
  plainText: string;
} {
  const media = row.media.map(mediaBlock).filter((block): block is string => block !== null);
  const contentHtml = sanitizeUserContent([...paragraphs(row.content), ...media].join(""));
  return { contentHtml, plainText: stripHtml(contentHtml) };
}

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
  if (!body.contentHtml) return "blank";
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

/** Why the runner must not touch the database in `databaseUrl`, or null when it may. */
export function archiveDatabaseRefusal(
  databaseUrl: string | undefined,
  production: boolean
): string | null {
  let name: string;
  try {
    name = decodeURIComponent(new URL(databaseUrl ?? "").pathname.replace(/^\//, ""));
  } catch {
    return "DATABASE_URL is not set or not a URL.";
  }
  if (name === PRODUCTION_DATABASE && !production) {
    return `DATABASE_URL names the production database "${PRODUCTION_DATABASE}". Run against a clone, or pass --production if that is intended.`;
  }
  return null;
}

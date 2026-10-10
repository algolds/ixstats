/**
 * Pure planner for scripts/migrations/import-realm-board-history.ts: one realm's old Realm Board chat (a ThinkShare
 * group conversation, the board group's `conversationId`) becomes history in the realm's board thread, oldest first,
 * under the original author and time. No database access here.
 *
 * A chat message is plain text. It becomes escaped HTML paragraphs, sanitized last as every stored forum body is, and
 * its full text is kept (action tokens excepted, which are removed): the 1,000 character cap applies to new board messages, not to history.
 */
import { withoutActionTokens } from "~/lib/action-links";
import { escapeHtml, sanitizeUserContent, stripHtml } from "~/lib/utils/sanitize-html";
import { productionDatabaseRefusal } from "../lib/database-guard";
import { localDatabaseRefusal } from "./reconvert-imported-posts-plan";

export const messageSourceRef = (messageId: string) => `realm_board_message:${messageId}`;

/** Shown for an author with neither a user row nor a ThinkPages persona name. */
export const FORMER_MEMBER_NAME = "Former member";

/** One message of the board's chat as the database holds it (`userId` is the author's Clerk id). */
export interface ChatMessageRow {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
  deletedAt: Date | null;
  isSystem: boolean;
}

export interface HistoryPost {
  threadId: string;
  authorUserId: string | null;
  authorPersonaId: null;
  importedAuthorName: string | null;
  contentHtml: string;
  plainText: string;
  createdAt: Date;
  sourceRef: string;
}

export interface HistorySkipped {
  deleted: number;
  system: number;
  blank: number;
  alreadyImported: number;
}

export interface HistoryPlan {
  posts: HistoryPost[];
  skipped: HistorySkipped;
  /** Posts to create whose author has no user row (kept as `importedAuthorName`). */
  unknownAuthors: number;
}

/** A plain-text chat message as stored forum HTML plus its plain text. */
export function chatMessageBody(content: string): { contentHtml: string; plainText: string } {
  // An action token would render someone's activity as a card in the author's name: history carries none.
  const paragraphs = withoutActionTokens(content)
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n[ \t]*\n\s*/)
    .filter((block) => block.trim() !== "")
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`);
  const contentHtml = sanitizeUserContent(paragraphs.join(""));
  return { contentHtml, plainText: stripHtml(contentHtml) };
}

const oldestFirst = (a: ChatMessageRow, b: ChatMessageRow) =>
  a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);

type Skip = keyof HistorySkipped;

function skipReason(row: ChatMessageRow, imported: ReadonlySet<string>): Skip | null {
  if (row.deletedAt) return "deleted";
  if (row.isSystem) return "system";
  if (imported.has(messageSourceRef(row.id))) return "alreadyImported";
  return null;
}

/** One board's history: the posts still to write, oldest first, and why the others are left out. */
export function planBoardHistory(input: {
  threadId: string;
  messages: readonly ChatMessageRow[];
  userIdByClerk: ReadonlyMap<string, string>;
  nameByClerk: ReadonlyMap<string, string>;
  /** Source refs already in the forum. */
  imported: ReadonlySet<string>;
}): HistoryPlan {
  const skipped: HistorySkipped = { deleted: 0, system: 0, blank: 0, alreadyImported: 0 };
  const posts: HistoryPost[] = [];
  let unknownAuthors = 0;
  for (const row of [...input.messages].sort(oldestFirst)) {
    const reason = skipReason(row, input.imported);
    const body = reason ? null : chatMessageBody(row.content);
    if (reason || !body?.plainText) {
      skipped[reason ?? "blank"] += 1;
      continue;
    }
    const authorUserId = input.userIdByClerk.get(row.userId) ?? null;
    if (!authorUserId) unknownAuthors += 1;
    posts.push({
      threadId: input.threadId,
      authorUserId,
      authorPersonaId: null,
      importedAuthorName: authorUserId
        ? null
        : input.nameByClerk.get(row.userId)?.trim() || FORMER_MEMBER_NAME,
      ...body,
      createdAt: row.createdAt,
      sourceRef: messageSourceRef(row.id),
    });
  }
  return { posts, skipped, unknownAuthors };
}

const skippedText = (s: HistorySkipped, unknownAuthors: number) =>
  `skipped ${s.deleted} deleted, ${s.system} system, ${s.blank} blank, ${s.alreadyImported} already imported; ` +
  `${unknownAuthors} authors without an account`;

/** One line per realm, then the totals. */
export function summarizeBoardHistory(rows: Array<{ realm: string } & HistoryPlan>): string[] {
  const total: HistorySkipped = { deleted: 0, system: 0, blank: 0, alreadyImported: 0 };
  let toImport = 0;
  let unknown = 0;
  const lines = rows.map((row) => {
    toImport += row.posts.length;
    unknown += row.unknownAuthors;
    for (const key of Object.keys(total) as Skip[]) total[key] += row.skipped[key];
    return `${row.realm}: ${row.posts.length} to import; ${skippedText(row.skipped, row.unknownAuthors)}`;
  });
  const boards = `${rows.length} board${rows.length === 1 ? "" : "s"}`;
  return [
    ...lines,
    `Total: ${toImport} to import across ${boards}; ${skippedText(total, unknown)}`,
  ];
}

export interface BoardHistoryArgs {
  apply: boolean;
}

/** The parsed arguments, or why the run must not start. Never accepts `--production`; only a local database. */
export function parseBoardHistoryArgs(
  argv: readonly string[],
  databaseUrl: string | undefined
): { args: BoardHistoryArgs } | { error: string } {
  const unknown = argv.find((arg) => arg !== "--apply" && arg !== "--dry-run");
  if (unknown) return { error: `Unknown argument: ${unknown}` };
  const refusal =
    productionDatabaseRefusal(databaseUrl, false) ?? localDatabaseRefusal(databaseUrl);
  if (refusal) return { error: refusal };
  return { args: { apply: argv.includes("--apply") && !argv.includes("--dry-run") } };
}

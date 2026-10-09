/**
 * ThinkPages forum phase 2: archive every Realm Board feed into one archived, locked "Realm Board archive" thread
 * in its realm's Hub, oldest first, with the original timestamps and the personas the posts were made under (D12).
 * Dry run by default; pass --apply to write.
 *   bun run db:archive-realm-boards [-- --apply] [-- --production]
 * It refuses the production database ("ixstats") unless --production is passed. Preflight, before any write:
 * every board's realm must have its Hub (apply migration 20261009120000_thinkpages_forum_realms first).
 * Idempotent by `sourceRef` (thread `realm_board:<groupId>`, post `thinkpages_post:<postId>`): a rerun creates
 * nothing new and a partial earlier run is completed. Removed posts, posts whose account has no User row (D11) and
 * posts with nothing to show are skipped and reported. The board chat and docs are not migrated (D1, D2); their
 * counts are printed so nothing is lost silently. Embassy cross-posts land once, in their own realm (D3).
 */
import "../lib/load-env";
import { PrismaClient, type Prisma } from "@prisma/client";
import { REALM_HUB_KEY } from "~/lib/thinkpages-forum/categories";
import {
  archiveDatabaseRefusal,
  planBoardArchive,
  postSourceRef,
  summarizeArchive,
  threadSourceRef,
  type ArchivePlan,
  type BoardPostRow,
} from "./realm-board-archive-plan";

const CHUNK = 500;
const TRANSACTION_TIMEOUT_MS = 120_000;

const argv = process.argv.slice(2);
const apply = argv.includes("--apply") && !argv.includes("--dry-run");

interface Board {
  groupId: string;
  realm: string;
  hubId: string;
}

interface BoardRun {
  board: Board;
  plan: ArchivePlan;
  existingThreadId: string | null;
}

/** Every board with its realm's name and Hub, and the realms that have no Hub (the preflight). */
async function loadBoards(db: PrismaClient): Promise<{ boards: Board[]; missing: string[] }> {
  const rows = await db.realmBoard.findMany({
    select: { realmId: true, groupId: true },
    orderBy: { createdAt: "asc" },
  });
  const boards: Board[] = [];
  const missing: string[] = [];
  for (const { realmId, groupId } of rows) {
    const realmRow = await db.realm.findUnique({
      where: { id: realmId },
      select: { name: true, slug: true },
    });
    const realm = realmRow ? `${realmRow.name} (${realmRow.slug})` : "IxWorld";
    const hub = await db.forumCategory.findFirst({
      where: { scope: "realm", realmId, key: REALM_HUB_KEY },
      select: { id: true },
    });
    if (hub) boards.push({ groupId, realm, hubId: hub.id });
    else missing.push(`${realm} [${realmId}]`);
  }
  return { boards, missing };
}

async function boardPosts(db: PrismaClient, groupId: string): Promise<BoardPostRow[]> {
  const rows = await db.thinkpagesPost.findMany({
    // The board's tag, as `groupPostTag` in src/server/shared/realm-board.ts writes it into the JSON hashtags.
    where: { hashtags: { contains: `"group:${groupId}"` } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      content: true,
      createdAt: true,
      visibility: true,
      account: { select: { id: true, clerkUserId: true, accountType: true, displayName: true } },
      mediaAttachments: { select: { url: true, type: true } },
    },
  });
  return rows.map(({ mediaAttachments, ...row }) => ({ ...row, media: mediaAttachments }));
}

/** The board chat's message count and the board's doc count, reported only (D1, D2). */
async function chatAndDocs(db: PrismaClient, groupId: string) {
  const group = await db.thinktankGroup.findUnique({
    where: { id: groupId },
    select: { conversationId: true },
  });
  const chat = group?.conversationId
    ? await db.thinkshareMessage.count({ where: { conversationId: group.conversationId } })
    : 0;
  const docs = await db.collaborativeDoc.count({ where: { groupId } });
  return { chat, docs };
}

async function planBoard(db: PrismaClient, board: Board): Promise<BoardRun> {
  const posts = await boardPosts(db, board.groupId);
  const clerkIds = [...new Set(posts.map((p) => p.account.clerkUserId))];
  const users = await db.user.findMany({
    where: { clerkUserId: { in: clerkIds } },
    select: { id: true, clerkUserId: true },
  });
  const migrated = await db.forumPost.findMany({
    where: { sourceRef: { in: posts.map((p) => postSourceRef(p.id)) } },
    select: { sourceRef: true },
  });
  const existing = await db.forumThread.findUnique({
    where: { sourceRef: threadSourceRef(board.groupId) },
    select: { id: true },
  });
  const plan = planBoardArchive({
    groupId: board.groupId,
    posts,
    userIdByClerk: new Map(users.map((u) => [u.clerkUserId, u.id])),
    migrated: new Set(migrated.flatMap((m) => (m.sourceRef ? [m.sourceRef] : []))),
  });
  const { chat, docs } = await chatAndDocs(db, board.groupId);
  console.log(
    `${board.realm}: ${posts.length} board posts found, ${plan.posts.length} to create, thread ${existing ? "exists" : "new"}; ` +
      `board chat ${chat} messages, ${docs} docs (not migrated)`
  );
  return { board, plan, existingThreadId: existing?.id ?? null };
}

async function createThread(tx: Prisma.TransactionClient, run: BoardRun): Promise<string | null> {
  if (run.existingThreadId) return run.existingThreadId;
  if (!run.plan.thread) return null;
  const thread = await tx.forumThread.create({
    data: { ...run.plan.thread, categoryId: run.board.hubId, archived: true, locked: true },
    select: { id: true },
  });
  return thread.id;
}

/** Writes one board in one transaction; returns what it created. */
async function applyBoard(db: PrismaClient, run: BoardRun) {
  if (run.plan.posts.length === 0) return { threadCreated: false, postsCreated: 0 };
  return db.$transaction(
    async (tx) => {
      const threadId = await createThread(tx, run);
      if (!threadId) return { threadCreated: false, postsCreated: 0 };
      let postsCreated = 0;
      for (let i = 0; i < run.plan.posts.length; i += CHUNK) {
        const data = run.plan.posts.slice(i, i + CHUNK).map((p) => ({ ...p, threadId }));
        postsCreated += (await tx.forumPost.createMany({ data, skipDuplicates: true })).count;
      }
      // From the database, so a rerun or a partial earlier run ends consistent.
      const postCount = await tx.forumPost.count({ where: { threadId } });
      const latest = await tx.forumPost.aggregate({
        where: { threadId },
        _max: { createdAt: true },
      });
      await tx.forumThread.update({
        where: { id: threadId },
        data: { postCount, ...(latest._max.createdAt && { lastPostAt: latest._max.createdAt }) },
      });
      return { threadCreated: !run.existingThreadId, postsCreated };
    },
    { timeout: TRANSACTION_TIMEOUT_MS }
  );
}

async function main(db: PrismaClient): Promise<number> {
  const { boards, missing } = await loadBoards(db);
  if (missing.length > 0) {
    console.error(`No Hub category for: ${missing.join(", ")}. Apply the phase 2 migration first.`);
    return 1;
  }
  const runs: BoardRun[] = [];
  for (const board of boards) runs.push(await planBoard(db, board));
  const summary = summarizeArchive(runs.map((r) => ({ realm: r.board.realm, ...r.plan })));
  for (const line of summary) console.log(`  ${line}`);
  if (!apply) return 0;

  let threadsCreated = 0;
  let postsCreated = 0;
  for (const run of runs) {
    const result = await applyBoard(db, run);
    threadsCreated += result.threadCreated ? 1 : 0;
    postsCreated += result.postsCreated;
  }
  console.log(
    `Applied: ${boards.length} boards, ${threadsCreated} threads created, ${postsCreated} posts created.`
  );
  console.log(`  ${summary[summary.length - 1]}`);
  return 0;
}

function databaseLabel(url: string | undefined): string {
  try {
    const parsed = new URL(url ?? "");
    return `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return "(DATABASE_URL is not set or not a URL)";
  }
}

console.log(apply ? "APPLY mode" : "DRY RUN — pass --apply to write");
console.log(`Database: ${databaseLabel(process.env.DATABASE_URL)}`);
const refusal = archiveDatabaseRefusal(process.env.DATABASE_URL, argv.includes("--production"));
if (refusal) {
  console.error(refusal);
  process.exit(1);
}

const db = new PrismaClient();
main(db)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());

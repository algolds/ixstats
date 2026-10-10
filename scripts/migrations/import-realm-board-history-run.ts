/**
 * The run of scripts/migrations/import-realm-board-history.ts (the entry point only parses arguments and exits), kept
 * apart so a test can drive it with a fake database.
 */
import type { PrismaClient } from "@prisma/client";
import { boardThreadOf } from "~/server/modules/thinkpages-forum/board-thread";
import { lockThread, recountThread } from "~/server/modules/thinkpages-forum/thread-counts";
import { PERSONAL_ACCOUNT_TYPE } from "~/server/shared/thinkpages-personal-account";
import {
  messageSourceRef,
  planBoardHistory,
  summarizeBoardHistory,
  type ChatMessageRow,
  type HistoryPlan,
} from "./import-realm-board-history-plan";

const PAGE = 1000;
const CHUNK = 500;
const TRANSACTION_TIMEOUT_MS = 120_000;

interface BoardRun {
  realm: string;
  threadId: string | null;
  plan: HistoryPlan;
}

const chunksOf = <T>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size)
  );

/** Every message of the chat conversation (keyset-paged: the client has no row cap, but pages stay small). */
async function chatMessages(db: PrismaClient, conversationId: string): Promise<ChatMessageRow[]> {
  const out: ChatMessageRow[] = [];
  let after = "";
  for (;;) {
    const rows = await db.thinkshareMessage.findMany({
      where: { conversationId, id: { gt: after } },
      orderBy: { id: "asc" },
      take: PAGE,
      select: {
        id: true,
        userId: true,
        content: true,
        ixTimeTimestamp: true,
        deletedAt: true,
        isSystem: true,
      },
    });
    for (const { ixTimeTimestamp, ...row } of rows)
      out.push({ ...row, createdAt: ixTimeTimestamp });
    const last = rows[rows.length - 1];
    if (!last || rows.length < PAGE) return out;
    after = last.id;
  }
}

async function importedRefs(db: PrismaClient, messages: readonly ChatMessageRow[]) {
  const found = new Set<string>();
  for (const chunk of chunksOf(messages, PAGE)) {
    const rows = await db.forumPost.findMany({
      where: { sourceRef: { in: chunk.map((m) => messageSourceRef(m.id)) } },
      select: { sourceRef: true },
    });
    for (const row of rows) if (row.sourceRef) found.add(row.sourceRef);
  }
  return found;
}

/** The authors' user ids by Clerk id, and for the others their personal ThinkPages name. */
async function authorMaps(db: PrismaClient, messages: readonly ChatMessageRow[]) {
  const clerkIds = [...new Set(messages.map((m) => m.userId))];
  const users = await db.user.findMany({
    where: { clerkUserId: { in: clerkIds } },
    select: { id: true, clerkUserId: true },
  });
  const userIdByClerk = new Map(users.map((u) => [u.clerkUserId, u.id]));
  const unknown = clerkIds.filter((id) => !userIdByClerk.has(id));
  const accounts = await db.thinkpagesAccount.findMany({
    where: { clerkUserId: { in: unknown }, accountType: PERSONAL_ACCOUNT_TYPE },
    select: { clerkUserId: true, displayName: true },
  });
  return {
    userIdByClerk,
    nameByClerk: new Map(accounts.map((a) => [a.clerkUserId, a.displayName])),
  };
}

async function planBoard(
  db: PrismaClient,
  board: { realmId: string; groupId: string }
): Promise<BoardRun> {
  const realmRow = await db.realm.findUnique({
    where: { id: board.realmId },
    select: { name: true, slug: true },
  });
  const realm = realmRow ? `${realmRow.name} (${realmRow.slug})` : `realm ${board.realmId}`;
  const group = await db.thinktankGroup.findUnique({
    where: { id: board.groupId },
    select: { conversationId: true },
  });
  const messages = group?.conversationId ? await chatMessages(db, group.conversationId) : [];
  const thread = await boardThreadOf(db, board.realmId);
  const { userIdByClerk, nameByClerk } = await authorMaps(db, messages);
  const plan = planBoardHistory({
    threadId: thread?.threadId ?? "",
    messages,
    userIdByClerk,
    nameByClerk,
    imported: await importedRefs(db, messages),
  });
  return { realm, threadId: thread?.threadId ?? null, plan };
}

/** Creates the board's posts in chunks, then recounts the thread from the database under its lock. */
async function applyBoard(db: PrismaClient, threadId: string, plan: HistoryPlan): Promise<number> {
  let created = 0;
  for (const data of chunksOf(plan.posts, CHUNK)) {
    created += (await db.forumPost.createMany({ data, skipDuplicates: true })).count;
  }
  await db.$transaction(
    async (tx) => {
      await lockThread(tx, threadId);
      await recountThread(tx, threadId);
    },
    { timeout: TRANSACTION_TIMEOUT_MS }
  );
  return created;
}

/** The whole run against `db`: plan every board, print the report, and with `apply` write. Returns the exit code. */
export async function runBoardHistory(
  db: PrismaClient,
  apply: boolean,
  log: (line: string) => void = console.log,
  logError: (line: string) => void = console.error
): Promise<number> {
  const boards = await db.realmBoard.findMany({
    select: { realmId: true, groupId: true },
    orderBy: { createdAt: "asc" },
  });
  const runs: BoardRun[] = [];
  for (const board of boards) runs.push(await planBoard(db, board));
  for (const line of summarizeBoardHistory(runs.map((r) => ({ realm: r.realm, ...r.plan }))))
    log(`  ${line}`);

  const missing = runs.filter((r) => r.plan.posts.length > 0 && !r.threadId);
  if (missing.length > 0) {
    logError(
      `No board thread for: ${missing.map((r) => r.realm).join(", ")}. Apply the realm board migration and seeding first.`
    );
    return 1;
  }
  if (!apply) return 0;

  let created = 0;
  for (const run of runs) {
    if (run.threadId && run.plan.posts.length > 0) {
      created += await applyBoard(db, run.threadId, run.plan);
    }
  }
  log(`Applied: ${boards.length} boards, ${created} posts created.`);
  return 0;
}

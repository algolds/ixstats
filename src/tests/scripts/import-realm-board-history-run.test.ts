/** @jest-environment node */
import type { PrismaClient } from "@prisma/client";
import { runBoardHistory } from "../../../scripts/migrations/import-realm-board-history-run";

const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 12, minute));

const messages = [
  {
    id: "m1",
    userId: "clerk-1",
    content: "hello",
    ixTimeTimestamp: at(1),
    deletedAt: null,
    isSystem: false,
  },
  {
    id: "m2",
    userId: "clerk-x",
    content: "bye",
    ixTimeTimestamp: at(2),
    deletedAt: null,
    isSystem: false,
  },
  {
    id: "m3",
    userId: "clerk-1",
    content: "gone",
    ixTimeTimestamp: at(3),
    deletedAt: at(4),
    isSystem: false,
  },
];

function makeDb(options: { thread?: boolean } = {}) {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    forumPost: {
      count: jest.fn().mockResolvedValue(2),
      aggregate: jest.fn().mockResolvedValue({ _max: { createdAt: at(2) } }),
    },
    forumThread: { update: jest.fn().mockResolvedValue({}) },
  };
  const db = {
    realmBoard: { findMany: jest.fn().mockResolvedValue([{ realmId: "r1", groupId: "g1" }]) },
    realm: { findUnique: jest.fn().mockResolvedValue({ name: "Eurth", slug: "eurth" }) },
    thinktankGroup: { findUnique: jest.fn().mockResolvedValue({ conversationId: "c1" }) },
    thinkshareMessage: { findMany: jest.fn().mockResolvedValue(messages) },
    forumThread: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.thread === false ? null : { id: "t1", categoryId: "cat1" }),
    },
    user: { findMany: jest.fn().mockResolvedValue([{ id: "user-1", clerkUserId: "clerk-1" }]) },
    thinkpagesAccount: { findMany: jest.fn().mockResolvedValue([]) },
    forumPost: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockImplementation(async ({ data }: { data: unknown[] }) => ({
        count: data.length,
      })),
    },
    $transaction: jest.fn().mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { db, tx };
}

describe("runBoardHistory", () => {
  it("reports a dry run per realm and writes nothing", async () => {
    const { db } = makeDb();
    const lines: string[] = [];
    const code = await runBoardHistory(db as never as PrismaClient, false, (l) => lines.push(l));
    expect(code).toBe(0);
    expect(lines).toEqual([
      "  Eurth (eurth): 2 to import; skipped 1 deleted, 0 system, 0 blank, 0 already imported; 1 authors without an account",
      "  Total: 2 to import across 1 board; skipped 1 deleted, 0 system, 0 blank, 0 already imported; 1 authors without an account",
    ]);
    expect(db.forumPost.createMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("applies: creates the posts in the board thread and recounts it", async () => {
    const { db, tx } = makeDb();
    const lines: string[] = [];
    const code = await runBoardHistory(db as never as PrismaClient, true, (l) => lines.push(l));
    expect(code).toBe(0);
    const { data, skipDuplicates } = db.forumPost.createMany.mock.calls[0][0];
    expect(skipDuplicates).toBe(true);
    expect(
      data.map((p: { sourceRef: string; threadId: string }) => [p.sourceRef, p.threadId])
    ).toEqual([
      ["realm_board_message:m1", "t1"],
      ["realm_board_message:m2", "t1"],
    ]);
    expect(tx.forumThread.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { postCount: 2, lastPostAt: at(2) },
    });
    expect(lines[lines.length - 1]).toBe("Applied: 1 boards, 2 posts created.");
  });

  it("creates nothing on a rerun when every message is already imported", async () => {
    const { db } = makeDb();
    db.forumPost.findMany.mockResolvedValue([
      { sourceRef: "realm_board_message:m1" },
      { sourceRef: "realm_board_message:m2" },
    ]);
    await runBoardHistory(db as never as PrismaClient, true, () => undefined);
    expect(db.forumPost.createMany).not.toHaveBeenCalled();
  });

  it("refuses, writing nothing, when a board with messages has no board thread", async () => {
    const { db } = makeDb({ thread: false });
    const errors: string[] = [];
    const code = await runBoardHistory(
      db as never as PrismaClient,
      true,
      () => undefined,
      (l) => errors.push(l)
    );
    expect(code).toBe(1);
    expect(errors[0]).toMatch(/No board thread for: Eurth \(eurth\)/);
    expect(db.forumPost.createMany).not.toHaveBeenCalled();
  });
});

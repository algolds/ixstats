/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 416 item 2 (SEC-11). Margin is readable by anyone, so a reader learns an author's display name,
// avatar and an `isAuthor` flag, never an internal id, a Discord handle, a role or a country. Only a
// thread's creator or a sysop (`editprotected`) may resolve, reopen or delete it; a comment can be
// deleted by its author or a sysop. Threads page by 50 and comments by 100.
jest.mock("~/server/db", () => {
  const { createTable, fakeWikiDb } = jest.requireActual("~/tests/helpers/fake-wiki-db");
  const threads = createTable();
  const comments = createTable();
  type Args = { include?: { comments: { orderBy: object[]; take: number } } } & Record<
    string,
    unknown
  >;
  const db: Record<string, unknown> = {
    ...fakeWikiDb.db,
    wikiDiscussionComment: {
      ...comments,
      delete: async ({ where }: { where: { id: string } }) => comments.deleteMany({ where }),
    },
    wikiDiscussionThread: {
      ...threads,
      // the fake tables ignore `include`; this one joins a thread's comments and their count
      findMany: async ({ include, ...args }: Args) => {
        const rows = await threads.findMany(args);
        return Promise.all(
          rows.map(async (thread: { id: string }) => ({
            ...thread,
            comments: await comments.findMany({
              where: { threadId: thread.id },
              orderBy: include?.comments.orderBy,
              take: include?.comments.take,
            }),
            _count: { comments: await comments.count({ where: { threadId: thread.id } }) },
          }))
        );
      },
      delete: async ({ where }: { where: { id: string } }) => {
        await comments.deleteMany({ where: { threadId: where.id } });
        return threads.deleteMany({ where });
      },
    },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(db),
  };
  return {
    __esModule: true,
    db,
    isDatabaseReadOnly: true,
    __tables: { threads, comments },
  };
});
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "user_owner",
  SYSTEM_OWNER_IDS: ["user_owner"],
  UserManagementService: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosDiscussionsRouter } from "~/server/api/routers/wikios/discussions";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { fakeWikiDb, type Table } from "~/tests/helpers/fake-wiki-db";

const { threads, comments } = (
  jest.requireMock("~/server/db") as { __tables: { threads: Table; comments: Table } }
).__tables;
const { tables } = fakeWikiDb;

type Who = "creator" | "other" | "sysop" | "anon";
const USERS: Record<Exclude<Who, "anon">, { id: string; clerk: string; role: string }> = {
  creator: { id: "db_creator", clerk: "user_creator", role: "user" },
  other: { id: "db_other", clerk: "user_other", role: "user" },
  sysop: { id: "db_sysop", clerk: "user_sysop", role: "admin" },
};

const ctxOf = (who: Who) =>
  createMockRouterContext(
    who === "anon"
      ? { auth: null, user: null }
      : {
          auth: { userId: USERS[who].clerk },
          user: {
            id: USERS[who].id,
            clerkUserId: USERS[who].clerk,
            role: { name: USERS[who].role, level: 100 },
          },
        }
  ) as never;
const margin = (who: Who) => createCallerFactory(wikiosDiscussionsRouter)(ctxOf(who));

const THREAD = {
  articleTitle: "Caphiria",
  status: "OPEN",
  title: "Border dispute",
  sectionAnchor: null,
  selectedText: null,
  anchorOffset: null,
  resolvedAt: null,
  resolvedBy: null,
  teamId: null,
  updatedAt: new Date("2026-09-01T00:00:00Z"),
};

beforeEach(() => {
  fakeWikiDb.reset();
  threads.reset();
  comments.reset();
  tables.user.seed(
    {
      id: "db_creator",
      clerkUserId: "user_creator",
      wikiUsername: "Alice",
      discordUserId: "discord_111",
      discordUsername: "alice#1234",
      country: { name: "Caphiria" },
    },
    {
      id: "db_other",
      clerkUserId: "user_other",
      wikiUsername: null,
      discordUserId: "discord_222",
      discordUsername: "bob_the_discord_handle",
      country: { name: "Urcea" },
    },
    {
      id: "db_ghost",
      clerkUserId: "user_ghost",
      wikiUsername: null,
      discordUserId: "discord_333",
      discordUsername: "ghost_handle",
      country: null,
    }
  );
});

function seedThread(overrides: Record<string, unknown> = {}, commentCount = 1) {
  const thread = threads.insert({ ...THREAD, createdBy: "db_creator", ...overrides });
  for (let i = 0; i < commentCount; i++) {
    comments.insert({
      threadId: thread.id,
      userId: i === 0 ? thread.createdBy : "db_other",
      content: `comment ${i}`,
      suggestedEdit: null,
      reactions: null,
      updatedAt: new Date("2026-09-01T00:00:00Z"),
    });
  }
  return thread;
}

describe("getArticleMarginData does not leak who the authors are", () => {
  it("returns only a display name, an avatar and isAuthor for each author", async () => {
    seedThread();

    const { threads: page } = await margin("anon").getArticleMarginData({ articleTitle: "Caphiria" });

    expect(Object.keys(page[0]!.createdBy).sort()).toEqual(["avatar", "isAuthor", "username"]);
    expect(Object.keys(page[0]!.comments[0]!.author).sort()).toEqual([
      "avatar",
      "isAuthor",
      "username",
    ]);
    const wire = JSON.stringify(page);
    for (const secret of ["db_creator", "db_other", "user_creator", "discord_111", "alice#1234"]) {
      expect(wire).not.toContain(secret);
    }
  });

  it("names an author by wiki username, then country, and never by a Discord handle", async () => {
    seedThread({ createdBy: "db_creator" });
    seedThread({ createdBy: "db_other", title: "Second" });
    seedThread({ createdBy: "db_ghost", title: "Third" });
    seedThread({ createdBy: "user_unknown_id", title: "Fourth" });

    const { threads: page } = await margin("anon").getArticleMarginData({ articleTitle: "Caphiria" });
    const nameOf = (title: string) => page.find((t) => t.title === title)?.createdBy.username;

    expect(nameOf("Border dispute")).toBe("Alice");
    expect(nameOf("Second")).toBe("Urcea");
    expect(nameOf("Third")).toBe("Unknown user");
    expect(nameOf("Fourth")).toBe("Unknown user");
    expect(JSON.stringify(page)).not.toMatch(/bob_the_discord_handle|ghost_handle|user_unknown_id/);
  });

  it("does not expose the resolver's id either", async () => {
    seedThread({ status: "RESOLVED", resolvedBy: "db_other", resolvedAt: new Date() });

    const { threads: page } = await margin("anon").getArticleMarginData({
      articleTitle: "Caphiria",
      status: "ALL",
    });

    expect(page[0]!.resolvedBy).toEqual({ username: "Urcea" });
  });
  it("tells only a sysop that they may moderate", async () => {
    seedThread();

    expect((await margin("sysop").getArticleMarginData({ articleTitle: "Caphiria" })).canModerate).toBe(true);
    expect((await margin("creator").getArticleMarginData({ articleTitle: "Caphiria" })).canModerate).toBe(false);
    expect((await margin("anon").getArticleMarginData({ articleTitle: "Caphiria" })).canModerate).toBe(false);
  });
});

describe("paging", () => {
  it("hides the comments of a deleted page's thread from readers without deletedhistory", async () => {
    tables.wikiArticle.seed({ source: "ixwiki", title: "Caphiria", slug: "caphiria", status: "ARCHIVED" });
    const thread = seedThread();

    await expect(margin("other").getThreadComments({ threadId: thread.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(margin("sysop").getThreadComments({ threadId: thread.id })).resolves.toBeDefined();
  });
});

describe("resolveThread", () => {
  it.each([["creator"], ["sysop"]] as const)("lets %s resolve and reopen a thread", async (who) => {
    const thread = seedThread();

    const resolved = await margin(who).resolveThread({ threadId: thread.id, resolved: true });
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolvedBy).toBe(USERS[who].id);
    const reopened = await margin(who).resolveThread({ threadId: thread.id, resolved: false });
    expect(reopened.status).toBe("OPEN");
    expect(reopened.resolvedBy).toBeNull();
  });

  it("refuses anyone else, and changes nothing", async () => {
    const thread = seedThread();

    await expect(
      margin("other").resolveThread({ threadId: thread.id, resolved: true })
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringMatching(/^permissiondenied:/) });
    expect((await threads.findUnique({ where: { id: thread.id } }))!.status).toBe("OPEN");
  });

  it("refuses to reopen a thread someone else resolved", async () => {
    const thread = seedThread({ status: "RESOLVED", resolvedBy: "db_creator" });

    await expect(
      margin("other").resolveThread({ threadId: thread.id, resolved: false })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("deleteThread", () => {
  it.each([["creator"], ["sysop"]] as const)("lets %s delete a thread", async (who) => {
    const thread = seedThread();

    await expect(margin(who).deleteThread({ threadId: thread.id })).resolves.toEqual({ success: true });
    expect(threads.rows).toHaveLength(0);
  });

  it("refuses anyone else", async () => {
    const thread = seedThread();

    await expect(margin("other").deleteThread({ threadId: thread.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(threads.rows).toHaveLength(1);
  });
});

describe("deleteComment", () => {
  it("refuses someone else's comment", async () => {
    seedThread({}, 1); // by the creator
    const target = comments.rows[0]!;

    await expect(margin("other").deleteComment({ commentId: target.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/^permissiondenied:/),
    });
    expect(comments.rows).toHaveLength(1);
  });
  it("answers NOT_FOUND for a missing comment, refuses a signed-out caller, BAD_REQUEST for a long id", async () => {
    await expect(margin("creator").deleteComment({ commentId: "nope" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(margin("anon").deleteComment({ commentId: "nope" })).rejects.toThrow(
      "Authentication required"
    );
    await expect(margin("creator").deleteComment({ commentId: "c".repeat(65) })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("refuses a blocked author", async () => {
    seedThread({}, 1);
    tables.wikiBlock.seed({ userId: "db_creator", reason: "vandalism" });

    await expect(margin("creator").deleteComment({ commentId: comments.rows[0]!.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/^blocked:/),
    });
  });
});

describe("writing to a deleted page's Margin", () => {
  const archive = () =>
    tables.wikiArticle.seed({
      source: "ixwiki",
      title: "Caphiria",
      slug: "caphiria",
      status: "ARCHIVED",
    });
  const newThread = { articleTitle: "Caphiria", title: "Border dispute", content: "Look at this" };
  it("answers NOT_FOUND to createThread for a deleted page, and writes nothing", async () => {
    archive();

    await expect(margin("other").createThread(newThread)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(threads.rows).toHaveLength(0);
    expect(comments.rows).toHaveLength(0);
  });
  it("answers NOT_FOUND to postComment on a deleted page's thread, and writes nothing", async () => {
    const thread = seedThread({}, 1);
    archive();

    await expect(
      margin("other").postComment({ threadId: thread.id, content: "Me too" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(comments.rows).toHaveLength(1);
  });
});

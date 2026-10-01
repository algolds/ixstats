/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 409: a blocked user cannot post margin discussions or annotations either (stashes stay allowed: private).
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "user_owner",
  SYSTEM_OWNER_IDS: ["user_owner"],
  UserManagementService: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosDiscussionsRouter } from "~/server/api/routers/wikios/discussions";
import { wikiosWatchlistAnnotationsRouter } from "~/server/api/routers/wikios/watchlist-annotations";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const { tables } = fakeWikiDb;

const ctx = () =>
  createMockRouterContext({
    auth: { userId: "user_1" },
    user: {
      id: "db1",
      clerkUserId: "user_1",
      wikiUsername: "Vandal",
      role: { name: "user", level: 100 },
    },
  }) as never;

const discussions = () => createCallerFactory(wikiosDiscussionsRouter)(ctx());
const annotations = () => createCallerFactory(wikiosWatchlistAnnotationsRouter)(ctx());

const blocked = { code: "FORBIDDEN", message: expect.stringMatching(/^blocked: .*vandalism/) };

beforeEach(() => {
  fakeWikiDb.reset();
});

describe("a blocked user", () => {
  beforeEach(() => {
    tables.wikiBlock.seed({ userId: "db1", reason: "vandalism" });
  });

  it("cannot start, answer, resolve or delete a margin discussion", async () => {
    await expect(
      discussions().createThread({ articleTitle: "Page", title: "Thread", content: "hello" })
    ).rejects.toMatchObject(blocked);
    await expect(
      discussions().postComment({ threadId: "t_1", content: "hi" })
    ).rejects.toMatchObject(blocked);
    await expect(
      discussions().resolveThread({ threadId: "t_1", resolved: true })
    ).rejects.toMatchObject(blocked);
    await expect(discussions().deleteThread({ threadId: "t_1" })).rejects.toMatchObject(blocked);
  });

  it("cannot add an annotation", async () => {
    await expect(
      annotations().addAnnotation({ pageTitle: "Page", selectedText: "x" })
    ).rejects.toMatchObject(blocked);
  });
});

describe("an unblocked user and an expired block", () => {
  it("get past the block check (and fail later, on the missing thread tables of this fake)", async () => {
    tables.wikiBlock.seed({ userId: "db1", reason: "old", expiresAt: new Date(Date.now() - 1000) });
    await expect(
      discussions().postComment({ threadId: "t_1", content: "hi" })
    ).rejects.not.toMatchObject({ message: expect.stringMatching(/^blocked:/) });
  });
});

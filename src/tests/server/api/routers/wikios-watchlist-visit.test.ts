/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 416 item 3: a watcher is notified once about a page until they visit it. Viewing a watched
// page (`markWatchedVisited`) and "mark all visited" clear the mark that stops further notices.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: { findFirst: jest.fn() },
    wikiWatchlist: { updateMany: jest.fn() },
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: () => false,
  UserManagementService: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosWatchlistAnnotationsRouter } from "~/server/api/routers/wikios/watchlist-annotations";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { db } from "~/server/db";

const mockDb = db as unknown as {
  wikiArticle: { findFirst: jest.Mock };
  wikiWatchlist: { updateMany: jest.Mock };
};

const caller = () =>
  createCallerFactory(wikiosWatchlistAnnotationsRouter)(
    createMockRouterContext({
      auth: { userId: "user_clerk_1" },
      user: { id: "db_user_1", clerkUserId: "user_clerk_1", role: { name: "user", level: 100 } },
      db,
    }) as never
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.wikiArticle.findFirst.mockResolvedValue({ id: "art1" });
  mockDb.wikiWatchlist.updateMany.mockResolvedValue({ count: 1 });
});

describe("markWatchedVisited", () => {
  it("clears the unread dot and the notified mark of the caller's watch of that page", async () => {
    await expect(caller().markWatchedVisited({ pageTitle: "Caphiria_Major" })).resolves.toEqual({
      success: true,
    });

    expect(mockDb.wikiArticle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          source: "ixwiki",
          OR: [{ title: "Caphiria_Major" }, { title: "Caphiria Major" }],
        },
      })
    );
    expect(mockDb.wikiWatchlist.updateMany).toHaveBeenCalledWith({
      where: { userId: "db_user_1", articleId: "art1" },
      data: { lastViewedTime: expect.any(Date), notificationTime: null },
    });
  });

  it("does nothing for a page that does not exist", async () => {
    mockDb.wikiArticle.findFirst.mockResolvedValue(null);

    await caller().markWatchedVisited({ pageTitle: "No such page" });

    expect(mockDb.wikiWatchlist.updateMany).not.toHaveBeenCalled();
  });

  it("caps the title and sits on the rate-limited mutation builder", async () => {
    await expect(caller().markWatchedVisited({ pageTitle: "t".repeat(513) })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    const source = readFileSync(
      join(process.cwd(), "src/server/api/routers/wikios/watchlist-annotations.ts"),
      "utf8"
    );
    expect(source).toMatch(/markWatchedVisited: lightMutationProcedure/);
  });
});

describe("markAllWatchedVisited", () => {
  it("clears every watched page's notified mark along with its unread dot", async () => {
    await caller().markAllWatchedVisited();

    expect(mockDb.wikiWatchlist.updateMany).toHaveBeenCalledWith({
      where: { userId: "db_user_1" },
      data: { lastViewedTime: expect.any(Date), notificationTime: null },
    });
  });
});

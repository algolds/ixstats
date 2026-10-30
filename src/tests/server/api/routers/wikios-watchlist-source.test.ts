/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factory relies on the ambient global.
//
// The watchlist and Margin notes are IxWiki's: they read and remove only IxWiki stash items, as the writers save them,
// so a sister-wiki page of the same title in a stash is never read as watched, unwatched or annotated.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
    stashAnnotation: { findMany: jest.fn(async () => []) },
    stash: { findFirst: jest.fn(async () => ({ id: "watch_1", userId: "db_user_1" })) },
    stashItem: {
      findFirst: jest.fn(async () => null),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    wikiArticle: { findFirst: jest.fn(async () => null) },
    wikiWatchlist: { deleteMany: jest.fn(), findUnique: jest.fn(async () => null) },
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/wiki-os/permissions", () => ({
  __esModule: true,
  assertPageVisible: jest.fn(async () => undefined),
  requireNotBlocked: jest.fn(async () => undefined),
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosWatchlistAnnotationsRouter } from "~/server/api/routers/wikios/watchlist-annotations";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { db } from "~/server/db";

const mocked = db as unknown as {
  stashAnnotation: { findMany: jest.Mock };
  stashItem: { findFirst: jest.Mock; deleteMany: jest.Mock };
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
});

describe("the watchlist and Margin notes read IxWiki stash items only", () => {
  it("getAnnotations", async () => {
    await caller().getAnnotations({ pageTitle: "Caphiria" });

    expect(mocked.stashAnnotation.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { item: { pageTitle: "Caphiria", source: "ixwiki" } },
    });
  });

  it("unwatchPage", async () => {
    await caller().unwatchPage({ pageTitle: "Caphiria" });

    expect(mocked.stashItem.deleteMany).toHaveBeenCalledWith({
      where: { stashId: "watch_1", pageTitle: "Caphiria", contentType: "wiki", source: "ixwiki" },
    });
  });

  it("isPageWatched", async () => {
    await caller().isPageWatched({ pageTitle: "Caphiria" });

    expect(mocked.stashItem.findFirst).toHaveBeenCalledWith({
      where: { stashId: "watch_1", pageTitle: "Caphiria", contentType: "wiki", source: "ixwiki" },
    });
  });
});

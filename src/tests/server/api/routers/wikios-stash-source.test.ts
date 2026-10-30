/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// A stash item is keyed by (stash, content type, wiki source, title): a page of IIWiki and a page of IxWiki with the
// same title sit side by side in one stash, isStashed and unstashPage name the wiki they mean, and a call that names
// none means IxWiki.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
    stash: {
      findFirst: jest.fn(async () => ({
        id: "stash_1",
        userId: "db_user_1",
        name: "My Stash",
        isDefault: true,
      })),
      findMany: jest.fn(async () => [{ id: "stash_1" }]),
      create: jest.fn(),
    },
    get stashItem() {
      return fakeStashItem;
    },
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: () => false,
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: () => false,
}));
jest.mock("~/lib/wiki-os/permissions", () => ({
  __esModule: true,
  requireNotBlocked: jest.fn(async () => undefined),
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosStashRouter } from "~/server/api/routers/wikios/stash";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { db } from "~/server/db";

type FakeItem = {
  id: string;
  stashId: string;
  pageTitle: string;
  pageSlug: string;
  contentType: string;
  source: string;
  note: string | null;
  savedAt: Date;
  updatedAt: Date;
  stash: { id: string; name: string };
};
type ListWhere = {
  stashId?: string | { in: string[] };
  pageTitle?: string;
  contentType?: string;
  source?: string;
};

const store: FakeItem[] = [];

function matches(item: FakeItem, where: ListWhere): boolean {
  const stashOk =
    where.stashId === undefined ||
    (typeof where.stashId === "string"
      ? item.stashId === where.stashId
      : where.stashId.in.includes(item.stashId));
  return (
    stashOk &&
    (where.pageTitle === undefined || item.pageTitle === where.pageTitle) &&
    (where.contentType === undefined || item.contentType === where.contentType) &&
    (where.source === undefined || item.source === where.source)
  );
}

const fakeStashItem = {
  upsert: jest.fn(
    async (args: {
      where: {
        stashId_contentType_source_pageTitle?: {
          stashId: string;
          contentType: string;
          source: string;
          pageTitle: string;
        };
      };
      create: Partial<FakeItem> & { stashId: string; pageTitle: string };
      update: Partial<FakeItem>;
    }) => {
      const key = args.where.stashId_contentType_source_pageTitle;
      if (!key) throw new Error("upsert must use the stashId_contentType_source_pageTitle key");
      const existing = store.find(
        (i) =>
          i.stashId === key.stashId &&
          i.contentType === key.contentType &&
          i.source === key.source &&
          i.pageTitle === key.pageTitle
      );
      if (existing) return Object.assign(existing, args.update);
      const created: FakeItem = {
        id: `item_${store.length + 1}`,
        pageSlug: "",
        note: null,
        savedAt: new Date(),
        updatedAt: new Date(),
        stash: { id: args.create.stashId, name: "My Stash" },
        contentType: "wiki",
        source: "ixwiki",
        ...args.create,
      };
      store.push(created);
      return created;
    }
  ),
  findMany: jest.fn(async (args: { where: ListWhere }) =>
    store
      .filter((i) => matches(i, args.where))
      .map((i) => ({ ...i, stash: { ...i.stash, color: "#000" } }))
  ),
  deleteMany: jest.fn(async (args: { where: ListWhere }) => {
    const doomed = store.filter((i) => matches(i, args.where));
    for (const item of doomed) store.splice(store.indexOf(item), 1);
    return { count: doomed.length };
  }),
};

const caller = () =>
  createCallerFactory(wikiosStashRouter)(
    createMockRouterContext({
      auth: { userId: "user_clerk_1" },
      user: {
        id: "db_user_1",
        clerkUserId: "user_clerk_1",
        countryId: "country_1",
        role: { name: "user", level: 100 },
      },
      db,
    }) as never
  );

beforeEach(() => {
  store.length = 0;
  jest.clearAllMocks();
});

describe("a stash holds the same title once per wiki", () => {
  it("keeps an IIWiki page and the IxWiki page of one title side by side", async () => {
    await caller().stashPage({ pageTitle: "Caphiria", source: "iiwiki" });
    await caller().stashPage({ pageTitle: "Caphiria", source: "ixwiki" });

    expect(store.map((i) => i.source).sort()).toEqual(["iiwiki", "ixwiki"]);
  });

  it("stashing the same wiki's page twice stays one item", async () => {
    await caller().stashPage({ pageTitle: "Caphiria", source: "althistory" });
    await caller().stashPage({ pageTitle: "Caphiria", source: "althistory" });

    expect(store).toHaveLength(1);
  });

  it("a call that names no wiki means IxWiki", async () => {
    await caller().stashPage({ pageTitle: "Caphiria" });

    expect(store.map((i) => i.source)).toEqual(["ixwiki"]);
  });

  it("rejects a wiki WikiOS does not read", async () => {
    await expect(
      caller().stashPage({ pageTitle: "Caphiria", source: "elsewhere" } as never)
    ).rejects.toThrow();
  });
});

describe("isStashed names the wiki it asks about", () => {
  it("is true only for the wiki whose page was stashed", async () => {
    await caller().stashPage({ pageTitle: "Caphiria", source: "iiwiki" });

    expect((await caller().isStashed({ pageTitle: "Caphiria", source: "iiwiki" })).stashed).toBe(
      true
    );
    expect((await caller().isStashed({ pageTitle: "Caphiria", source: "ixwiki" })).stashed).toBe(
      false
    );
    expect((await caller().isStashed({ pageTitle: "Caphiria" })).stashed).toBe(false);
  });
});

describe("unstashPage removes the page of one wiki", () => {
  it.each([
    ["in one stash", { stashId: "stash_1" }],
    ["in all the user's stashes", {}],
  ])("leaves the IxWiki item when the IIWiki page is unstashed, %s", async (_where, extra) => {
    await caller().stashPage({ pageTitle: "Caphiria", source: "iiwiki" });
    await caller().stashPage({ pageTitle: "Caphiria", source: "ixwiki" });

    await caller().unstashPage({ pageTitle: "Caphiria", source: "iiwiki", ...extra });

    expect(store.map((i) => i.source)).toEqual(["ixwiki"]);
  });
});

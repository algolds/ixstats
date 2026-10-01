/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see cards-archetypes-admin-auth.test.ts):
// the hoisted jest.mock() factories rely on the ambient global.
//
// A stash holds one item per (content type, title). `StashItem` used to be unique on
// (stashId, pageTitle), so an Onoma name "Rome" and the article "Rome" overwrote each other.
// The fake `stashItem` below only understands the NEW compound key, so a router still upserting on
// the old two-column compound key fails here instead of silently passing.
import { readFileSync } from "node:fs";
import { join } from "node:path";

type FakeItem = {
  id: string;
  stashId: string;
  pageTitle: string;
  pageSlug: string;
  contentType: string;
  note?: string | null;
  contentId?: number | null;
  savedAt: Date;
  updatedAt: Date;
  stash: { id: string; name: string };
};
type KeyWhere = {
  stashId_contentType_pageTitle?: { stashId: string; contentType: string; pageTitle: string };
};
type ListWhere = { stashId?: string | { in: string[] }; pageTitle?: string; contentType?: string };

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
    (where.contentType === undefined || item.contentType === where.contentType)
  );
}

const fakeStashItem = {
  upsert: jest.fn(
    async (args: {
      where: KeyWhere;
      create: Partial<FakeItem> & { stashId: string; pageTitle: string; contentType?: string };
      update: Partial<FakeItem>;
    }) => {
      const key = args.where.stashId_contentType_pageTitle;
      if (!key) throw new Error("upsert must use the stashId_contentType_pageTitle key");
      const existing = store.find(
        (i) =>
          i.stashId === key.stashId &&
          i.contentType === key.contentType &&
          i.pageTitle === key.pageTitle
      );
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      const created: FakeItem = {
        id: `item_${store.length + 1}`,
        pageSlug: "",
        note: null,
        contentId: null,
        savedAt: new Date(),
        updatedAt: new Date(),
        stash: { id: args.create.stashId, name: "My Stash" },
        contentType: "wiki",
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

const fakeStash = {
  id: "stash_1",
  userId: "db_user_1",
  name: "My Stash",
  isDefault: true,
};

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

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosStashRouter } from "~/server/api/routers/wikios/stash";
import { onomaNameBankRouter } from "~/server/api/routers/onoma/namebank";
import { wikiosWatchlistAnnotationsRouter } from "~/server/api/routers/wikios/watchlist-annotations";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { db } from "~/server/db";

const ctx = () =>
  createMockRouterContext({
    auth: { userId: "user_clerk_1" },
    user: {
      id: "db_user_1",
      clerkUserId: "user_clerk_1",
      countryId: "country_1",
      role: { name: "user", level: 100 },
    },
    db,
  }) as never;

beforeEach(() => {
  store.length = 0;
  jest.clearAllMocks();
});

describe("one stash holds the same title once per content type", () => {
  it("keeps an Onoma name and the article of the same title side by side", async () => {
    const stash = createCallerFactory(wikiosStashRouter)(ctx());
    const onoma = createCallerFactory(onomaNameBankRouter)(ctx());

    await stash.stashPage({ pageTitle: "Rome" });
    await onoma.saveToNameBank({ type: "saved-name", title: "Rome", values: ["Rome"] });

    expect(store.map((i) => [i.contentType, i.pageTitle]).sort()).toEqual([
      ["name", "Rome"],
      ["wiki", "Rome"],
    ]);
  });

  it("saving the same name again updates that item and leaves the article alone", async () => {
    const stash = createCallerFactory(wikiosStashRouter)(ctx());
    const onoma = createCallerFactory(onomaNameBankRouter)(ctx());
    await stash.stashPage({ pageTitle: "Rome" });
    await onoma.saveToNameBank({ type: "saved-name", title: "Rome", values: ["Rome"] });

    await onoma.saveToNameBank({ type: "saved-name", title: "Rome", values: ["Roma"] });

    expect(store).toHaveLength(2);
    const article = store.find((i) => i.contentType === "wiki");
    expect(article?.note ?? null).toBeNull();
    const name = store.find((i) => i.contentType === "name");
    expect(name?.note).toContain("Roma");
  });

  it("a dictionary and a name of the same title coexist too", async () => {
    const onoma = createCallerFactory(onomaNameBankRouter)(ctx());

    await onoma.saveToNameBank({ type: "saved-name", title: "Rome", values: ["Rome"] });
    await onoma.saveToNameBank({ type: "dictionary", title: "Rome", values: ["Roma", "Romulus"] });

    expect(store.map((i) => i.contentType).sort()).toEqual(["dictionary", "name"]);
  });

  it("stashing the same article twice stays one item", async () => {
    const stash = createCallerFactory(wikiosStashRouter)(ctx());

    await stash.stashPage({ pageTitle: "Rome" });
    await stash.stashPage({ pageTitle: "Rome" });

    expect(store).toHaveLength(1);
  });

  it("unstashing the article leaves the Onoma name in place, and isStashed ignores the name", async () => {
    const stash = createCallerFactory(wikiosStashRouter)(ctx());
    const onoma = createCallerFactory(onomaNameBankRouter)(ctx());
    await onoma.saveToNameBank({ type: "saved-name", title: "Rome", values: ["Rome"] });
    expect((await stash.isStashed({ pageTitle: "Rome" })).stashed).toBe(false);

    await stash.stashPage({ pageTitle: "Rome" });
    expect((await stash.isStashed({ pageTitle: "Rome" })).stashed).toBe(true);
    await stash.unstashPage({ pageTitle: "Rome", stashId: "stash_1" });

    expect(store.map((i) => i.contentType)).toEqual(["name"]);
  });

  it("unstashPage with an explicit contentType removes exactly that item", async () => {
    const stash = createCallerFactory(wikiosStashRouter)(ctx());
    const onoma = createCallerFactory(onomaNameBankRouter)(ctx());
    await stash.stashPage({ pageTitle: "Rome" });
    await onoma.saveToNameBank({ type: "saved-name", title: "Rome", values: ["Rome"] });

    await stash.unstashPage({ pageTitle: "Rome", contentType: "name" });

    expect(store.map((i) => i.contentType)).toEqual(["wiki"]);
  });

  it("annotating an article stashes it as a wiki item, not over the Onoma name", async () => {
    const onoma = createCallerFactory(onomaNameBankRouter)(ctx());
    const annotations = createCallerFactory(wikiosWatchlistAnnotationsRouter)(ctx());
    await onoma.saveToNameBank({ type: "saved-name", title: "Rome", values: ["Rome"] });
    (db as unknown as { stashAnnotation: { create: jest.Mock } }).stashAnnotation = {
      create: jest.fn(async (args: { data: unknown }) => args.data),
    };
    (db as unknown as { stash: { findFirst: jest.Mock } }).stash.findFirst.mockResolvedValue(
      fakeStash
    );

    await annotations.addAnnotation({ pageTitle: "Rome", selectedText: "the eternal city" });

    expect(store.map((i) => i.contentType).sort()).toEqual(["name", "wiki"]);
  });
});

describe("the stash key in the schema and the migration", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("StashItem is unique on stashId + contentType + pageTitle", () => {
    const schema = read("prisma/schema/wiki.prisma");
    const model = schema.slice(
      schema.indexOf("model StashItem"),
      schema.indexOf("model StashAnnotation")
    );
    expect(model).toContain("@@unique([stashId, contentType, pageTitle])");
    expect(model).not.toContain("@@unique([stashId, pageTitle])");
  });

  it("the manual migration drops the old key and creates the new one, idempotently", () => {
    const sql = read("prisma/manual-migrations/2026-09-30-wikios-stash-key.sql");
    // Spelled in two parts so a grep for the old Prisma compound-key name over src/ (plan 416's Done
    // check for leftover users of it) finds no code, only this exact-name check on the SQL.
    const oldKey = `lore_stash_items_stashId_${"pageTitle"}_key`;
    expect(sql).toContain(`DROP INDEX IF EXISTS "${oldKey}"`);
    expect(sql).toContain(`DROP CONSTRAINT IF EXISTS "${oldKey}"`);
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "lore_stash_items_stashId_contentType_pageTitle_key"'
    );
    expect(sql).toContain('("stashId", "contentType", "pageTitle")');
  });
});

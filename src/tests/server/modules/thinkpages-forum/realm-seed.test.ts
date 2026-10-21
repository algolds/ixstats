/** @jest-environment node */
import { seedRealmCategories } from "~/server/modules/thinkpages-forum/realm-seed";

type CategoryRow = Record<string, unknown>;
type ManyArgs<T> = { data: T[]; skipDuplicates: boolean };

/** An in-memory forum that honours the (scope, realmId, key) and sourceRef unique indexes like skipDuplicates. */
function fakeForum() {
  const categories: CategoryRow[] = [];
  const threads: Array<Record<string, unknown>> = [];
  const forumCategory = {
    createMany: jest.fn(async (args: ManyArgs<CategoryRow>) => {
      let count = 0;
      for (const row of args.data) {
        const taken = categories.some(
          (c) => c.scope === row.scope && c.realmId === row.realmId && c.key === row.key
        );
        if (taken) continue;
        categories.push({ id: `cat_${row.key}`, ...row });
        count += 1;
      }
      return { count };
    }),
    findFirst: jest.fn(
      async (args: { where: CategoryRow }) =>
        categories.find((c) => c.realmId === args.where.realmId && c.key === args.where.key) ?? null
    ),
  };
  const forumThread = {
    createMany: jest.fn(async (args: ManyArgs<Record<string, unknown>>) => {
      let count = 0;
      for (const row of args.data) {
        if (threads.some((t) => t.sourceRef === row.sourceRef)) continue;
        threads.push(row);
        count += 1;
      }
      return { count };
    }),
  };
  return { categories, threads, db: { forumCategory, forumThread } };
}

describe("seedRealmCategories", () => {
  it("gives the board category exactly one thread titled for the realm, with no author and unpinned", async () => {
    const { db, threads } = fakeForum();
    await seedRealmCategories(db as never, { id: "r1", name: "Eurth" });
    expect(threads).toEqual([
      {
        categoryId: "cat_board",
        title: "Eurth board",
        authorUserId: null,
        pinned: false,
        sourceRef: "realm_board_thread:r1",
      },
    ]);
  });

  it("is idempotent: a second run creates nothing and leaves one board thread", async () => {
    const { db, categories, threads } = fakeForum();
    await seedRealmCategories(db as never, { id: "r1", name: "Eurth" });
    const again = await seedRealmCategories(db as never, { id: "r1", name: "Eurth" });
    expect(again).toEqual({ created: 0 });
    expect(categories).toHaveLength(4);
    expect(threads).toHaveLength(1);
  });

  it("heals a realm that has its categories but lost the board thread", async () => {
    const { db, threads } = fakeForum();
    await seedRealmCategories(db as never, { id: "r1", name: "Eurth" });
    threads.length = 0;
    await seedRealmCategories(db as never, { id: "r1", name: "Eurth" });
    expect(threads).toHaveLength(1);
  });
});

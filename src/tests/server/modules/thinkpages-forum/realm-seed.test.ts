/** @jest-environment node */
import { seedRealmCategories } from "~/server/modules/thinkpages-forum/realm-seed";

describe("seedRealmCategories", () => {
  it("creates the three realm categories in one idempotent insert and returns the count", async () => {
    const createMany = jest.fn(async () => ({ count: 2 }));
    const result = await seedRealmCategories({ forumCategory: { createMany } } as never, "r1");

    expect(result).toEqual({ created: 2 });
    expect(createMany).toHaveBeenCalledTimes(1);
    const arg = (createMany.mock.calls[0] as unknown as [{ data: Record<string, unknown>[]; skipDuplicates: boolean }])[0];
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data).toHaveLength(3);
    expect(arg.data.map((d) => d.key)).toEqual(["hub", "character-threads", "current-events"]);
    for (const row of arg.data) {
      expect(row).toMatchObject({ scope: "realm", realmId: "r1", visibility: "public", postRole: "any" });
    }
    expect(arg.data.map((d) => d.icAllowed)).toEqual([false, true, true]);
    expect(arg.data.map((d) => [d.key, d.style])).toEqual([
      ["hub", "ooc"],
      ["character-threads", "ic"],
      ["current-events", "ic"],
    ]);
  });
});

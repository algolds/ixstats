/** @jest-environment node */
import { moderationContext } from "~/server/modules/thinkpages-forum";
import {
  admin,
  eurthMod,
  generalMod,
  member,
  moderatorOf,
  seed,
} from "~/tests/helpers/forum-mod-fixtures";
import { forumStore } from "~/tests/helpers/forum-store-fake";

const EMPTY = { isSiteAdmin: false, realms: [], categories: [] };

describe("moderationContext", () => {
  it("is empty for anonymous visitors and members, without a query", async () => {
    const store = forumStore(seed());
    await expect(moderationContext(store.db as never, null)).resolves.toEqual(EMPTY);
    await expect(moderationContext(store.db as never, member)).resolves.toEqual(EMPTY);
    await expect(
      moderationContext(store.db as never, {
        ...member,
        mod: { siteAdmin: false, realmIds: [], categoryIds: [] },
      })
    ).resolves.toEqual(EMPTY);
    expect(store.db.realm.findMany).not.toHaveBeenCalled();
    expect(store.db.forumCategory.findMany).not.toHaveBeenCalled();
  });

  it("lists a realm moderator's realm and its categories with the realm's name", async () => {
    const store = forumStore(seed());
    const context = await moderationContext(store.db as never, eurthMod);
    const eurth = { slug: "eurth", name: "Eurth" };
    expect(context).toEqual({
      isSiteAdmin: false,
      realms: [{ id: "r_eurth", ...eurth }],
      categories: [
        { id: "r_eurth_hub", key: "hub", name: "hub", realm: eurth },
        {
          id: "r_eurth_character-threads",
          key: "character-threads",
          name: "character-threads",
          realm: eurth,
        },
        {
          id: "r_eurth_current-events",
          key: "current-events",
          name: "current-events",
          realm: eurth,
        },
      ],
    });
  });

  it("lists a category moderator's categories, naming the realm of one they do not moderate", async () => {
    const store = forumStore(seed());
    await expect(moderationContext(store.db as never, generalMod)).resolves.toEqual({
      isSiteAdmin: false,
      realms: [],
      categories: [{ id: "cat_general", key: "general", name: "general", realm: null }],
    });
    const auroraHub = moderatorOf("u_ah", [], ["r_aurora_hub"]);
    await expect(moderationContext(store.db as never, auroraHub)).resolves.toEqual({
      isSiteAdmin: false,
      realms: [],
      categories: [
        { id: "r_aurora_hub", key: "hub", name: "hub", realm: { slug: "aurora", name: "Aurora" } },
      ],
    });
  });

  it("gives a site admin every realm by name, IxWorld included without a row, and sitewide categories first", async () => {
    const store = forumStore(seed());
    const context = await moderationContext(store.db as never, admin);
    expect(context.isSiteAdmin).toBe(true);
    expect(context.realms).toEqual([
      { id: "r_aurora", slug: "aurora", name: "Aurora" },
      { id: "r_eurth", slug: "eurth", name: "Eurth" },
      { id: "default", slug: "ixworld", name: "IxWorld" },
      { id: "r_old", slug: "old", name: "Old" },
    ]);
    expect(context.categories.map((c) => c.id)).toEqual([
      "cat_general",
      "cat_find",
      "cat_side",
      "cat_reports",
      "r_aurora_hub",
      "r_eurth_hub",
      "r_eurth_character-threads",
      "r_eurth_current-events",
      "r_old_hub",
    ]);
    expect(store.db.forumCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { style: { not: "board" } }, orderBy: { order: "asc" } })
    );
  });

  it("names IxWorld for a moderator of its categories when it has no realm row", async () => {
    const store = forumStore({
      ...seed(),
      categories: [
        {
          id: "default_hub",
          key: "hub",
          name: "Hub",
          scope: "realm",
          realmId: "default",
          visibility: "public",
        },
      ],
    });
    const ixworldMod = moderatorOf("u_ix", ["default"]);
    await expect(moderationContext(store.db as never, ixworldMod)).resolves.toEqual({
      isSiteAdmin: false,
      realms: [{ id: "default", slug: "ixworld", name: "IxWorld" }],
      categories: [
        { id: "default_hub", key: "hub", name: "Hub", realm: { slug: "ixworld", name: "IxWorld" } },
      ],
    });
  });
});

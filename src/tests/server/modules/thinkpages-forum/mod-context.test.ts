/** @jest-environment node */
import { moderationContext } from "~/server/modules/thinkpages-forum";
import { admin, generalMod, member, moderatorOf, seed } from "~/tests/helpers/forum-mod-fixtures";
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

  it("leaves system realms out of a site admin's realms", async () => {
    const store = forumStore(seed());
    await moderationContext(store.db as never, admin);
    expect(store.db.realm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isSystem: false } })
    );
  });
});

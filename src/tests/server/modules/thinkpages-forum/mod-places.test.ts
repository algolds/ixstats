/** @jest-environment node */
import { listingRealmId, locateBanScope } from "~/server/modules/thinkpages-forum";
import { eurthMod, member, realmCat, seed } from "~/tests/helpers/forum-mod-fixtures";
import { forumStore } from "~/tests/helpers/forum-store-fake";

const withDraft = () => {
  const base = seed();
  return {
    ...base,
    realms: [
      ...base.realms,
      { id: "r_draft", slug: "draft", name: "Draft", status: "draft", ownerId: "someone" },
    ],
  };
};

describe("locateBanScope", () => {
  it("resolves a realm's board category, which no read page reaches, so a board scoped ban still works", async () => {
    const base = seed();
    const store = forumStore({
      ...base,
      categories: [...base.categories, { ...realmCat("r_eurth", "board"), style: "board" }],
    });
    await expect(
      locateBanScope(store.db as never, eurthMod, {
        kind: "category",
        key: "board",
        realm: "eurth",
      })
    ).resolves.toEqual({
      scope: { kind: "category", categoryId: "r_eurth_board" },
      name: "board",
    });
    const hidden = forumStore({
      ...withDraft(),
      categories: [...base.categories, { ...realmCat("r_draft", "board"), style: "board" }],
    });
    await expect(
      locateBanScope(hidden.db as never, member, { kind: "category", key: "board", realm: "draft" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is NOT_FOUND for an unknown place or a realm hidden from the viewer", async () => {
    const store = forumStore(withDraft());
    for (const locator of [
      { kind: "realm", realm: "nowhere" },
      { kind: "realm", realm: "draft" },
      { kind: "category", key: "nope", realm: "eurth" },
    ] as const) {
      await expect(locateBanScope(store.db as never, member, locator)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }
  });
});

describe("listingRealmId", () => {
  it("is NOT_FOUND for an unknown or hidden realm", async () => {
    const store = forumStore(withDraft());
    await expect(listingRealmId(store.db as never, eurthMod, "nowhere")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(listingRealmId(store.db as never, eurthMod, "draft")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

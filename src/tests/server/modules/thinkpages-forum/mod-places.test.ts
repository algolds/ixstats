/** @jest-environment node */
import { banPlaceName, listingRealmId, locateBanScope } from "~/server/modules/thinkpages-forum";
import { admin, eurthMod, member, seed } from "~/tests/helpers/forum-mod-fixtures";
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
  it("needs no lookup for the site", async () => {
    const store = forumStore(seed());
    await expect(locateBanScope(store.db as never, admin, { kind: "site" })).resolves.toEqual({
      scope: { kind: "site" },
      name: null,
    });
    expect(store.db.realm.findUnique).not.toHaveBeenCalled();
  });

  it("resolves a realm by slug to its id and name", async () => {
    const store = forumStore(seed());
    await expect(
      locateBanScope(store.db as never, eurthMod, { kind: "realm", realm: "eurth" })
    ).resolves.toEqual({ scope: { kind: "realm", realmId: "r_eurth" }, name: "Eurth" });
    await expect(
      locateBanScope(store.db as never, admin, { kind: "realm", realm: "ixworld" })
    ).resolves.toEqual({ scope: { kind: "realm", realmId: "default" }, name: "IxWorld" });
  });

  it("resolves a category by key and realm to its id and name", async () => {
    const store = forumStore(seed());
    await expect(
      locateBanScope(store.db as never, eurthMod, { kind: "category", key: "hub", realm: "eurth" })
    ).resolves.toEqual({ scope: { kind: "category", categoryId: "r_eurth_hub" }, name: "hub" });
    await expect(
      locateBanScope(store.db as never, admin, { kind: "category", key: "general" })
    ).resolves.toEqual({ scope: { kind: "category", categoryId: "cat_general" }, name: "general" });
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
  it("is null without a filter, the realm's id with one", async () => {
    const store = forumStore(seed());
    await expect(listingRealmId(store.db as never, eurthMod, undefined)).resolves.toBeNull();
    expect(store.db.realm.findUnique).not.toHaveBeenCalled();
    await expect(listingRealmId(store.db as never, eurthMod, "eurth")).resolves.toBe("r_eurth");
    await expect(listingRealmId(store.db as never, admin, "ixworld")).resolves.toBe("default");
  });

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

describe("banPlaceName", () => {
  it("names a realm or a category, and nothing for the site or a gone place", async () => {
    const store = forumStore(seed());
    await expect(
      banPlaceName(store.db as never, { scope: "realm", scopeId: "r_eurth" })
    ).resolves.toBe("Eurth");
    await expect(
      banPlaceName(store.db as never, { scope: "category", scopeId: "cat_general" })
    ).resolves.toBe("general");
    await expect(
      banPlaceName(store.db as never, { scope: "site", scopeId: null })
    ).resolves.toBeNull();
    await expect(
      banPlaceName(store.db as never, { scope: "category", scopeId: "cat_gone" })
    ).resolves.toBeNull();
  });
});

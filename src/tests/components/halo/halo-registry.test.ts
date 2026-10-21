import { CORE_COMMANDS, CORE_FEATURES } from "~/components/halo/halo-registry";

function command(name: string) {
  return CORE_COMMANDS.find((entry) => entry.name === name);
}

describe("Halo registry: ThinkPages destinations", () => {
  it("sends /thinkpages to the forum, not the feed", () => {
    expect(command("ThinkPages")).toMatchObject({
      path: "/thinkpages",
      category: "Community",
      description: "The forum: sitewide boards and a section for every realm",
      keywords: ["forum", "boards", "threads", "discussions", "thinkpages"],
    });
  });

  it("finds the feed on the dashboard under the sidebar's name for it", () => {
    expect(command("Home")).toMatchObject({ path: "/dashboard", category: "Community" });
    expect(command("ThinkPages feed")).toBeUndefined();
  });

  it("lists Accounts and Saved posts at their dashboard homes", () => {
    expect(command("Accounts")).toMatchObject({
      path: "/dashboard/accounts",
      category: "Community",
      keywords: ["personas", "accounts", "post as"],
    });
    expect(command("Saved posts")).toMatchObject({
      path: "/dashboard/saved",
      category: "Community",
      keywords: ["saved", "bookmarks", "posts"],
    });
  });

  it("finds Achievements in the Vault, where they live now", () => {
    expect(command("Achievements and trophies")).toMatchObject({ path: "/vault/achievements" });
  });

  it("points no entry at a moved feed page under /thinkpages", () => {
    const moved = /^\/thinkpages\/(feed|post|profile|saved|thinkshare|forum)(\/|$)/;
    expect(CORE_COMMANDS.filter((entry) => entry.path && moved.test(entry.path))).toEqual([]);
  });

  it("gives every command a unique name (result ids are built from it)", () => {
    const names = CORE_COMMANDS.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("Halo registry: card destinations", () => {
  it("sends every card entry to the cards hub, the Store or the import, never an old card address", () => {
    const old =
      /^\/vault\/(inventory|collections|lore-gallery|ns-library|ns-deck|packs|market\b|marketplace|trading|crafting|lore-generator)|^\/vault\/store\?tab=|^\/vault\/cards$/;
    const all = [...CORE_COMMANDS, ...CORE_FEATURES];
    expect(all.filter((entry) => entry.path && old.test(entry.path))).toEqual([]);
  });

  it("names each card destination for what it is now", () => {
    expect(command("IxVault cards")).toMatchObject({
      path: "/vault/cards/mine",
      description: "Your cards, showcases and the card market",
      keywords: expect.arrayContaining(["mine", "showcase"]),
    });
    expect(command("Card market")).toMatchObject({
      path: "/vault/cards/market",
      description: "Bid on, sell and trade cards",
    });
    expect(command("Explore cards")).toMatchObject({
      path: "/vault/cards/explore",
      description: "Every realm's cards, collected or not",
      keywords: ["explore", "gallery", "lore", "cards", "realms", "catalogue"],
    });
    expect(command("Import NationStates cards")).toMatchObject({ path: "/vault/import" });
    expect(command("Marketplace and auctions")).toBeUndefined();
    expect(command("Lore card gallery")).toBeUndefined();
  });

  it("opens the Store's Packs tab for card packs, once, and never says booster", () => {
    const packs = [...CORE_COMMANDS, ...CORE_FEATURES].filter((e) => e.name === "Open card packs");
    expect(packs).toHaveLength(1);
    expect(packs[0]).toMatchObject({
      path: "/vault/store?view=packs",
      description: "Buy and open card packs in the Store",
    });
  });

  it("lists each entry once, so a search never shows the same result twice", () => {
    const names = [...CORE_COMMANDS, ...CORE_FEATURES].map((e) => e.name);
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });
});

/** @jest-environment node */
/** The cards hub's addresses, and where every old card address goes (spec §2.3 Hub). */
import {
  CARD_HUB_PATHS,
  CARD_HUB_TABS,
  CARD_HUB_TITLES,
  cardHubIndexRedirectFor,
  cardHubTabOf,
  legacyCardRedirect,
  legacyCardRedirectFor,
  marketTabHref,
  marketTabOf,
  storeTabRedirect,
  tradeBuilderHref,
  type LegacyCardRoute,
} from "~/lib/cards/hub-routes";

describe("hub tabs", () => {
  it("names the four tabs, each its own address", () => {
    expect(CARD_HUB_TABS.map((tab) => [CARD_HUB_PATHS[tab], CARD_HUB_TITLES[tab]])).toEqual([
      ["/vault/cards/mine", "Mine"],
      ["/vault/cards/sets", "Sets"],
      ["/vault/cards/market", "Market"],
      ["/vault/cards/explore", "Explore"],
    ]);
  });

  it("reads the tab from its path, with or without a trailing slash", () => {
    expect(cardHubTabOf("/vault/cards/sets")).toBe("sets");
    expect(cardHubTabOf("/vault/cards/explore/")).toBe("explore");
    expect(cardHubTabOf("/vault/cards")).toBeNull();
    expect(cardHubTabOf("/vault/cards/mine/x")).toBeNull();
    expect(cardHubTabOf("/vault")).toBeNull();
  });

  it("opens Browse for a missing or unknown market tab", () => {
    expect(marketTabOf("trades")).toBe("trades");
    expect(marketTabOf("wishlist")).toBe("wishlist");
    expect(marketTabOf("selling")).toBe("selling");
    expect(marketTabOf(null)).toBe("browse");
    expect(marketTabOf(undefined)).toBe("browse");
    expect(marketTabOf("auctions")).toBe("browse");
  });
});

describe("market links", () => {
  it("opens a Market sub-tab", () => {
    expect(marketTabHref("selling")).toBe("/vault/cards/market?tab=selling");
    expect(marketTabHref("browse")).toBe("/vault/cards/market?tab=browse");
  });

  it("opens the trade builder on an open trade, or a new one seeded with a partner and cards", () => {
    expect(tradeBuilderHref({ partner: "bob", get: "o9" })).toBe(
      "/vault/cards/market?tab=trades&trade=new&partner=bob&get=o9"
    );
    expect(tradeBuilderHref({ partner: "@a b", give: "o1", get: "o2" })).toBe(
      "/vault/cards/market?tab=trades&trade=new&partner=%40a+b&give=o1&get=o2"
    );
    expect(tradeBuilderHref({})).toBe("/vault/cards/market?tab=trades&trade=new");
    expect(tradeBuilderHref({ tradeId: "t1" })).toBe("/vault/cards/market?tab=trades&trade=t1");
  });

  it("reads an empty value as absent", () => {
    expect(tradeBuilderHref({ tradeId: "", partner: "" })).toBe(
      "/vault/cards/market?tab=trades&trade=new"
    );
    expect(tradeBuilderHref({ give: "", get: "" })).toBe(
      "/vault/cards/market?tab=trades&trade=new"
    );
  });
});

describe("hub tabs under a base path", () => {
  const previous = process.env.NEXT_PUBLIC_BASE_PATH;

  afterEach(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = previous;
  });

  it("strips the production base path before reading the path", async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    let tabOf: typeof cardHubTabOf = () => null;
    let redirectFor: typeof legacyCardRedirectFor = () => null;
    let indexFor: typeof cardHubIndexRedirectFor = () => null;
    await jest.isolateModulesAsync(async () => {
      ({
        cardHubTabOf: tabOf,
        legacyCardRedirectFor: redirectFor,
        cardHubIndexRedirectFor: indexFor,
      } = await import("~/lib/cards/hub-routes"));
    });
    expect(tabOf("/projects/ixstates/vault/cards/market")).toBe("market");
    expect(redirectFor("/projects/ixstates/vault/inventory", "")).toBe("/vault/cards/mine");
    expect(indexFor("/projects/ixstates/vault/cards", "")).toBe("/vault/cards/mine");
  });
});

describe("legacyCardRedirect", () => {
  it.each<[LegacyCardRoute, string]>([
    ["inventory", CARD_HUB_PATHS.mine],
    ["crafting", CARD_HUB_PATHS.mine],
    ["collections", CARD_HUB_PATHS.sets],
    ["collection", CARD_HUB_PATHS.sets],
    ["explore-collections", CARD_HUB_PATHS.sets],
    ["lore-gallery", CARD_HUB_PATHS.explore],
    ["lore-generator", `${CARD_HUB_PATHS.explore}?suggest=1`],
    ["ns-library", `${CARD_HUB_PATHS.explore}?realm=nationstates`],
    ["ns-deck-nation", `${CARD_HUB_PATHS.explore}?realm=nationstates`],
    ["ns-deck", "/vault/import"],
    ["market", CARD_HUB_PATHS.market],
    ["trading", `${CARD_HUB_PATHS.market}?tab=trades`],
    ["packs", "/vault/store?view=packs"],
    ["marketplace", CARD_HUB_PATHS.market],
  ])("sends %s to %s", (route, target) => {
    expect(legacyCardRedirect(route, {})).toBe(target);
  });

  it("keeps the card a link opened, and drops the old screen's tab and view", () => {
    expect(legacyCardRedirect("inventory", { card: "c1", tab: "gallery", view: "grid" })).toBe(
      `${CARD_HUB_PATHS.mine}?card=c1`
    );
  });

  it("sends an old collection to the showcase it became", () => {
    expect(legacyCardRedirect("collection", {}, "cl_9")).toBe(
      `${CARD_HUB_PATHS.sets}?showcase=cl_9`
    );
  });

  it("reads the old marketplace's tab", () => {
    expect(legacyCardRedirect("marketplace", { tab: "auctions" })).toBe(CARD_HUB_PATHS.market);
    expect(legacyCardRedirect("marketplace", { tab: "trading", id: ["a", "b c"] })).toBe(
      `${CARD_HUB_PATHS.market}?id=a&id=b+c&tab=trades`
    );
    expect(legacyCardRedirect("marketplace", { tab: "store" })).toBe("/vault/store");
    expect(legacyCardRedirect("marketplace", { tab: ["store", "auctions"] })).toBe("/vault/store");
  });

  it("keeps the Store view the old marketplace showed, and drops the view for a hub tab", () => {
    expect(legacyCardRedirect("marketplace", { tab: "store", view: "cosmetics", card: "c1" })).toBe(
      "/vault/store?card=c1&view=cosmetics"
    );
    expect(legacyCardRedirect("marketplace", { tab: "store", view: ["upgrades", "x"] })).toBe(
      "/vault/store?view=upgrades"
    );
    expect(legacyCardRedirect("marketplace", { tab: "trading", view: "my-packs" })).toBe(
      `${CARD_HUB_PATHS.market}?tab=trades`
    );
    expect(legacyCardRedirect("marketplace", { view: "my-packs" })).toBe(CARD_HUB_PATHS.market);
  });
});

describe("storeTabRedirect", () => {
  it("moves the Store's old auctions and trading tabs into the hub, and leaves the rest", () => {
    expect(storeTabRedirect({ tab: "auctions", card: "c1" })).toBe(
      `${CARD_HUB_PATHS.market}?card=c1`
    );
    expect(storeTabRedirect({ tab: "trading" })).toBe(`${CARD_HUB_PATHS.market}?tab=trades`);
    expect(storeTabRedirect({ tab: "store", view: "my-packs" })).toBeNull();
    expect(storeTabRedirect({})).toBeNull();
  });
});

describe("legacyCardRedirectFor", () => {
  const { mine, sets, market, explore } = CARD_HUB_PATHS;

  it.each([
    ["/vault/inventory", "", mine],
    ["/vault/inventory/", "?card=c1&tab=gallery", `${mine}?card=c1`],
    ["/vault/crafting", "", mine],
    ["/vault/collections", "?card=c1", `${sets}?card=c1`],
    ["/vault/collections/cl_9", "?card=c1", `${sets}?card=c1&showcase=cl_9`],
    ["/explore/collections", "", sets],
    ["/vault/lore-gallery", "card=c1", `${explore}?card=c1`],
    ["/vault/lore-generator", "", `${explore}?suggest=1`],
    ["/vault/ns-library", "?card=c1", `${explore}?card=c1&realm=nationstates`],
    ["/vault/ns-deck", "?nation=x", "/vault/import?nation=x"],
    ["/vault/ns-deck/testlandia", "", `${explore}?realm=nationstates`],
    ["/vault/market", "?card=c1", `${market}?card=c1`],
    ["/vault/marketplace", "?tab=trading", `${market}?tab=trades`],
    ["/vault/marketplace", "?tab=store&view=my-packs", "/vault/store?view=my-packs"],
    ["/vault/marketplace", "?tab=store", "/vault/store"],
    ["/vault/marketplace", "?tab=auctions&view=my-packs", market],
    ["/vault/trading", "?card=c1&card=c2", `${market}?card=c1&card=c2&tab=trades`],
    ["/vault/packs", "?view=my-packs", "/vault/store?view=packs"],
    ["/vault/store", "?tab=auctions&card=c1", `${market}?card=c1`],
    ["/vault/store/", "?tab=trading", `${market}?tab=trades`],
  ])("sends %s%s to %s", (pathname, search, target) => {
    expect(legacyCardRedirectFor(pathname, search)).toBe(target);
  });

  it.each([
    ["/vault/store", ""],
    ["/vault/store", "?tab=store&view=my-packs"],
    ["/vault/cards", ""],
    ["/vault/cards/mine", "?card=c1"],
    ["/vault/import", ""],
    ["/vault", ""],
    ["/", ""],
    ["/explore", ""],
    ["/vault/inventory-old", ""],
    ["/vault/collections/cl_9/edit", ""],
    ["/vault/ns-deck/a/b", ""],
    ["/thinkpages/vault/inventory", ""],
  ])("leaves %s%s alone", (pathname, search) => {
    expect(legacyCardRedirectFor(pathname, search)).toBeNull();
  });

  it("never sends a link to an address that moves again", () => {
    const old = [
      "/vault/inventory",
      "/vault/crafting",
      "/vault/collections",
      "/vault/collections/cl_9",
      "/explore/collections",
      "/vault/lore-gallery",
      "/vault/lore-generator",
      "/vault/ns-library",
      "/vault/ns-deck",
      "/vault/ns-deck/testlandia",
      "/vault/market",
      "/vault/marketplace",
      "/vault/trading",
      "/vault/packs",
    ];
    for (const pathname of old) {
      for (const search of [
        "",
        "?tab=auctions",
        "?tab=trading",
        "?tab=store",
        "?tab=store&view=my-packs",
        "?view=packs",
      ]) {
        const target = legacyCardRedirectFor(pathname, search);
        expect(target).not.toBeNull();
        const [path = "", query = ""] = target!.split("?");
        expect(legacyCardRedirectFor(path, query)).toBeNull();
      }
    }
  });
});

describe("cardHubIndexRedirectFor", () => {
  it.each([
    ["/vault/cards", "", "/vault/cards/mine"],
    ["/vault/cards/", "?card=c1", "/vault/cards/mine?card=c1"],
    ["/vault/cards", "card=c1&from=offer.o1", "/vault/cards/mine?card=c1&from=offer.o1"],
  ])("opens Mine from %s%s", (pathname, search, target) => {
    expect(cardHubIndexRedirectFor(pathname, search)).toBe(target);
  });

  it.each(["/vault/cards/mine", "/vault/cards/x", "/vault", "/vault/inventory"])(
    "leaves %s alone",
    (pathname) => {
      expect(cardHubIndexRedirectFor(pathname, "?card=c1")).toBeNull();
    }
  );
});

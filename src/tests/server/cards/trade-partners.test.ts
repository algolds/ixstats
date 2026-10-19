/** @jest-environment node */
/**
 * The trade builder's reads (spec §2.3 Trade builder): a partner found by passport handle with their trade privacy
 * shown before building, each side's tradeable copies with wishlist highlights, and the partner's wishlist.
 */
jest.mock("~/server/shared/privacy-permissions", () => ({
  permissionAudiences: jest.fn(),
  tradeOfferRefusers: jest.fn(),
  hiddenLinkedNames: jest.fn(),
}));
jest.mock("~/server/modules/cards/market/wishlist", () => ({
  WISHLIST_MAX: 200,
  wishlistCardIds: jest.fn(),
}));
jest.mock("~/lib/cards/copy-value", () => ({ loadCopyValues: jest.fn() }));
jest.mock("~/lib/cards/hub/market-faces", () => ({ copyFaces: jest.fn() }));

import type { CardFaceData } from "~/lib/cards/face/types";
import { loadCopyValues } from "~/lib/cards/copy-value";
import { CATALOGUE_WHERE } from "~/lib/cards/hub/catalogue";
import { copyFaces } from "~/lib/cards/hub/market-faces";
import { wishlistCardIds } from "~/server/modules/cards/market/wishlist";
import {
  findTradePartner,
  getPartnerWishlist,
  getTradeables,
  searchTradePartners,
  type PartnerRules,
} from "~/server/modules/cards/trading/partners";
import {
  hiddenLinkedNames,
  permissionAudiences,
  tradeOfferRefusers,
} from "~/server/shared/privacy-permissions";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const VIEWER = { id: "alice", clerkUserId: "user_alice" };
const BOB = { id: "bob", clerkUserId: "user_bob", isActive: true, country: { name: "Aurelia" } };
const FORBIDDEN = { code: "FORBIDDEN", message: "This player isn't taking trade offers from you." };
const PRIVATE = { code: "FORBIDDEN", message: "This player keeps their cards private." };

const row = (id: string, cardId: string) => ({
  id,
  cardId,
  inscription: id === "o1" ? "gg" : null,
});
const face = (cardId: string, artwork: string | null) =>
  ({ cardId, title: cardId, artwork, silhouette: artwork === null }) as never as CardFaceData;

function rulesFor(shown: readonly string[] = ["bob"]) {
  return {
    userOfHandle: jest.fn(async (handle: string) =>
      handle.toLowerCase() === "bob" ? "bob" : null
    ),
    namesOf: jest.fn(
      async (ids: readonly string[]) =>
        new Map(ids.map((id) => [id, { handle: id, displayName: `@${id}` }]))
    ),
    cardsShown: jest.fn(
      async (ids: readonly string[]) => new Set(ids.filter((id) => shown.includes(id)))
    ),
  } satisfies PartnerRules;
}

function makeDb(rows = [row("o1", "c1"), row("o2", "c2")]) {
  const db = createMockPrisma();
  db.user.findUnique.mockResolvedValue(BOB);
  db.cardOwnership.findMany.mockResolvedValue(rows);
  return db;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(permissionAudiences).mockResolvedValue(new Map([["user_bob", "followers"]]));
  jest.mocked(tradeOfferRefusers).mockResolvedValue(new Set());
  jest.mocked(hiddenLinkedNames).mockResolvedValue({ discord: new Set(), wiki: new Set() });
  jest.mocked(wishlistCardIds).mockResolvedValue(new Set(["c2"]));
  jest.mocked(loadCopyValues).mockResolvedValue([
    {
      ownershipId: "o1",
      ownerId: "bob",
      cardId: "c1",
      cardType: "LORE",
      finish: "STANDARD",
      value: 120,
    },
  ]);
  jest.mocked(copyFaces).mockResolvedValue(
    new Map([
      ["o1", face("c1", null)],
      ["o2", face("c2", "c2.png")],
    ])
  );
});

describe("findTradePartner", () => {
  it("finds a partner by passport handle (trimmed, with or without @) and shows their trade privacy", async () => {
    const db = makeDb();
    const rules = rulesFor();
    expect(await findTradePartner(db as never, rules, VIEWER, " @Bob ")).toEqual({
      id: "bob",
      handle: "bob",
      displayName: "@bob",
      countryName: "Aurelia",
      privacy: { audience: "followers", allowed: true, cardsShown: true },
    });
    expect(rules.userOfHandle).toHaveBeenCalledWith("Bob");
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: "bob" },
      select: { id: true, clerkUserId: true, isActive: true, country: { select: { name: true } } },
    });
    expect(rules.namesOf).toHaveBeenCalledWith(["bob"]);
    expect(permissionAudiences).toHaveBeenCalledWith(db, ["user_bob"], "tradeOffers");
    expect(tradeOfferRefusers).toHaveBeenCalledWith(db, "user_alice", ["user_bob"]);
    expect(rules.cardsShown).toHaveBeenCalledWith(["bob"]);
    expect(await findTradePartner(db as never, rules, VIEWER, "bob")).toMatchObject({ id: "bob" });
  });

  it("shows a closed door, hidden cards and a missing setting before building", async () => {
    jest.mocked(tradeOfferRefusers).mockResolvedValueOnce(new Set(["user_bob"]));
    jest.mocked(permissionAudiences).mockResolvedValueOnce(new Map());
    const db = makeDb();
    db.user.findUnique.mockResolvedValue({ ...BOB, country: null });
    expect(await findTradePartner(db as never, rulesFor([]), VIEWER, "bob")).toEqual({
      id: "bob",
      handle: "bob",
      displayName: "@bob",
      countryName: null,
      privacy: { audience: "everyone", allowed: false, cardsShown: false },
    });
  });

  it("finds nobody for an empty or unknown handle, yourself, an inactive or an unnamed player", async () => {
    const rules = rulesFor();
    for (const handle of ["", "  ", "@", " @ "]) {
      expect(await findTradePartner(makeDb() as never, rules, VIEWER, handle)).toBeNull();
    }
    expect(rules.userOfHandle).not.toHaveBeenCalled();
    expect(await findTradePartner(makeDb() as never, rules, VIEWER, "carol")).toBeNull();

    const self = makeDb();
    rules.userOfHandle.mockResolvedValueOnce("alice");
    expect(await findTradePartner(self as never, rules, VIEWER, "alice")).toBeNull();
    expect(self.user.findUnique).not.toHaveBeenCalled();

    const gone = makeDb();
    gone.user.findUnique.mockResolvedValue(null);
    expect(await findTradePartner(gone as never, rules, VIEWER, "bob")).toBeNull();

    const inactive = makeDb();
    inactive.user.findUnique.mockResolvedValue({ ...BOB, isActive: false });
    expect(await findTradePartner(inactive as never, rules, VIEWER, "bob")).toBeNull();

    rules.namesOf.mockResolvedValueOnce(new Map());
    expect(await findTradePartner(makeDb() as never, rules, VIEWER, "bob")).toBeNull();
  });
});

describe("searchTradePartners", () => {
  const user = (id: string, fields: Record<string, string | null> = {}) => ({
    id,
    clerkUserId: `clerk_${id}`,
    handle: null,
    forumUsername: null,
    wikiUsername: null,
    discordUsername: null,
    country: { name: "Nowhere", leader: "Someone" },
    ...fields,
  });

  it("needs two characters, and reads nothing before then", async () => {
    const db = makeDb();
    for (const query of ["", "a", " a ", "@a", "@"]) {
      expect(await searchTradePartners(db as never, rulesFor(), VIEWER, query)).toEqual([]);
    }
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it("matches the typed text literally: a % or _ is a character, not a wildcard", async () => {
    const db = makeDb();
    await searchTradePartners(db as never, rulesFor(), VIEWER, " @a_b%\\ ");
    const term = { contains: "a\\_b\\%\\\\", mode: "insensitive" };
    expect(db.user.findMany).toHaveBeenCalledWith({
      where: {
        id: { not: "alice" },
        isActive: true,
        OR: [
          { handle: { startsWith: "a\\_b\\%\\\\", mode: "insensitive" } },
          { country: { OR: [{ name: term }, { leader: term }] } },
          { forumUsername: term },
          { wikiUsername: term },
          { discordUsername: term },
        ],
      },
      select: {
        id: true,
        clerkUserId: true,
        handle: true,
        forumUsername: true,
        wikiUsername: true,
        discordUsername: true,
        country: { select: { name: true, leader: true } },
      },
      take: 15,
    });
  });

  it("neither shows nor matches a hidden Discord tag or wiki name, and names players by the identity rule", async () => {
    jest.mocked(hiddenLinkedNames).mockResolvedValue({
      discord: new Set(["clerk_hidden", "clerk_nation"]),
      wiki: new Set(["clerk_wiki"]),
    });
    jest.mocked(tradeOfferRefusers).mockResolvedValue(new Set(["clerk_forum"]));
    jest.mocked(permissionAudiences).mockResolvedValue(new Map([["clerk_forum", "nobody"]]));
    const db = makeDb();
    db.user.findMany.mockResolvedValue([
      user("hidden", { discordUsername: "rosegarden" }),
      user("wiki", { wikiUsername: "Rosegarden" }),
      user("tag", { discordUsername: "Rosegarden2" }),
      user("nation", {
        discordUsername: "rosegarden",
        country: { name: "Rosegarden Isles", leader: "X" },
      }),
      user("leader", { country: { name: "Elsewhere", leader: "Lord Rosegarden" } }),
      user("forum", { forumUsername: "RoseGardenFan" }),
      user("handle", { handle: "rosegardener" }),
      user("inside", { handle: "my_rosegarden" }),
      { ...user("stateless", { wikiUsername: "rosegarden" }), country: null },
    ]);
    const rules = rulesFor(["tag"]);
    const found = await searchTradePartners(db as never, rules, VIEWER, "RoseGarden");
    expect(found.map((p) => p.id)).toEqual([
      "tag",
      "nation",
      "leader",
      "forum",
      "handle",
      "stateless",
    ]);
    expect(hiddenLinkedNames).toHaveBeenCalledWith(db, [
      "clerk_hidden",
      "clerk_wiki",
      "clerk_tag",
      "clerk_nation",
      "clerk_leader",
      "clerk_forum",
      "clerk_handle",
      "clerk_inside",
      "clerk_stateless",
    ]);
    expect(rules.namesOf).toHaveBeenCalledWith([
      "tag",
      "nation",
      "leader",
      "forum",
      "handle",
      "stateless",
    ]);
    expect(found[0]).toEqual({
      id: "tag",
      handle: "tag",
      displayName: "@tag",
      countryName: "Nowhere",
      privacy: { audience: "everyone", allowed: true, cardsShown: true },
    });
    expect(found[3]!.privacy).toEqual({ audience: "nobody", allowed: false, cardsShown: false });
    expect(found[5]!.countryName).toBeNull();
  });

  it("returns at most eight, leaving out a player with no name", async () => {
    const db = makeDb();
    db.user.findMany.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => user(`p${i}`, { forumUsername: "rosegarden" }))
    );
    const rules = rulesFor();
    rules.namesOf.mockImplementationOnce(
      async (ids: readonly string[]) =>
        new Map(
          ids.filter((id) => id !== "p1").map((id) => [id, { handle: id, displayName: null }])
        )
    );
    const found = await searchTradePartners(db as never, rules, VIEWER, "rose");
    expect(found.map((p) => p.id)).toEqual(["p0", "p2", "p3", "p4", "p5", "p6", "p7"]);
    expect(found[0]!.displayName).toBeNull();
    expect(tradeOfferRefusers).toHaveBeenCalledWith(db, "user_alice", [
      "clerk_p0",
      "clerk_p2",
      "clerk_p3",
      "clerk_p4",
      "clerk_p5",
      "clerk_p6",
      "clerk_p7",
    ]);
  });
});

describe("getTradeables", () => {
  const input = { partnerId: "bob", side: "theirs" as const, filters: {}, limit: 10 };

  it("lists the partner's free copies, hides unowned art, values them and highlights my wishlist", async () => {
    const db = makeDb();
    const rules = rulesFor();
    const page = await getTradeables(db as never, rules, VIEWER, {
      ...input,
      filters: { rarity: "RARE" },
      limit: 1,
    });
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: "bob" },
      select: { id: true, clerkUserId: true, isActive: true, country: { select: { name: true } } },
    });
    expect(db.cardOwnership.findMany).toHaveBeenCalledWith({
      where: {
        ownerId: "bob",
        isLocked: false,
        cards: { isBound: false, isRetired: false, rarity: "RARE" },
      },
      // The text travels with the copy; who signed it never leaves the server
      select: { id: true, cardId: true, inscription: true },
      orderBy: [{ cards: { title: "asc" } }, { id: "asc" }],
      take: 2,
    });
    expect(wishlistCardIds).toHaveBeenCalledWith(db, "alice");
    // Faces follow the silhouette rule (owned or live-listed art only): never the "offer made to you" exemption.
    expect(copyFaces).toHaveBeenCalledWith(db, "alice", ["o1"], false);
    // The shared copy value, where a retired card's copy is 0
    expect(loadCopyValues).toHaveBeenCalledWith(db, { ownershipIds: ["o1"] });
    expect(page).toEqual({
      items: [
        {
          ownershipId: "o1",
          face: face("c1", null),
          inscription: "gg",
          value: 120,
          highlighted: false,
        },
      ],
      nextCursor: "o1",
    });
  });

  it("filters by realm, finish, type and a literal title search, and pages from a cursor", async () => {
    const db = makeDb();
    const page = await getTradeables(db as never, rulesFor(), VIEWER, {
      ...input,
      filters: {
        realmId: "default",
        finish: "FOIL",
        cardType: "NS",
        rarity: "EPIC",
        search: "50%_off",
      },
      cursor: "o0",
      limit: 2,
    });
    expect(db.cardOwnership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerId: "bob",
          isLocked: false,
          finish: "FOIL",
          cards: {
            isBound: false,
            isRetired: false,
            realmId: "default",
            rarity: "EPIC",
            cardType: "NS",
            title: { contains: "50\\%\\_off", mode: "insensitive" },
          },
        },
        take: 3,
        cursor: { id: "o0" },
        skip: 1,
      })
    );
    expect(page.nextCursor).toBeNull();
    expect(page.items.map((i) => [i.ownershipId, i.value, i.highlighted])).toEqual([
      ["o1", 120, false],
      ["o2", 0, true],
    ]);
  });

  it("highlights the partner's wishlist among my copies, and leaves out a copy that is gone", async () => {
    const db = makeDb([row("o2", "c2"), row("o3", "c3")]);
    const page = await getTradeables(db as never, rulesFor(), VIEWER, { ...input, side: "mine" });
    expect(db.cardOwnership.findMany.mock.calls[0]![0].where.ownerId).toBe("alice");
    expect(wishlistCardIds).toHaveBeenCalledWith(db, "bob");
    expect(page.items).toEqual([
      {
        ownershipId: "o2",
        face: face("c2", "c2.png"),
        inscription: null,
        value: 0,
        highlighted: true,
      },
    ]);
    expect(page.nextCursor).toBeNull();
  });

  it("refuses up front when the partner does not take offers from you, reading no copies", async () => {
    jest.mocked(tradeOfferRefusers).mockResolvedValue(new Set(["user_bob"]));
    for (const side of ["theirs", "mine"] as const) {
      const db = makeDb();
      await expect(
        getTradeables(db as never, rulesFor(), VIEWER, { ...input, side })
      ).rejects.toMatchObject(FORBIDDEN);
      expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
    }
    expect(tradeOfferRefusers).toHaveBeenCalledWith(expect.anything(), "user_alice", ["user_bob"]);
    expect(wishlistCardIds).not.toHaveBeenCalled();
  });

  it("refuses the copies of a player who hides their cards, and shows no highlight from their wishlist", async () => {
    const db = makeDb();
    const rules = rulesFor([]);
    await expect(getTradeables(db as never, rules, VIEWER, input)).rejects.toMatchObject(PRIVATE);
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
    expect(copyFaces).not.toHaveBeenCalled();
    expect(rules.cardsShown).toHaveBeenCalledWith(["bob"]);

    const mine = await getTradeables(db as never, rules, VIEWER, { ...input, side: "mine" });
    expect(mine.items.map((i) => i.highlighted)).toEqual([false, false]);
    expect(wishlistCardIds).not.toHaveBeenCalled();
  });

  it("finds no partner who is missing, inactive or yourself", async () => {
    const gone = makeDb();
    gone.user.findUnique.mockResolvedValue(null);
    const inactive = makeDb();
    inactive.user.findUnique.mockResolvedValue({ ...BOB, isActive: false });
    const self = makeDb();
    const cases = [
      [gone, "bob"],
      [inactive, "bob"],
      [self, "alice"],
    ] as const;
    for (const [db, partnerId] of cases) {
      await expect(
        getTradeables(db as never, rulesFor(), VIEWER, { ...input, partnerId })
      ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Player not found." });
      expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
    }
    expect(self.user.findUnique).not.toHaveBeenCalled();
    expect(tradeOfferRefusers).not.toHaveBeenCalled();
  });
});

describe("getPartnerWishlist", () => {
  const WISHED = [
    { cardId: "c1", card: { title: "Elm", rarity: "RARE", realmId: "default" } },
    { cardId: "c2", card: { title: "Oak", rarity: "COMMON", realmId: "eurth" } },
  ];

  it("lists the partner's wished catalogue cards with how many tradeable copies I hold", async () => {
    const db = makeDb();
    db.cardWatchlist.findMany.mockResolvedValue(WISHED);
    db.cardOwnership.groupBy.mockResolvedValue([{ cardId: "c1", _count: { _all: 2 } }]);
    expect(await getPartnerWishlist(db as never, rulesFor(), VIEWER, "bob")).toEqual([
      { cardId: "c1", title: "Elm", rarity: "RARE", realmId: "default", youOwn: 2 },
      { cardId: "c2", title: "Oak", rarity: "COMMON", realmId: "eurth", youOwn: 0 },
    ]);
    expect(db.cardWatchlist.findMany).toHaveBeenCalledWith({
      where: { userId: "bob", card: CATALOGUE_WHERE },
      select: { cardId: true, card: { select: { title: true, rarity: true, realmId: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 200,
    });
    expect(db.cardOwnership.groupBy).toHaveBeenCalledWith({
      by: ["cardId"],
      where: {
        ownerId: "alice",
        isLocked: false,
        cards: { isBound: false, isRetired: false },
        cardId: { in: ["c1", "c2"] },
      },
      _count: { _all: true },
    });
  });

  it("reads no copies for an empty wishlist", async () => {
    const db = makeDb();
    expect(await getPartnerWishlist(db as never, rulesFor(), VIEWER, "bob")).toEqual([]);
    expect(db.cardOwnership.groupBy).not.toHaveBeenCalled();
  });

  it("is refused when the partner does not take offers from you or hides their cards", async () => {
    const closed = makeDb();
    jest.mocked(tradeOfferRefusers).mockResolvedValueOnce(new Set(["user_bob"]));
    await expect(
      getPartnerWishlist(closed as never, rulesFor(), VIEWER, "bob")
    ).rejects.toMatchObject(FORBIDDEN);
    const hidden = makeDb();
    await expect(
      getPartnerWishlist(hidden as never, rulesFor([]), VIEWER, "bob")
    ).rejects.toMatchObject(PRIVATE);
    expect(closed.cardWatchlist.findMany).not.toHaveBeenCalled();
    expect(hidden.cardWatchlist.findMany).not.toHaveBeenCalled();
  });
});

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
import { copyFaces } from "~/lib/cards/hub/market-faces";
import { wishlistCardIds } from "~/server/modules/cards/market/wishlist";
import {
  findTradePartner,
  getPartnerWishlist,
  getTradeables,
  searchTradePartners,
  type PartnerName,
  type PartnerRules,
} from "~/server/modules/cards/trading/partners";
import {
  hiddenLinkedNames,
  permissionAudiences,
  tradeOfferRefusers,
  type PermissionAudience,
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
  ({ cardId, title: cardId, artwork, uncollected: true }) as never as CardFaceData;

type UserOfHandle = PartnerRules["userOfHandle"];
type NamesOf = PartnerRules["namesOf"];
type CardsShown = PartnerRules["cardsShown"];

/** Doubles of the injected rules, each typed by the rule it stands in for. */
function rulesFor(shown: readonly string[] = ["bob"]) {
  return {
    userOfHandle: jest.fn<ReturnType<UserOfHandle>, Parameters<UserOfHandle>>(async (handle) =>
      handle.toLowerCase() === "bob" ? "bob" : null
    ),
    namesOf: jest.fn<ReturnType<NamesOf>, Parameters<NamesOf>>(
      async (ids) =>
        new Map<string, PartnerName>(ids.map((id) => [id, { handle: id, displayName: `@${id}` }]))
    ),
    cardsShown: jest.fn<ReturnType<CardsShown>, Parameters<CardsShown>>(
      async (ids) => new Set(ids.filter((id) => shown.includes(id)))
    ),
  } satisfies PartnerRules;
}

/** What `tradeOfferRefusers` answers: everyone who refuses the viewer, and those of them who block the viewer. */
const refusals = (refusing: string[] = [], blocking: string[] = []) => ({
  refused: new Set([...refusing, ...blocking]),
  blocking: new Set(blocking),
});

function makeDb(rows = [row("o1", "c1"), row("o2", "c2")]) {
  const db = createMockPrisma();
  db.user.findUnique.mockResolvedValue(BOB);
  db.cardOwnership.findMany.mockResolvedValue(rows);
  return db;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(permissionAudiences).mockResolvedValue(new Map([["user_bob", "followers"]]));
  jest.mocked(tradeOfferRefusers).mockResolvedValue(refusals());
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
  it("hides a block: a blocked viewer reads nobody, whatever the partner's setting", async () => {
    jest
      .mocked(permissionAudiences)
      .mockResolvedValue(new Map<string, PermissionAudience>([["user_bob", "everyone"]]));
    jest.mocked(tradeOfferRefusers).mockResolvedValueOnce(refusals([], ["user_bob"]));
    const blocked = await findTradePartner(makeDb() as never, rulesFor(), VIEWER, "bob");
    expect(blocked?.privacy).toEqual({ audience: "nobody", allowed: false, cardsShown: true });
    // The same partner, not blocking: the real setting shows
    const open = await findTradePartner(makeDb() as never, rulesFor(), VIEWER, "bob");
    expect(open?.privacy).toEqual({ audience: "everyone", allowed: true, cardsShown: true });
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

    rules.namesOf.mockResolvedValueOnce(new Map<string, PartnerName>());
    expect(await findTradePartner(makeDb() as never, rules, VIEWER, "bob")).toBeNull();
  });
});

describe("searchTradePartners", () => {
  interface SearchUser {
    id: string;
    clerkUserId: string;
    handle: string | null;
    forumUsername: string | null;
    wikiUsername: string | null;
    discordUsername: string | null;
    country: { name: string; leader: string } | null;
  }
  const user = (id: string, fields: Partial<SearchUser> = {}): SearchUser => ({
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
      // A stable order, so the scan and the results are the same from call to call
      orderBy: [{ handle: "asc" }, { id: "asc" }],
      take: 15,
    });
  });
  it("neither shows nor matches a hidden Discord tag or wiki name, and names players by the identity rule", async () => {
    jest.mocked(hiddenLinkedNames).mockResolvedValue({
      discord: new Set(["clerk_hidden", "clerk_nation"]),
      wiki: new Set(["clerk_wiki"]),
    });
    jest.mocked(tradeOfferRefusers).mockResolvedValue(refusals(["clerk_forum"], ["clerk_leader"]));
    jest.mocked(permissionAudiences).mockResolvedValue(
      new Map<string, PermissionAudience>([
        ["clerk_forum", "nobody"],
        ["clerk_leader", "everyone"],
        ["clerk_handle", "followers"],
      ])
    );
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
    // A player who blocks the viewer reads as "nobody", not their real "everyone"; an unblocked one shows theirs
    expect(found[2]!.privacy).toEqual({ audience: "nobody", allowed: false, cardsShown: false });
    expect(found[4]!.privacy).toEqual({ audience: "followers", allowed: true, cardsShown: false });
    expect(found[5]!.countryName).toBeNull();
  });

  it("returns at most eight, leaving out a player with no name", async () => {
    const db = makeDb();
    db.user.findMany.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => user(`p${i}`, { forumUsername: "rosegarden" }))
    );
    const rules = rulesFor();
    rules.namesOf.mockImplementationOnce(
      async (ids) =>
        new Map<string, PartnerName>(
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
  it("refuses up front when the partner does not take offers from you, reading no copies", async () => {
    jest.mocked(tradeOfferRefusers).mockResolvedValue(refusals(["user_bob"]));
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
    expect(db.cardWatchlist.findMany).not.toHaveBeenCalled();
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
  it("is refused when the partner does not take offers from you or hides their cards", async () => {
    const closed = makeDb();
    jest.mocked(tradeOfferRefusers).mockResolvedValueOnce(refusals(["user_bob"]));
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

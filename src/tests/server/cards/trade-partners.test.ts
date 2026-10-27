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
  jest.mocked(hiddenLinkedNames).mockResolvedValue({ discord: new Set() });
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
    discordUsername: string | null;
    country: { name: string; leader: string } | null;
  }
  const user = (id: string, fields: Partial<SearchUser> = {}): SearchUser => ({
    id,
    clerkUserId: `clerk_${id}`,
    handle: null,
    forumUsername: null,
    discordUsername: null,
    country: { name: "Nowhere", leader: "Someone" },
    ...fields,
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
          { discordUsername: term },
        ],
      },
      select: {
        id: true,
        clerkUserId: true,
        handle: true,
        forumUsername: true,
        discordUsername: true,
        country: { select: { name: true, leader: true } },
      },
      // A stable order, so the scan and the results are the same from call to call
      orderBy: [{ handle: "asc" }, { id: "asc" }],
      take: 15,
    });
  });
  it("neither shows nor matches a hidden Discord tag or an old wiki name, and names players by the identity rule", async () => {
    jest.mocked(hiddenLinkedNames).mockResolvedValue({
      discord: new Set(["clerk_hidden", "clerk_nation"]),
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
      // An old wiki name is not a search term: it is neither asked for nor read
      user("wiki"),
      user("tag", { discordUsername: "Rosegarden2" }),
      user("nation", {
        discordUsername: "rosegarden",
        country: { name: "Rosegarden Isles", leader: "X" },
      }),
      user("leader", { country: { name: "Elsewhere", leader: "Lord Rosegarden" } }),
      user("forum", { forumUsername: "RoseGardenFan" }),
      user("handle", { handle: "rosegardener" }),
      user("inside", { handle: "my_rosegarden" }),
      { ...user("stateless", { handle: "rosegarden" }), country: null },
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
});

describe("getTradeables", () => {
  const input = { partnerId: "bob", side: "theirs" as const, filters: {}, limit: 10 };
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
});

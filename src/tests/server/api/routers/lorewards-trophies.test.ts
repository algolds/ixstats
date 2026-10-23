/** @jest-environment node */
/**
 * The Lorewards trophies procedures: the viewer's own (the places their approved name claims hold, hidden ones too,
 * else only the places whose winning edits are all theirs) and any wiki user's public ones, whose holder is the
 * owner of the name's approved claim only while they show it, plus the standings. Trophy cards come from the trophy
 * cards the user's account owns.
 */
import { beforeEach, describe, expect, it } from "@jest/globals";

jest.mock("~/lib/lorewards", () => ({ syncCurrentWinners: jest.fn() }));
jest.mock("~/lib/lorewards/today-race", () => ({ getTodayRace: jest.fn() }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/identity/identity.privacy", () => ({
  loadPassportSettings: jest.fn(),
}));
jest.mock("~/server/modules/identity/identity.passport-handle", () => ({
  loadPassportHandleById: jest.fn(),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { lorewardsTrophiesRouter } from "~/server/api/routers/lorewards/trophies";
import { getTodayRace } from "~/lib/lorewards/today-race";
import { loadPassportSettings } from "~/server/modules/identity/identity.privacy";
import { loadPassportHandleById } from "~/server/modules/identity/identity.passport-handle";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const trophiesCaller = createCallerFactory(lorewardsTrophiesRouter);
const STATS = {
  username: "Ada",
  dailyWins: 6,
  dailyRunnerUps: 2,
  weeklyWins: 1,
  monthlyWins: 0,
  currentStreak: 3,
  longestStreak: 5,
  totalScore: 900,
  totalBytes: 12000,
  lastWinDate: "2026-10-19",
};

const RACE = {
  date: "2026-10-20",
  editCount: 10,
  entries: [
    { rank: 1, user: "Bo", page: "P1", score: 400, bytesAdded: 1, editCount: 1 },
    { rank: 2, user: "Ada", page: "P2", score: 300, bytesAdded: 1, editCount: 1 },
  ],
};

/** A recorded place: a daily on `date` unless `over` says otherwise. */
const entry = (date: string, over: Record<string, unknown> = {}) => ({
  type: "daily",
  date,
  dateStart: null,
  dateEnd: null,
  winnerUser: "Bo",
  winnerPage: null,
  runnerUpUser: null,
  runnerUpPage: null,
  ...over,
});

/** The places recorded under the linked viewer's name "Ada": a weekly win, a daily win, a daily runner-up. */
const ADA_PLACES = [
  entry("2026-10-12", { type: "weekly", winnerUser: "Ada" }),
  entry("2026-10-19", { winnerUser: "Ada", winnerPage: "Tide Charts" }),
  entry("2026-10-18", { runnerUpUser: "Ada" }),
];

const IXNAY = { id: "default", slug: "ixnay", name: "Ixnay", emblemUrl: null, isSystem: false };

/** A trophy copy the account holds, with the fields its face reads. */
const trophyRow = (
  id: string,
  title: string,
  lorewardEdition: string,
  metadata: Record<string, string> | null
) => ({
  id: `own-${id}`,
  finish: "SERIALISED",
  serialNumber: 1,
  level: 1,
  cards: {
    id,
    title,
    rarity: "LEGENDARY",
    cardType: "TROPHY",
    artwork: `https://art/${id}.png`,
    isRetired: false,
    collectorNumber: 4,
    season: null,
    nsSeason: null,
    realm: IXNAY,
    lorewardEdition,
    metadata,
  },
});

/** The summary of a trophy row, its face showing its art in full colour: the holder's showcase. */
const summary = (id: string, title: string, contest: string, place: string) => ({
  id,
  title,
  contest,
  place,
  face: {
    cardId: id,
    title,
    rarity: "LEGENDARY",
    cardType: "TROPHY",
    realm: { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false },
    artwork: `https://art/${id}.png`,
    uncollected: false,
    number: 4,
    season: null,
    isRetired: false,
    copy: { ownershipId: `own-${id}`, finish: "SERIALISED", serialNumber: 1, level: 1 },
  },
});

const CARD_SUMMARIES = [
  summary("card1", "Seastead Law", "weekly", "winner"),
  summary("card2", "Tide Charts", "daily", "runner-up"),
];

interface Claim {
  userId: string;
  name: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
  visible: boolean;
}
interface ClaimWhere {
  source: string;
  name?: string;
  userId?: { in: string[] };
  status: string;
  visible?: boolean;
}

/** The ixwiki name claims the fake database holds; by default the viewer's approved, shown claim on "Ada". */
let claims: Claim[];
const claimRow = (c: Claim) => ({
  id: `claim-${c.name}`,
  rightsPass: false,
  decidedAt: new Date("2026-10-01T00:00:00.000Z"),
  mwUserId: null,
  ...c,
});
const claimMatches = (c: Claim, where: ClaimWhere) =>
  where.source === "ixwiki" &&
  (where.name === undefined || c.name === where.name) &&
  (where.userId === undefined || where.userId.in.includes(c.userId)) &&
  c.status === where.status &&
  (where.visible === undefined || c.visible === where.visible);

const settings = (vaultCards: boolean) =>
  ({ visibility: { vaultCards }, signature: null, pinnedRibbonKeys: [] }) as never;

let db: ReturnType<typeof createMockPrisma>;

function viewer(over: Record<string, unknown> = {}) {
  return trophiesCaller(
    createMockRouterContext({
      auth: { userId: "clerk_1" },
      user: { id: "u1", clerkUserId: "clerk_1" },
      db,
      ...over,
    }) as never
  );
}

const signedOut = () =>
  trophiesCaller(createMockRouterContext({ auth: null, user: null, db }) as never);

beforeEach(() => {
  db = createMockPrisma();
  jest.useRealTimers();
  jest.mocked(getTodayRace).mockResolvedValue(RACE);
  jest.mocked(loadPassportSettings).mockClear().mockResolvedValue(settings(true));
  claims = [{ userId: "u1", name: "Ada", status: "APPROVED", visible: true }];
  db.wikiNameClaim.findFirst.mockImplementation(async ({ where }: { where: ClaimWhere }) => {
    const claim = claims.find((c) => claimMatches(c, where));
    return claim ? claimRow(claim) : null;
  });
  db.wikiNameClaim.findMany.mockImplementation(async ({ where }: { where: ClaimWhere }) =>
    claims.filter((c) => claimMatches(c, where)).map(claimRow)
  );
  db.lorewardEntry.findMany.mockResolvedValue(ADA_PLACES);
  // No WikiOS edits by the viewer; today's race rows were mirrored from MediaWiki (no authorId).
  db.wikiRevision.groupBy.mockImplementation(async ({ by }: { by: string[] }) =>
    by[0] === "author" ? [] : [{ authorId: null }]
  );
  db.lorewardUserStats.findFirst.mockResolvedValue(STATS);
  db.cardOwnership.findMany.mockResolvedValue([
    trophyRow("card1", "Seastead Law", "winner", { contest: "weekly" }),
    trophyRow("card2", "Tide Charts", "runner-up", { contest: "daily" }),
  ]);
  // The holder's passport handle: here the claimed wiki name, as for a player with no stored handle.
  jest.mocked(loadPassportHandleById).mockClear().mockResolvedValue("Ada");
  db.vaultTransaction.aggregate.mockResolvedValue({ _sum: { credits: 2150 } });
});

describe("lorewards.getMyTrophies", () => {
  it("reads the cards the viewer's account owns, and the payouts of their Loreward bonuses", async () => {
    await viewer().getMyTrophies();

    expect(db.cardOwnership.findMany.mock.calls[0]![0].where).toMatchObject({
      ownerId: "u1",
      cards: { lorewardEntryId: { not: null } },
    });
    expect(db.vaultTransaction.aggregate.mock.calls[0]![0].where).toMatchObject({
      type: "EARN_BONUS",
      source: { startsWith: "bonus:loreward:" },
      vault: { userId: "u1" },
    });
  });

  it("counts the places of the viewer's approved claim, even one they keep hidden", async () => {
    claims = [{ userId: "u1", name: "Ada", status: "APPROVED", visible: false }];
    const mine = await viewer().getMyTrophies();
    expect(mine).toMatchObject({
      wikiUsername: "Ada",
      verified: true,
      unmatched: 0,
      wins: { daily: 1, weekly: 1, monthly: 0 },
      runnerUps: 1,
      todayRank: 2,
    });
  });

  it("counts no place under a name the viewer has only asked for", async () => {
    claims = [{ userId: "u1", name: "Ada", status: "PENDING", visible: true }];
    const mine = await viewer().getMyTrophies();
    expect(mine).toMatchObject({ wikiUsername: null, verified: false, todayRank: null });
  });

  it("counts no place under a label of the viewer's that another account's approved claim holds", async () => {
    // The viewer's WikiOS edits carry the label "Bo", a classic-wiki name u2 holds: Bo's wins and race entry are u2's.
    claims = [
      { userId: "u1", name: "Ada", status: "APPROVED", visible: true },
      { userId: "u2", name: "Bo", status: "APPROVED", visible: true },
    ];
    db.wikiRevision.groupBy.mockImplementation(async ({ by }: { by: string[] }) =>
      by[0] === "author"
        ? [
            {
              author: "Bo",
              _min: { createdAt: new Date("2026-10-01T00:00:00.000Z") },
              _max: { createdAt: new Date("2026-10-19T00:00:00.000Z") },
            },
          ]
        : [{ authorId: null }]
    );
    db.lorewardEntry.findMany.mockResolvedValue([
      ...ADA_PLACES,
      entry("2026-10-17", { winnerUser: "Bo" }),
    ]);
    const mine = await viewer().getMyTrophies();
    expect(mine).toMatchObject({
      wikiUsername: "Ada",
      unmatched: 0,
      wins: { daily: 1, weekly: 1, monthly: 0 },
      todayRank: 2,
    });
  });
});

describe("lorewards.getTrophies", () => {
  it("serves a wiki user's public trophies, owned cards included, without payouts", async () => {
    const theirs = await signedOut().getTrophies({ username: "ada" });

    expect(theirs).toEqual({
      wins: { daily: 6, weekly: 1, monthly: 0 },
      runnerUps: 2,
      streak: 3,
      cards: CARD_SUMMARIES,
      holderHandle: "Ada",
    });
    expect(theirs.cards[0]!.face.cardId).toBe("card1");
    expect(loadPassportHandleById).toHaveBeenCalledWith("u1");
    expect(db.vaultTransaction.aggregate).not.toHaveBeenCalled();
  });
  it("returns the counts but no cards when the owner hides Vault cards on their passport", async () => {
    jest.mocked(loadPassportSettings).mockResolvedValue(settings(false));

    const theirs = await signedOut().getTrophies({ username: "Ada" });
    expect(loadPassportSettings).toHaveBeenCalledWith("u1");
    expect(theirs).toMatchObject({
      wins: { daily: 6, weekly: 1, monthly: 0 },
      runnerUps: 2,
      streak: 3,
    });
    expect(theirs.cards).toEqual([]);
    expect(theirs.holderHandle).toBeNull();
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
    expect(loadPassportHandleById).not.toHaveBeenCalled();
  });

  it("shows no cards for a wiki name with no approved claim", async () => {
    claims = [{ userId: "u1", name: "Ada", status: "PENDING", visible: true }];
    const theirs = await signedOut().getTrophies({ username: "Ada" });
    expect(theirs.cards).toEqual([]);
    expect(theirs.holderHandle).toBeNull();
    expect(theirs.wins.daily).toBe(6);
  });

  it("never names the owner of a claim they keep hidden", async () => {
    claims = [{ userId: "u1", name: "Ada", status: "APPROVED", visible: false }];
    const theirs = await signedOut().getTrophies({ username: "Ada" });
    expect(theirs.cards).toEqual([]);
    expect(theirs.holderHandle).toBeNull();
    expect(theirs.wins.daily).toBe(6);
    expect(loadPassportSettings).not.toHaveBeenCalled();
    expect(loadPassportHandleById).not.toHaveBeenCalled();
  });

  it("finds the name's shown approved claim by an exact match on the normalized name", async () => {
    await signedOut().getTrophies({ username: "ada_lovelace" });
    expect(db.wikiNameClaim.findFirst).toHaveBeenCalledWith({
      where: { source: "ixwiki", name: "Ada lovelace", status: "APPROVED", visible: true },
      select: { userId: true },
    });
  });
});

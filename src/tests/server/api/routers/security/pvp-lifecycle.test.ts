/** @jest-environment node */
/**
 * P0-07: a free defender answers a PvP challenge (initiating stays premium); the challenge
 * notification links to it; NPC nations are not PvP targets; the challenger can withdraw; an
 * unanswered challenge expires.
 */
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({
  db: {
    systemLog: { create: jest.fn() },
    user: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  },
  isDatabaseReadOnly: false,
}));

import { newsGenerator } from "~/lib/diplomacy/news-generator";
import { notificationAPI } from "~/lib/notifications/api";
import { createCallerFactory } from "~/server/api/trpc";
import { securityConflictsRouter } from "~/server/api/routers/security/conflicts";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";
import { createMockCallerContext } from "~/tests/helpers/router-context";

const mockNews = jest.spyOn(newsGenerator, "generateDiplomaticNews");
const mockNotify = jest.spyOn(notificationAPI, "create");

const DAY = 24 * 60 * 60 * 1000;
const USERS = {
  challenger: { id: "u_1", countryId: "country_1", membershipTier: "mycountry_premium" },
  freeDefender: { id: "u_2", countryId: "country_2", membershipTier: "basic" },
  freeChallenger: { id: "u_3", countryId: "country_3", membershipTier: "basic" },
} as const;
type Who = keyof typeof USERS;

let db: MockPrismaProxy;
let calls = 0;
const conflicts = (who: Who) => {
  const user = { ...USERS[who], clerkUserId: `clerk_${USERS[who].id}`, role: null };
  return createCallerFactory(securityConflictsRouter)(
    createMockCallerContext({
      db,
      user,
      auth: { userId: user.clerkUserId },
      rateLimitIdentifier: `pvp-${who}-${++calls}`,
    })
  );
};

const proposed = (createdDaysAgo = 1) => ({
  id: "conflict_1",
  type: "pvp",
  status: "proposed",
  winner: null,
  initiatorId: "country_1",
  defenderId: "country_2",
  pvpRules: null,
  startDate: null,
  createdAt: new Date(Date.now() - createdDaysAgo * DAY),
});

beforeEach(() => {
  db = createMockPrisma();
  mockNews.mockReset().mockResolvedValue("post_1");
  mockNotify.mockReset().mockResolvedValue("notification_1");
  db.user.findUnique.mockImplementation(async ({ where }: { where: { clerkUserId?: string } }) => {
    const who = Object.values(USERS).find((u) => `clerk_${u.id}` === where.clerkUserId);
    return who ? { id: who.id, countryId: who.countryId, role: { name: "member" } } : null;
  });
  db.militaryConflict.findUnique.mockResolvedValue(proposed());
  db.militaryConflict.updateMany.mockResolvedValue({ count: 1 });
  db.militaryConflict.update.mockImplementation(async ({ data }: { data: object }) => ({
    ...proposed(),
    ...data,
    initiator: { id: "country_1", name: "Challengeland" },
    defender: { id: "country_2", name: "Defenderland" },
  }));
});

describe("security.respondToConflict", () => {
  it("lets a free defender accept", async () => {
    await expect(
      conflicts("freeDefender").respondToConflict({ conflictId: "conflict_1", accept: true })
    ).resolves.toMatchObject({ status: "active" });
  });

  it("still refuses anyone but the defender", async () => {
    await expect(
      conflicts("freeChallenger").respondToConflict({ conflictId: "conflict_1", accept: false })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.militaryConflict.update).not.toHaveBeenCalled();
  });

  it("refuses an expired challenge and marks it expired", async () => {
    db.militaryConflict.findUnique.mockResolvedValue(proposed(30));
    await expect(
      conflicts("freeDefender").respondToConflict({ conflictId: "conflict_1", accept: true })
    ).rejects.toThrow(/expired/);
    expect(db.militaryConflict.updateMany).toHaveBeenCalledWith({
      where: { id: "conflict_1", status: "proposed" },
      data: { status: "resolved", winner: "expired" },
    });
    expect(db.militaryConflict.update).not.toHaveBeenCalled();
  });
});

describe("security.proposePvPConflict", () => {
  beforeEach(() => {
    db.militaryConflict.findFirst.mockResolvedValue(null);
    db.militaryConflict.create.mockResolvedValue({
      id: "conflict_new",
      initiatorId: "country_1",
      initiator: { id: "country_1", name: "Challengeland" },
      defender: { id: "country_2", name: "Defenderland" },
    });
  });

  it("refuses an NPC nation, which cannot answer", async () => {
    db.country.findUnique.mockResolvedValue({ ownerUserId: null, owner: null });
    await expect(
      conflicts("challenger").proposePvPConflict({ defenderId: "country_npc" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.militaryConflict.create).not.toHaveBeenCalled();
  });

  it("expires stale challenges between the pair, then notifies the defender with a link", async () => {
    db.country.findUnique.mockResolvedValue({
      ownerUserId: "u_2",
      owner: { clerkUserId: "clerk_u_2" },
    });
    await conflicts("challenger").proposePvPConflict({ defenderId: "country_2" });
    expect(db.militaryConflict.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { status: "proposed", createdAt: { lt: expect.any(Date) } },
      data: { status: "resolved", winner: "expired" },
    });
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "clerk_u_2", href: "/mycountry/defense?tab=operations" })
    );
  });

  it("stays premium", async () => {
    await expect(
      conflicts("freeChallenger").proposePvPConflict({ defenderId: "country_2" })
    ).rejects.toThrow(/Premium/);
  });
});

describe("security.withdrawPvPConflict", () => {
  it("withdraws a pending challenge once", async () => {
    db.country.findUnique.mockResolvedValue({ id: "country_1", ownerUserId: "u_1" });
    await conflicts("challenger").withdrawPvPConflict({ conflictId: "conflict_1" });
    expect(db.militaryConflict.updateMany).toHaveBeenCalledWith({
      where: { id: "conflict_1", status: "proposed" },
      data: { status: "resolved", winner: "withdrawn" },
    });
    db.militaryConflict.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      conflicts("challenger").withdrawPvPConflict({ conflictId: "conflict_1" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("is the challenger's alone", async () => {
    db.country.findUnique.mockResolvedValue({ id: "country_1", ownerUserId: "u_1" });
    await expect(
      conflicts("freeDefender").withdrawPvPConflict({ conflictId: "conflict_1" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.militaryConflict.updateMany).not.toHaveBeenCalled();
  });
});

it("security.getPvPTargets lists only related player nations", async () => {
  db.diplomaticRelation.findMany.mockResolvedValue([
    { country1: "country_1", country2: "country_2" },
  ]);
  db.country.findMany.mockResolvedValue([{ id: "country_2", name: "Defenderland" }]);
  await conflicts("challenger").getPvPTargets();
  expect(db.country.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: { in: ["country_2"] }, ownerUserId: { not: null } },
    })
  );
});

it("security.getPvPTargets and getPvNPCTargets leave out related nations of another realm", async () => {
  db.user.findUnique.mockResolvedValue({ id: "u_1", countryId: "country_1", country: { realmId: "default" } });
  db.diplomaticRelation.findMany.mockResolvedValue([
    { country1: "country_1", country2: "country_2" },
    { country1: "country_4", country2: "country_1" },
  ]);
  db.country.findMany.mockResolvedValue([
    { id: "country_2", name: "Defenderland", realmId: "default" },
    { id: "country_4", name: "Elsewhere", realmId: "advertland" },
  ]);
  expect(await conflicts("challenger").getPvPTargets()).toEqual([{ id: "country_2", name: "Defenderland" }]);
  expect(await conflicts("challenger").getPvNPCTargets()).toEqual([{ id: "country_2", name: "Defenderland" }]);
});

it("security.getConflicts shows an unanswered challenge past its window as expired", async () => {
  db.militaryConflict.findMany.mockResolvedValue([
    { ...proposed(30), initiator: null, defender: null },
  ]);
  const [c] = await conflicts("challenger").getConflicts({ countryId: "country_1" });
  expect(c).toMatchObject({ status: "resolved", winner: "expired" });
  expect(db.militaryConflict.updateMany).not.toHaveBeenCalled();
});

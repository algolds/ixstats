/** @jest-environment node */
/**
 * The Defense routers' gates. A nation's force structure is authored by its owner or an admin, never by a stranger,
 * and only with MyCountry Premium; every field and total stays within bounds and no strength is typed (realm time
 * D2a: headcounts, capital and readiness are derived); an operation deploys only the nation's own units. A PvP
 * conflict is concluded only by the owner of a party, only once its duration has run on the realm clock, and never
 * twice, on the nations' derived combat power; PvNPC targets are only unowned nations; and the MC-13 reads derive on
 * read.
 *
 * Folds pvp-conclude, pvnpc-targets, security-assessment-read-only and security-border-read-only.
 */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({
  db: {
    systemLog: { create: jest.fn() },
    user: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  },
  isDatabaseReadOnly: false,
}));

// The defense module's model and persistence are tested on their own; here it is a seam.
jest.mock("~/server/modules/defense", () => {
  const { loadThreatPicture } = jest.requireActual("~/lib/military/threat-picture-loader");
  const zero = async (ids: readonly string[]) => Object.fromEntries(ids.map((id) => [id, 0]));
  return {
    createEmptyBranch: jest.fn(async (_db: unknown, input: object) => ({ id: "b_new", ...input })),
    previewStarterForce: jest.fn(async () => ({ branches: [] })),
    seedStarterBranches: jest.fn(async () => ({ created: 3, budgetSource: "estimate" })),
    setBranchAllocation: jest.fn(async () => ({ id: "b1" })),
    scrapAsset: jest.fn(async () => ({ id: "a1", capitalRemoved: 0 })),
    syncDefense: jest.fn(),
    applyOperationReadiness: jest.fn(async () => 0),
    nationalCombatPower: jest.fn(async () => ({ country_1: 100_000, country_2: 10 })),
    threatPictureFor: jest.fn((db: unknown, countryId: string) =>
      loadThreatPicture(db, countryId, { readStrengths: zero, nowClockMs: 0 })
    ),
  };
});
// The combat model (seeded resolution, losses, effects) is tested on its own; here it is a seam.
jest.mock("~/server/modules/combat", () => ({
  CROSS_REALM_MESSAGE: "Both nations must be in the same realm",
  concludePvP: jest.fn(async () => ({ winner: "country_1", result: { band: "success" } })),
  newBattleId: () => "op_new",
  sealIntervention: jest.fn(async () => ({})),
  resolveIntervention: jest.fn(async () => null),
}));
jest.mock("~/server/shared/realm-time", () => ({
  clockForCountry: jest.fn(async () => ({ now: () => 5e12, multiplier: 2, paused: false })),
  // Effect drafts are stamped per realm (storyteller-effects): every realm reads the same fixed clock here.
  clocksForRealms: jest.fn(async () => new Map()),
  realmNowsOnce: jest.fn(() => () => 5e12),
}));

import { newsGenerator } from "~/lib/diplomacy/news-generator";
import {
  createEmptyBranch,
  scrapAsset,
  seedStarterBranches,
  setBranchAllocation,
} from "~/server/modules/defense";
import { concludePvP } from "~/server/modules/combat";
import { FORCE_LIMITS } from "~/lib/military/force-structure";
import { notificationAPI } from "~/lib/notifications/api";
import { createCallerFactory } from "~/server/api/trpc";
import { securityAssessmentRouter } from "~/server/api/routers/security/assessment";
import { securityBordersRouter } from "~/server/api/routers/security/borders";
import { securityConflictsRouter } from "~/server/api/routers/security/conflicts";
import { securityForceStructureRouter } from "~/server/api/routers/security/force-structure";
import { securityMilitaryRouter } from "~/server/api/routers/security/military";
import { securityOperationsRouter } from "~/server/api/routers/security/operations";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";
import { createMockCallerContext } from "~/tests/helpers/router-context";

const mockNews = jest.spyOn(newsGenerator, "generateDiplomaticNews");
const mockNotify = jest.spyOn(notificationAPI, "create");

const OWN = "country_1";
const USERS = {
  owner: { id: "u_owner", countryId: OWN, membershipTier: "mycountry_premium", role: null },
  stranger: {
    id: "u_other",
    countryId: "country_2",
    membershipTier: "mycountry_premium",
    role: null,
  },
  admin: { id: "u_admin", countryId: null, membershipTier: "basic", role: { name: "admin" } },
  free: { id: "u_free", countryId: OWN, membershipTier: "basic", role: null },
} as const;
type Who = keyof typeof USERS;

let db: MockPrismaProxy;
let calls = 0;

/** Each caller gets its own rate-limit bucket so the suite never trips the per-procedure limit. */
function ctxFor(who: Who, countryId?: string) {
  const user = { ...USERS[who], clerkUserId: `clerk_${USERS[who].id}` };
  return createMockCallerContext({
    db,
    user: countryId ? { ...user, countryId } : user,
    auth: { userId: user.clerkUserId },
    rateLimitIdentifier: `test-${who}-${++calls}`,
  });
}
const forces = (who: Who) => createCallerFactory(securityForceStructureRouter)(ctxFor(who));
const military = (who: Who) => createCallerFactory(securityMilitaryRouter)(ctxFor(who));

const branchInput = { domain: "land" as const, name: "Royal Army" };
const storedBranch = {
  id: "b1",
  countryId: OWN,
  activeDuty: 50_000,
  reserves: 10_000,
  isActive: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  db = createMockPrisma();
  mockNews.mockReset().mockResolvedValue("post_1");
  mockNotify.mockReset().mockResolvedValue("notification_1");
  // Fresh lookups for the stranger find a member of another nation.
  db.user.findUnique.mockImplementation(async ({ where }: { where: { clerkUserId?: string } }) =>
    where.clerkUserId === "clerk_u_other"
      ? { id: "u_other", countryId: "country_2", role: { name: "member" } }
      : null
  );
  db.country.findUnique.mockResolvedValue({
    id: OWN,
    ownerUserId: "u_owner",
    name: "Ownland",
    currentPopulation: 10_000_000,
    currentTotalGdp: 500e9,
    currentGdpPerCapita: 50_000,
  });
  db.militaryBranch.count.mockResolvedValue(0);
  db.militaryBranch.aggregate.mockResolvedValue({ _sum: { activeDuty: 0, reserves: 0 } });
  db.militaryBranch.findUnique.mockResolvedValue(storedBranch);
  db.militaryBranch.create.mockImplementation(async ({ data }: { data: object }) => ({
    id: "b_new",
    ...data,
  }));
  db.militaryBranch.update.mockImplementation(async ({ data }: { data: object }) => ({
    ...storedBranch,
    ...data,
  }));
  db.militaryUnit.count.mockResolvedValue(0);
  db.militaryUnit.aggregate.mockResolvedValue({ _sum: { personnel: 0 } });
  db.militaryUnit.create.mockImplementation(async ({ data }: { data: object }) => ({
    id: "u_new",
    ...data,
  }));
  db.militaryUnit.findUnique.mockResolvedValue({
    id: "unit1",
    branchId: "b1",
    personnel: 5_000,
    branch: { countryId: OWN, activeDuty: 50_000, reserves: 10_000 },
  });
  db.militaryUnit.update.mockResolvedValue({ id: "unit1", name: "1st Division" });
  db.militaryAsset.findUnique.mockResolvedValue({
    id: "a1",
    quantity: 10,
    operational: 5,
    branch: { countryId: OWN },
  });
  db.militaryAsset.update.mockResolvedValue({ id: "a1" });
  db.governmentBudget.findUnique.mockResolvedValue({
    spendingCategories: JSON.stringify([{ category: "Defense", amount: 10e9 }]),
  });
  db.systemLog.create.mockResolvedValue({ id: "log" });
});

/** Every force-structure write a refused call must not reach. */
const forceWrites = () => [
  db.militaryBranch.create,
  db.militaryBranch.createMany,
  db.militaryBranch.update,
  db.militaryBranch.delete,
  db.militaryUnit.create,
  db.militaryUnit.update,
  db.militaryUnit.delete,
  db.militaryAsset.update,
  createEmptyBranch as jest.Mock,
  seedStarterBranches as jest.Mock,
  setBranchAllocation as jest.Mock,
  scrapAsset as jest.Mock,
];

describe("who authors a nation's force structure", () => {
  const unit = { name: "Raiders", unitType: "brigade" as const };
  it.each([
    [
      "the owner creates a branch",
      "owner",
      (w: Who) => forces(w).createMilitaryBranch({ countryId: OWN, branch: branchInput }),
      null,
    ],
    [
      "an admin edits any nation's branch",
      "admin",
      (w: Who) => forces(w).updateMilitaryBranch({ id: "b1", branch: { motto: "Onward" } }),
      null,
    ],
    [
      "an admin deletes any nation's unit",
      "admin",
      (w: Who) => forces(w).deleteMilitaryUnit({ id: "unit1" }),
      null,
    ],
    [
      "an admin edits any nation's asset",
      "admin",
      (w: Who) => military(w).updateMilitaryAsset({ id: "a1", asset: { operational: 7 } }),
      null,
    ],
    [
      "a stranger creates a branch",
      "stranger",
      (w: Who) => forces(w).createMilitaryBranch({ countryId: OWN, branch: branchInput }),
      "FORBIDDEN",
    ],
    [
      "a stranger edits a branch",
      "stranger",
      (w: Who) => forces(w).updateMilitaryBranch({ id: "b1", branch: { name: "Mine now" } }),
      "FORBIDDEN",
    ],
    [
      "a stranger deletes a branch",
      "stranger",
      (w: Who) => forces(w).deleteMilitaryBranch({ id: "b1" }),
      "FORBIDDEN",
    ],
    [
      "a stranger creates a unit",
      "stranger",
      (w: Who) => forces(w).createMilitaryUnit({ branchId: "b1", unit }),
      "FORBIDDEN",
    ],
    [
      "a stranger deletes a unit",
      "stranger",
      (w: Who) => forces(w).deleteMilitaryUnit({ id: "unit1" }),
      "FORBIDDEN",
    ],
    [
      "a stranger edits an asset",
      "stranger",
      (w: Who) => military(w).updateMilitaryAsset({ id: "a1", asset: { operational: 7 } }),
      "FORBIDDEN",
    ],
    [
      "a stranger sets a branch's allocation",
      "stranger",
      (w: Who) => forces(w).setBranchAllocation({ id: "b1", effortShare: 0.9 }),
      "FORBIDDEN",
    ],
    [
      "a stranger scraps an asset",
      "stranger",
      (w: Who) => military(w).deleteMilitaryAsset({ id: "a1" }),
      "FORBIDDEN",
    ],
    [
      "a stranger seeds the starter force",
      "stranger",
      (w: Who) => forces(w).seedStarterForceStructure({ countryId: OWN }),
      "FORBIDDEN",
    ],
  ] as const)("%s", async (_case, who, call, refusal) => {
    if (refusal) {
      await expect(call(who)).rejects.toMatchObject({ code: refusal });
      for (const write of forceWrites()) expect(write).not.toHaveBeenCalled();
    } else {
      await expect(call(who)).resolves.toBeDefined();
    }
  });

  it("requires MyCountry Premium like the rest of Defense", async () => {
    await expect(
      forces("free").createMilitaryBranch({ countryId: OWN, branch: branchInput })
    ).rejects.toThrow(/Premium/);
    expect(createEmptyBranch).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a missing branch or unit", async () => {
    db.militaryBranch.findUnique.mockResolvedValueOnce(null);
    await expect(forces("owner").deleteMilitaryBranch({ id: "nope" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    db.militaryUnit.findUnique.mockResolvedValueOnce(null);
    await expect(
      forces("owner").updateMilitaryUnit({ id: "nope", unit: { personnel: 10 } })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("force structure input bounds", () => {
  it.each([
    ["an empty name", { name: "" }],
    ["negative civilian staff", { civilianStaff: -1 }],
    ["a javascript: image URL", { imageUrl: "javascript:alert(1)" }],
    ["an unknown domain", { domain: "navy_seals" as never }],
  ])("refuses a branch with %s", async (_case, field) => {
    await expect(
      forces("owner").createMilitaryBranch({ countryId: OWN, branch: { ...branchInput, ...field } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createEmptyBranch).not.toHaveBeenCalled();
  });

  it("never takes typed strength: headcount, readiness and budget fields do not reach the branch", async () => {
    const typed = { activeDuty: 5_000_000, readinessLevel: 100, annualBudget: 1e12, morale: 100 };
    await forces("owner").createMilitaryBranch({
      countryId: OWN,
      branch: { ...branchInput, ...typed } as typeof branchInput,
    });
    const input = (createEmptyBranch as jest.Mock).mock.calls[0]![1];
    expect(JSON.stringify(input)).not.toMatch(/activeDuty|readinessLevel|annualBudget|morale/);
    await forces("owner").updateMilitaryBranch({
      id: "b1",
      branch: { name: "Army", ...typed } as { name: string },
    });
    expect(db.militaryBranch.update.mock.calls[0]![0].data).toEqual({ name: "Army" });
  });

  it("bounds a branch's allocation", async () => {
    await expect(
      forces("owner").setBranchAllocation({ id: "b1", effortShare: 1.5 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      forces("owner").setBranchAllocation({ id: "b1", targetActive: FORCE_LIMITS.maxActiveDuty + 1 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await forces("owner").setBranchAllocation({ id: "b1", targetActive: null });
    expect(setBranchAllocation).toHaveBeenCalledWith(db, {
      countryId: OWN,
      branchId: "b1",
      effortShare: undefined,
      targetActive: null,
    });
  });

  it("refuses a unit over the personnel cap, and an asset with more operational than it holds", async () => {
    await expect(
      forces("owner").createMilitaryUnit({
        branchId: "b1",
        unit: { name: "X", unitType: "brigade", personnel: FORCE_LIMITS.maxUnitPersonnel + 1 },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      military("owner").updateMilitaryAsset({ id: "a1", asset: { operational: 11 } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("caps branches per nation and units per branch", async () => {
    db.militaryBranch.count.mockResolvedValueOnce(FORCE_LIMITS.maxBranchesPerCountry);
    await expect(
      forces("owner").createMilitaryBranch({ countryId: OWN, branch: branchInput })
    ).rejects.toThrow(/at most/);
    db.militaryUnit.count.mockResolvedValueOnce(FORCE_LIMITS.maxUnitsPerBranch);
    await expect(
      forces("owner").createMilitaryUnit({
        branchId: "b1",
        unit: { name: "X", unitType: "brigade" },
      })
    ).rejects.toThrow(/at most/);
  });

  it("keeps unit personnel within the branch's active duty and reserves", async () => {
    db.militaryUnit.aggregate.mockResolvedValueOnce({ _sum: { personnel: 55_000 } });
    await expect(
      forces("owner").createMilitaryUnit({
        branchId: "b1",
        unit: { name: "2nd Division", unitType: "division", personnel: 10_000 },
      })
    ).rejects.toThrow(/active duty and reserves/);
  });

  it("seeds through the defense module (starter force once; empty branches after deleting them all)", async () => {
    await expect(forces("owner").seedStarterForceStructure({ countryId: OWN })).resolves.toEqual({
      created: 3,
      budgetSource: "estimate",
    });
    expect(seedStarterBranches).toHaveBeenCalledWith(db, OWN);
  });

  it("deploys only units in the nation's own active branches", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u_owner" });
    db.militaryUnit.findMany.mockResolvedValue([{ id: "unit1" }]);
    await expect(
      createCallerFactory(securityOperationsRouter)(ctxFor("owner")).createOperation({
        countryId: OWN,
        operationType: "training",
        name: "Exercise Northwind",
        personnelDeployed: 5_000,
        unitIds: ["unit1", "foreign_unit"],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.militaryUnit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branch: { countryId: OWN, isActive: true } }),
      })
    );
    expect(db.militaryOperation.create).not.toHaveBeenCalled();
    expect(db.militaryUnit.updateMany).not.toHaveBeenCalled();
  });
});

describe("security.concludePvPConflict", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const activeConflict = (startedDaysAgo: number) => ({
    id: "conflict_1",
    type: "pvp",
    status: "active",
    initiatorId: "country_1",
    defenderId: "country_2",
    pvpRules: null,
    startDate: new Date(Date.now() - startedDaysAgo * DAY),
    initiator: { id: "country_1", name: "Aggressorland" },
    defender: { id: "country_2", name: "Defenderland" },
  });
  const conclude = (userId: string, ownCountry: string, countryId: string) =>
    createCallerFactory(securityConflictsRouter)(
      createMockCallerContext({
        db,
        user: { id: userId, clerkUserId: userId, countryId: ownCountry, role: { name: "member" } },
        auth: { userId },
        rateLimitIdentifier: `test-${userId}-${++calls}`,
      })
    ).concludePvPConflict({ conflictId: "conflict_1", countryId });

  beforeEach(() => {
    db.user.findUnique.mockResolvedValue(null);
    db.country.findUnique.mockResolvedValue({ id: "country_3", ownerUserId: "someone" });
    db.country.findMany.mockResolvedValue([
      { id: "country_1", owner: { clerkUserId: "user_1" } },
      { id: "country_2", owner: { clerkUserId: "user_2" } },
    ]);
    db.militaryConflict.findUnique.mockResolvedValue(activeConflict(30));
    db.militaryConflict.updateMany.mockResolvedValue({ count: 1 });
    db.storytellerEffect.createMany.mockResolvedValue({ count: 2 });
  });

  it("resolves a due conflict through the combat model and tells both sides", async () => {
    const res = await conclude("user_2", "country_2", "country_2");

    expect(res).toMatchObject({ status: "resolved", winner: "country_1", outcomeBand: "success" });
    expect(concludePvP).toHaveBeenCalledWith(db, expect.objectContaining({ id: "conflict_1" }));
    expect(mockNotify).toHaveBeenCalledTimes(2);
    expect(mockNews).toHaveBeenCalledTimes(2);
  });

  it("refuses before the conflict's duration has run", async () => {
    db.militaryConflict.findUnique.mockResolvedValue(activeConflict(1));
    await expect(conclude("user_1", "country_1", "country_1")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(concludePvP).not.toHaveBeenCalled();
  });

  it("refuses a country that is not a party, and a caller who does not own the party", async () => {
    await expect(conclude("user_3", "country_3", "country_3")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(conclude("user_3", "country_3", "country_1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(concludePvP).not.toHaveBeenCalled();
  });

  it("does not resolve twice when the conflict was concluded concurrently", async () => {
    (concludePvP as jest.Mock).mockResolvedValueOnce(null);
    await expect(conclude("user_1", "country_1", "country_1")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

it("security.getPvNPCTargets lists only nations no player owns", async () => {
  db.user.findUnique.mockResolvedValue({ countryId: OWN });
  db.diplomaticRelation.findMany.mockResolvedValue([
    { country1: OWN, country2: "country_foreign" },
    { country1: "country_npc", country2: OWN },
  ]);
  db.country.findMany.mockResolvedValue([{ id: "country_npc", name: "Npcland" }]);

  const targets = await createCallerFactory(securityConflictsRouter)(
    ctxFor("owner")
  ).getPvNPCTargets();

  expect(targets).toEqual([{ id: "country_npc", name: "Npcland" }]);
  expect(db.country.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: { in: ["country_foreign", "country_npc"] }, ownerUserId: null },
    })
  );
});

describe("reads that never write (MC-13), derived on read (P1-21)", () => {
  beforeEach(() => {
    for (const model of [
      "diplomaticRelation",
      "militaryConflict",
      "foreignPolicyAction",
      "crisisEvent",
      "militaryBranch",
    ] as const) {
      db[model].findMany.mockResolvedValue([]);
    }
  });

  it("security.getSecurityAssessment derives the assessment", async () => {
    const caller = createCallerFactory(securityAssessmentRouter)(
      createMockCallerContext({ auth: null, user: null, db })
    );
    await expect(caller.getSecurityAssessment({ countryId: "c_1" })).resolves.toMatchObject({
      countryId: "c_1",
      militaryStrength: 0,
      activeThreatCount: 0,
      activeThreats: [],
    });
  });

  it("security.getBorderSecurity derives border security from neighbours", async () => {
    const caller = createCallerFactory(securityBordersRouter)(createMockCallerContext({ db }));
    await expect(caller.getBorderSecurity({ countryId: "c1" })).resolves.toEqual(
      expect.objectContaining({ countryId: "c1", landBorders: 0, neighborThreats: [] })
    );
  });
});

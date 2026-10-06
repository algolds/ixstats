// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
import { describe, it, expect, beforeEach } from "@jest/globals";
import { securityForceStructureRouter } from "~/server/api/routers/security/force-structure";
import { securityMilitaryRouter } from "~/server/api/routers/security/military";
import { securityOperationsRouter } from "~/server/api/routers/security/operations";
import { newsGenerator } from "~/lib/diplomacy/news-generator";
import { FORCE_LIMITS } from "~/lib/military/force-structure";

jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({
  db: { systemLog: { create: jest.fn() } },
  isDatabaseReadOnly: false,
}));

jest.spyOn(newsGenerator, "generateDiplomaticNews").mockResolvedValue("post_1" as any);

type MockFn = any;
const fn = () => jest.fn() as MockFn;

const mockDb = {
  user: { findUnique: fn() },
  country: { findUnique: fn(), findMany: fn() },
  militaryBranch: {
    findUnique: fn(),
    count: fn(),
    aggregate: fn(),
    create: fn(),
    createMany: fn(),
    update: fn(),
    delete: fn(),
  },
  militaryUnit: {
    findUnique: fn(),
    findMany: fn(),
    count: fn(),
    aggregate: fn(),
    create: fn(),
    update: fn(),
    updateMany: fn(),
    delete: fn(),
  },
  militaryAsset: { findUnique: fn(), findMany: fn(), count: fn(), create: fn(), update: fn() },
  militaryOperation: { create: fn() },
  deployment: { createMany: fn() },
  storytellerEffect: { create: fn() },
  governmentBudget: { findUnique: fn() },
  defenseBudget: { findUnique: fn() },
  diplomaticRelation: { findFirst: fn() },
  systemLog: { create: fn() },
  auditLog: { create: fn() },
};

const OWN = "country_1";
let calls = 0;

/** Each caller gets its own rate-limit bucket so the suite never trips the per-procedure limit. */
function ctxFor(who: "owner" | "stranger" | "admin" | "free") {
  const users = {
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
  const user = users[who];
  return {
    db: mockDb,
    user,
    auth: { userId: `clerk_${user.id}` },
    headers: new Headers(),
    rateLimitIdentifier: `test-${who}-${++calls}`,
  } as any;
}

const forces = (who: Parameters<typeof ctxFor>[0]) =>
  securityForceStructureRouter.createCaller(ctxFor(who));

const branchInput = { branchType: "army" as const, name: "Royal Army", activeDuty: 50_000 };
const storedBranch = {
  id: "b1",
  countryId: OWN,
  activeDuty: 50_000,
  reserves: 10_000,
  isActive: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  // Fresh lookups for the stranger find a member of another nation.
  mockDb.user.findUnique.mockImplementation(({ where }: any) =>
    Promise.resolve(
      where.clerkUserId === "clerk_u_other"
        ? { id: "u_other", countryId: "country_2", role: { name: "member" } }
        : null
    )
  );
  mockDb.country.findUnique.mockResolvedValue({
    id: OWN,
    ownerUserId: "u_owner",
    name: "Ownland",
    currentPopulation: 10_000_000,
    currentTotalGdp: 500e9,
    currentGdpPerCapita: 50_000,
  });
  mockDb.militaryBranch.count.mockResolvedValue(0);
  mockDb.militaryBranch.aggregate.mockResolvedValue({ _sum: { activeDuty: 0, reserves: 0 } });
  mockDb.militaryBranch.findUnique.mockResolvedValue(storedBranch);
  mockDb.militaryBranch.create.mockImplementation(({ data }: any) =>
    Promise.resolve({ id: "b_new", ...data })
  );
  mockDb.militaryBranch.update.mockImplementation(({ data }: any) =>
    Promise.resolve({ ...storedBranch, ...data })
  );
  mockDb.militaryUnit.count.mockResolvedValue(0);
  mockDb.militaryUnit.aggregate.mockResolvedValue({ _sum: { personnel: 0 } });
  mockDb.militaryUnit.create.mockImplementation(({ data }: any) =>
    Promise.resolve({ id: "u_new", ...data })
  );
  mockDb.militaryUnit.findUnique.mockResolvedValue({
    id: "unit1",
    branchId: "b1",
    personnel: 5_000,
    branch: { countryId: OWN, activeDuty: 50_000, reserves: 10_000 },
  });
  mockDb.militaryUnit.update.mockResolvedValue({ id: "unit1", name: "1st Division" });
  mockDb.governmentBudget.findUnique.mockResolvedValue({
    spendingCategories: JSON.stringify([{ category: "Defense", amount: 10e9 }]),
  });
  mockDb.defenseBudget.findUnique.mockResolvedValue(null);
  mockDb.systemLog.create.mockResolvedValue({ id: "log" });
});

describe("branch and unit authorization", () => {
  it("lets the owner create a branch for their nation", async () => {
    const created = await forces("owner").createMilitaryBranch({
      countryId: OWN,
      branch: branchInput,
    });
    expect(created).toMatchObject({ countryId: OWN, name: "Royal Army", activeDuty: 50_000 });
    expect(mockDb.militaryBranch.create).toHaveBeenCalledTimes(1);
  });

  it("forbids a stranger from creating, editing or deleting another nation's branches", async () => {
    await expect(
      forces("stranger").createMilitaryBranch({ countryId: OWN, branch: branchInput })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      forces("stranger").updateMilitaryBranch({ id: "b1", branch: { readinessLevel: 90 } })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(forces("stranger").deleteMilitaryBranch({ id: "b1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      forces("stranger").createMilitaryUnit({
        branchId: "b1",
        unit: { name: "Raiders", unitType: "brigade" },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(forces("stranger").deleteMilitaryUnit({ id: "unit1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mockDb.militaryBranch.create).not.toHaveBeenCalled();
    expect(mockDb.militaryBranch.update).not.toHaveBeenCalled();
    expect(mockDb.militaryBranch.delete).not.toHaveBeenCalled();
    expect(mockDb.militaryUnit.create).not.toHaveBeenCalled();
    expect(mockDb.militaryUnit.delete).not.toHaveBeenCalled();
  });

  it("lets an admin author any nation's force structure", async () => {
    await forces("admin").updateMilitaryBranch({ id: "b1", branch: { morale: 80 } });
    await forces("admin").deleteMilitaryUnit({ id: "unit1" });
    expect(mockDb.militaryBranch.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { morale: 80 },
    });
    expect(mockDb.militaryUnit.delete).toHaveBeenCalledWith({ where: { id: "unit1" } });
  });

  it("requires MyCountry Premium like the rest of Defense", async () => {
    await expect(
      forces("free").createMilitaryBranch({ countryId: OWN, branch: branchInput })
    ).rejects.toThrow(/Premium/);
  });

  it("returns NOT_FOUND for a missing branch or unit", async () => {
    mockDb.militaryBranch.findUnique.mockResolvedValueOnce(null);
    await expect(forces("owner").deleteMilitaryBranch({ id: "nope" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    mockDb.militaryUnit.findUnique.mockResolvedValueOnce(null);
    await expect(
      forces("owner").updateMilitaryUnit({ id: "nope", unit: { readiness: 10 } })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("hands asset CRUD the same owner-or-admin check", async () => {
    mockDb.militaryAsset.findUnique.mockResolvedValue({
      id: "a1",
      quantity: 10,
      operational: 5,
      branch: { countryId: OWN },
    });
    mockDb.militaryAsset.update.mockResolvedValue({ id: "a1" });
    const military = (who: Parameters<typeof ctxFor>[0]) =>
      securityMilitaryRouter.createCaller(ctxFor(who));
    await military("admin").updateMilitaryAsset({ id: "a1", asset: { operational: 7 } });
    await expect(
      military("stranger").updateMilitaryAsset({ id: "a1", asset: { operational: 7 } })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      military("owner").updateMilitaryAsset({ id: "a1", asset: { operational: 11 } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("validation", () => {
  it("rejects out-of-range fields", async () => {
    const bad = [
      { ...branchInput, name: "" },
      { ...branchInput, activeDuty: -1 },
      { ...branchInput, activeDuty: 1.5 },
      { ...branchInput, reserves: FORCE_LIMITS.maxReserves + 1 },
      { ...branchInput, readinessLevel: 101 },
      { ...branchInput, annualBudget: FORCE_LIMITS.maxBudget * 10 },
      { ...branchInput, imageUrl: "javascript:alert(1)" },
      { ...branchInput, branchType: "navy_seals" as never },
    ];
    for (const branch of bad) {
      await expect(
        forces("owner").createMilitaryBranch({ countryId: OWN, branch })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    await expect(
      forces("owner").createMilitaryUnit({
        branchId: "b1",
        unit: { name: "X", unitType: "brigade", personnel: FORCE_LIMITS.maxUnitPersonnel + 1 },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockDb.militaryBranch.create).not.toHaveBeenCalled();
  });

  it("does not reset omitted fields to defaults on update", async () => {
    await forces("owner").updateMilitaryBranch({ id: "b1", branch: { name: "Renamed" } });
    expect(mockDb.militaryBranch.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { name: "Renamed" },
    });
  });

  it("caps branches per nation and units per branch", async () => {
    mockDb.militaryBranch.count.mockResolvedValueOnce(FORCE_LIMITS.maxBranchesPerCountry);
    await expect(
      forces("owner").createMilitaryBranch({ countryId: OWN, branch: branchInput })
    ).rejects.toThrow(/at most/);
    mockDb.militaryUnit.count.mockResolvedValueOnce(FORCE_LIMITS.maxUnitsPerBranch);
    await expect(
      forces("owner").createMilitaryUnit({
        branchId: "b1",
        unit: { name: "X", unitType: "brigade" },
      })
    ).rejects.toThrow(/at most/);
  });

  it("keeps total personnel within a quarter of the population", async () => {
    mockDb.militaryBranch.aggregate.mockResolvedValueOnce({
      _sum: { activeDuty: 2_000_000, reserves: 400_000 },
    });
    await expect(
      forces("owner").createMilitaryBranch({
        countryId: OWN,
        branch: { ...branchInput, activeDuty: 200_000 },
      })
    ).rejects.toThrow(/25% of the population/);
  });

  it("keeps unit personnel within the branch's active duty and reserves", async () => {
    mockDb.militaryUnit.aggregate.mockResolvedValueOnce({ _sum: { personnel: 55_000 } });
    await expect(
      forces("owner").createMilitaryUnit({
        branchId: "b1",
        unit: { name: "2nd Division", unitType: "division", personnel: 10_000 },
      })
    ).rejects.toThrow(/Raise the branch's personnel/);

    // Shrinking a branch below what its units hold is refused too.
    mockDb.militaryUnit.aggregate.mockResolvedValueOnce({ _sum: { personnel: 40_000 } });
    await expect(
      forces("owner").updateMilitaryBranch({
        id: "b1",
        branch: { activeDuty: 20_000, reserves: 0 },
      })
    ).rejects.toThrow(/Raise the branch's personnel/);

    const unit = await forces("owner").createMilitaryUnit({
      branchId: "b1",
      unit: { name: "1st Division", unitType: "division", personnel: 15_000, designation: "" },
    });
    expect(unit).toMatchObject({ branchId: "b1", personnel: 15_000, designation: null });
  });
});

describe("starter force", () => {
  it("previews and creates army, navy and air force from builder data", async () => {
    const plan = await forces("owner").previewStarterForceStructure({ countryId: OWN });
    expect(plan.budgetSource).toBe("builder");
    expect(plan.branches).toHaveLength(3);

    const result = await forces("owner").seedStarterForceStructure({ countryId: OWN });
    expect(result).toEqual({ created: 3, budgetSource: "builder" });
    const rows = mockDb.militaryBranch.createMany.mock.calls[0][0].data;
    expect(rows.every((r: any) => r.countryId === OWN && r.activeDuty > 0)).toBe(true);
  });

  it("refuses when the nation already has branches, and for strangers", async () => {
    mockDb.militaryBranch.count.mockResolvedValueOnce(2);
    await expect(
      forces("owner").seedStarterForceStructure({ countryId: OWN })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      forces("stranger").seedStarterForceStructure({ countryId: OWN })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockDb.militaryBranch.createMany).not.toHaveBeenCalled();
  });
});

describe("deployments use only the nation's own units", () => {
  const launch = (unitIds: string[]) =>
    securityOperationsRouter.createCaller(ctxFor("owner")).createOperation({
      countryId: OWN,
      operationType: "training",
      name: "Exercise Northwind",
      personnelDeployed: 5_000,
      unitIds,
    });

  it("refuses unit ids that are not in the nation's active branches", async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: "u_owner" });
    mockDb.militaryUnit.findMany.mockResolvedValue([{ id: "unit1" }]);
    await expect(launch(["unit1", "foreign_unit"])).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mockDb.militaryUnit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branch: { countryId: OWN, isActive: true } }),
      })
    );
    expect(mockDb.militaryOperation.create).not.toHaveBeenCalled();
    expect(mockDb.militaryUnit.updateMany).not.toHaveBeenCalled();
  });

  it("deploys and draws readiness from the nation's own units", async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: "u_owner" });
    mockDb.militaryUnit.findMany.mockResolvedValue([{ id: "unit1" }]);
    mockDb.militaryOperation.create.mockResolvedValue({ id: "op1", targetCountry: null });
    await launch(["unit1"]);
    expect(mockDb.deployment.createMany).toHaveBeenCalledWith({
      data: [{ operationId: "op1", unitId: "unit1", status: "deployed" }],
    });
    expect(mockDb.militaryUnit.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["unit1"] } },
      data: { readiness: { decrement: 10 } },
    });
  });
});

/** @jest-environment node */
import { countryGrowthSchema } from "~/lib/countries/country-growth";
import {
  COUNTRY_GROWTH_UPDATED_ACTION,
  updateCountryGrowth,
} from "~/server/modules/countries/countries.growth";

const admin = { id: "a1", clerkUserId: "clerk_a1" };
const stored = {
  id: "c1",
  name: "Aurelia",
  populationGrowthRate: 0.01,
  adjustedGdpGrowth: 0.03,
  maxGdpGrowthRate: 0.05,
  localGrowthFactor: 1,
};

function setup(country: typeof stored | null = stored) {
  const db: any = {
    $transaction: jest.fn((cb: any) => cb(db)),
    country: {
      findUnique: jest.fn().mockResolvedValue(country),
      update: jest.fn(async ({ data }: any) => ({ ...stored, ...data })),
    },
    adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return db;
}

describe("countryGrowthSchema", () => {
  it("takes any subset of the growth fields within range", () => {
    expect(countryGrowthSchema.parse({ localGrowthFactor: 1.2 })).toEqual({
      localGrowthFactor: 1.2,
    });
    expect(countryGrowthSchema.safeParse({ populationGrowthRate: 0.5 }).success).toBe(false);
    expect(countryGrowthSchema.safeParse({ maxGdpGrowthRate: -0.01 }).success).toBe(false);
    // 0 would read as 1.0 in the projection (`|| 1.0`), so a factor must be positive.
    expect(countryGrowthSchema.safeParse({ localGrowthFactor: 0 }).success).toBe(false);
    expect(countryGrowthSchema.safeParse({ adjustedGdpGrowth: Infinity }).success).toBe(false);
  });
});

describe("updateCountryGrowth", () => {
  it("writes the changed fields and audits from and to", async () => {
    const db = setup();
    const result = await updateCountryGrowth(db, admin, {
      countryId: "c1",
      growth: { populationGrowthRate: 0.02, localGrowthFactor: 1 },
    });
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { populationGrowthRate: 0.02 },
      select: expect.any(Object),
    });
    expect(result).toMatchObject({ updated: true, country: { populationGrowthRate: 0.02 } });
    const audit = db.adminAuditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      action: COUNTRY_GROWTH_UPDATED_ACTION,
      targetType: "country",
      targetId: "c1",
      targetName: "Aurelia",
      adminId: "a1",
      adminName: "clerk_a1",
    });
    expect(JSON.parse(audit.changes)).toEqual({
      from: { populationGrowthRate: 0.01 },
      to: { populationGrowthRate: 0.02 },
    });
  });

  it("writes and audits nothing when nothing changes", async () => {
    const db = setup();
    const result = await updateCountryGrowth(db, admin, {
      countryId: "c1",
      growth: { adjustedGdpGrowth: 0.03 },
    });
    expect(result?.updated).toBe(false);
    expect(db.country.update).not.toHaveBeenCalled();
    expect(db.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("returns null for an unknown country", async () => {
    const db = setup(null);
    await expect(
      updateCountryGrowth(db, admin, { countryId: "nope", growth: { localGrowthFactor: 1.1 } })
    ).resolves.toBeNull();
  });
});

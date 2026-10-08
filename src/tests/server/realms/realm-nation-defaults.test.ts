/** @jest-environment node */
jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));
jest.mock("~/server/db", () => ({ db: {} }));

import {
  IXSTATS_NATION_GROWTH_DEFAULTS,
  type NationGrowthTable,
} from "~/lib/realms/nation-growth-defaults";
import {
  applyNationDefaults,
  getNationDefaults,
  NATION_DEFAULTS_APPLIED_ACTION,
  NATION_DEFAULTS_SAVED_ACTION,
  previewNationDefaults,
  saveNationDefaults,
  UNCLAIMED_NATION_WHERE,
} from "~/server/modules/realms/realms.nation-defaults";
import { realmNationDefaultsRouter } from "~/server/api/routers/realms/nation-defaults";
import {
  hasNationDefaults,
  realmNationDefaults,
  withNationDefaults,
} from "~/server/modules/realms/realms.settings";

const admin = { id: "a1", clerkUserId: "clerk_a1", role: { name: "admin", level: 10 } };
const founder = { id: "u1", clerkUserId: "clerk_founder", role: null };

const table: NationGrowthTable = {
  ...IXSTATS_NATION_GROWTH_DEFAULTS,
  Developing: { populationGrowthRate: 0.02, adjustedGdpGrowth: 0.004 },
};

const nation = (id: string, gdp: number, pop = 0.01, adj = 0.03, max = 0.05) => ({
  id,
  name: `Nation ${id}`,
  baselineGdpPerCapita: gdp,
  populationGrowthRate: pop,
  adjustedGdpGrowth: adj,
  maxGdpGrowthRate: max,
});

function setup(settings: object | null = { maxNationsPerUser: 2, nationDefaults: table }) {
  const realm = {
    id: "eurth-id",
    slug: "eurth",
    name: "Eurth",
    ownerId: "clerk_founder",
    settings,
  };
  const nations = [
    nation("a", 15_000),
    nation("b", 15_000, 0.02, 0.004, 0.075),
    nation("c", 70_000),
  ];
  const db: any = {
    $transaction: jest.fn((cb: any) => cb(db)),
    realm: {
      findUnique: jest.fn().mockResolvedValue(realm),
      update: jest.fn().mockResolvedValue({}),
    },
    country: {
      count: jest.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(3),
      findMany: jest.fn().mockResolvedValue(nations),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return { db, realm };
}

describe("realm settings: nationDefaults", () => {
  it("reads the stored table, else IxStats's defaults", () => {
    expect(realmNationDefaults({ nationDefaults: table })).toEqual(table);
    expect(realmNationDefaults(null)).toEqual(IXSTATS_NATION_GROWTH_DEFAULTS);
    expect(hasNationDefaults({ nationDefaults: table })).toBe(true);
    expect(hasNationDefaults({ maxNationsPerUser: 2 })).toBe(false);
  });

  it("sets or removes the table, keeping every other key", () => {
    const stored = { maxNationsPerUser: 2, map: { climateKey: "x" } };
    expect(withNationDefaults(stored, table)).toEqual({ ...stored, nationDefaults: table });
    expect(withNationDefaults({ ...stored, nationDefaults: table }, null)).toEqual(stored);
    expect(withNationDefaults(null, table)).toEqual({ nationDefaults: table });
  });
});

describe("UNCLAIMED_NATION_WHERE", () => {
  it("excludes owned nations and nations ever approved for a claim", () => {
    expect(UNCLAIMED_NATION_WHERE).toEqual({
      ownerUserId: null,
      realmClaims: { none: { status: "approved" } },
    });
  });
});

describe("realm nation defaults service", () => {
  it("is for site admins only, founders included", async () => {
    const { db } = setup();
    await expect(getNationDefaults(db, founder, "eurth-id")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(applyNationDefaults(db, founder, "eurth-id")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.country.updateMany).not.toHaveBeenCalled();
  });

  it("leaves IxWorld alone: its nations keep their curated roster values", async () => {
    const { db } = setup();
    await expect(applyNationDefaults(db, admin, "default")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(getNationDefaults(db, admin, "default")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.realm.findUnique).not.toHaveBeenCalled();
  });

  it("refuses an unknown realm", async () => {
    const { db } = setup();
    db.realm.findUnique.mockResolvedValue(null);
    await expect(previewNationDefaults(db, admin, "nope")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("shows the realm's table, whether it is its own, and its nation counts", async () => {
    const { db } = setup();
    const view = await getNationDefaults(db, admin, "eurth-id");
    expect(view).toEqual({
      realm: { id: "eurth-id", slug: "eurth", name: "Eurth" },
      table,
      custom: true,
      systemDefaults: IXSTATS_NATION_GROWTH_DEFAULTS,
      nations: 5,
      unclaimed: 3,
    });
    expect(db.country.count).toHaveBeenLastCalledWith({
      where: { realmId: "eurth-id", ...UNCLAIMED_NATION_WHERE },
    });
  });

  it("saves the table into the settings, keeping other keys, and audits it", async () => {
    const { db } = setup({ maxNationsPerUser: 2 });
    await saveNationDefaults(db, admin, { realmId: "eurth-id", table });
    expect(db.realm.update).toHaveBeenCalledWith({
      where: { id: "eurth-id" },
      data: { settings: { maxNationsPerUser: 2, nationDefaults: table } },
    });
    const audit = db.adminAuditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      action: NATION_DEFAULTS_SAVED_ACTION,
      targetType: "realm",
      targetId: "eurth-id",
      targetName: "Eurth",
      adminId: "a1",
      adminName: "clerk_a1",
    });
    expect(JSON.parse(audit.changes)).toEqual({
      previous: null,
      next: table,
    });
  });

  it("resets to IxStats's defaults by removing the table", async () => {
    const { db } = setup();
    await saveNationDefaults(db, admin, { realmId: "eurth-id", table: null });
    expect(db.realm.update).toHaveBeenCalledWith({
      where: { id: "eurth-id" },
      data: { settings: { maxNationsPerUser: 2 } },
    });
    expect(JSON.parse(db.adminAuditLog.create.mock.calls[0][0].data.changes)).toEqual({
      previous: table,
      next: null,
    });
  });

  it("previews the change on unclaimed nations only, writing nothing", async () => {
    const { db } = setup();
    const preview = await previewNationDefaults(db, admin, "eurth-id");
    expect(db.country.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { realmId: "eurth-id", ...UNCLAIMED_NATION_WHERE } })
    );
    expect(preview).toMatchObject({ unclaimed: 3, changed: 2, unchanged: 1 });
    expect(preview.byTier).toEqual({ Developing: 1, Extravagant: 1 });
    expect(preview.sample.map((c) => c.id)).toEqual(["a", "c"]);
    expect(preview.sample[0]!.to).toEqual({
      populationGrowthRate: 0.02,
      adjustedGdpGrowth: 0.004,
      maxGdpGrowthRate: 0.075,
    });
    expect(db.country.updateMany).not.toHaveBeenCalled();
    expect(db.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("applies to unclaimed nations, guarded against a claim since, and audits every change", async () => {
    const { db } = setup();
    const result = await applyNationDefaults(db, admin, "eurth-id");
    expect(result).toEqual({ unclaimed: 3, updated: 2 });
    expect(db.country.updateMany).toHaveBeenCalledTimes(2);
    expect(db.country.updateMany).toHaveBeenCalledWith({
      where: { id: "a", realmId: "eurth-id", ...UNCLAIMED_NATION_WHERE },
      data: { populationGrowthRate: 0.02, adjustedGdpGrowth: 0.004, maxGdpGrowthRate: 0.075 },
    });
    const audit = db.adminAuditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ action: NATION_DEFAULTS_APPLIED_ACTION, targetId: "eurth-id" });
    const changes = JSON.parse(audit.changes);
    expect(changes).toMatchObject({ unclaimed: 3, updated: 2, table });
    expect(changes.nations.map((n: { id: string }) => n.id)).toEqual(["a", "c"]);
  });

  it("counts only the nations it actually wrote", async () => {
    const { db } = setup();
    db.country.updateMany.mockResolvedValueOnce({ count: 0 }); // "a" was claimed meanwhile
    const result = await applyNationDefaults(db, admin, "eurth-id");
    expect(result.updated).toBe(1);
  });
});

describe("realms.nationDefaults router", () => {
  it("builds (no tRPC reserved names) with its four admin procedures", () => {
    expect(Object.keys(realmNationDefaultsRouter._def.procedures).sort()).toEqual([
      "applyToUnclaimed",
      "get",
      "preview",
      "save",
    ]);
  });
});

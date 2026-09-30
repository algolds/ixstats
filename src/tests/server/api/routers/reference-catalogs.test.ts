/**
 * Admin reference catalogs vs. what players see.
 *
 * - Military equipment and economic archetypes: the database is the source of truth. An empty
 *   table is seeded from the built-in data on first read, the player endpoints serve the
 *   admin-edited rows, and the built-in data is the fallback when the table can't be read.
 * - Government and economic components: the code library is the source of truth. The catalog
 *   endpoints serve it (with usage counts from the database), and there are no edit endpoints.
 */
import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { militaryEquipmentCatalogRouter } from "~/server/api/routers/militaryEquipment/catalog";
import { economicArchetypesPublicRouter } from "~/server/api/routers/economicArchetypes/public";
import { governmentComponentsRouter } from "~/server/api/routers/governmentComponents";
import { economicComponentsRouter } from "~/server/api/routers/economicComponents";
import { buildEquipmentCatalogSeed } from "~/lib/military/catalog-seed";
import { buildArchetypeSeedRows } from "~/lib/economy/archetypes/seed";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/economy/atomic-data";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

type MockDb = ReturnType<typeof createMockPrisma>;

function anonCtx(db: MockDb) {
  return createMockRouterContext({ auth: null, user: null, db }) as never;
}

function adminCtx(db: MockDb) {
  return createMockRouterContext({
    auth: { userId: "admin_1" },
    user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
    db,
  }) as never;
}

const catalogRow = {
  id: "clh3z0000000000000000abcd",
  key: "M1A2_SEPV3",
  name: "M1A2 Abrams SEPv3 (admin edit)",
  manufacturer: "GENERAL_DYNAMICS",
  category: "vehicle",
  subcategory: "tank",
  era: "CONTEMPORARY",
  specifications: JSON.stringify({ range: 450 }),
  capabilities: JSON.stringify({ category: "Main Battle Tank" }),
  acquisitionCost: 12_000_000,
  maintenanceCost: 600_000,
  technologyLevel: 88,
  crewRequirement: 4,
  imageUrl: null,
  isActive: true,
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe("militaryEquipment.getPlayerCatalog", () => {
  it("seeds an empty catalog from the built-in data, then serves the table's active rows", async () => {
    const db = createMockPrisma();
    db.militaryEquipmentCatalog.count.mockResolvedValue(0);
    db.defenseManufacturer.count.mockResolvedValue(0);
    db.militaryEquipmentCatalog.findMany.mockResolvedValue([catalogRow]);
    db.defenseManufacturer.findMany.mockResolvedValue([
      { key: "GENERAL_DYNAMICS", name: "General Dynamics", country: "USA" },
    ]);
    jest.spyOn(console, "info").mockImplementation(() => {});

    const result = await createCallerFactory(militaryEquipmentCatalogRouter)(
      anonCtx(db)
    ).getPlayerCatalog();

    expect(db.militaryEquipmentCatalog.createMany).toHaveBeenCalledWith({
      data: buildEquipmentCatalogSeed(),
      skipDuplicates: true,
    });
    expect(db.defenseManufacturer.createMany).toHaveBeenCalled();
    expect(db.militaryEquipmentCatalog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } })
    );
    expect(result.source).toBe("catalog");
    expect(result.equipment).toEqual([
      {
        key: "M1A2_SEPV3",
        type: "vehicle",
        name: "M1A2 Abrams SEPv3 (admin edit)",
        category: "Main Battle Tank",
        era: "CONTEMPORARY",
        manufacturer: "GENERAL_DYNAMICS",
        role: undefined,
        range: 450,
        acquisitionCost: 12_000_000,
        maintenanceCost: 600_000,
        technologyLevel: 88,
        imageUrl: null,
      },
    ]);
  });

  it("doesn't reseed a catalog that already has rows", async () => {
    const db = createMockPrisma();
    db.militaryEquipmentCatalog.count.mockResolvedValue(5);
    db.defenseManufacturer.count.mockResolvedValue(3);

    await createCallerFactory(militaryEquipmentCatalogRouter)(anonCtx(db)).getPlayerCatalog();

    expect(db.militaryEquipmentCatalog.createMany).not.toHaveBeenCalled();
    expect(db.defenseManufacturer.createMany).not.toHaveBeenCalled();
  });

  it("falls back to the built-in equipment when the catalog can't be read", async () => {
    const db = createMockPrisma();
    db.militaryEquipmentCatalog.count.mockRejectedValue(new Error("db down"));
    jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await createCallerFactory(militaryEquipmentCatalogRouter)(
      anonCtx(db)
    ).getPlayerCatalog();

    expect(result.source).toBe("builtin");
    expect(result.equipment).toHaveLength(buildEquipmentCatalogSeed().length);
    expect(result.manufacturers.length).toBeGreaterThan(0);
  });
});

describe("militaryEquipment admin edits", () => {
  it("updateCatalogEquipment saves the fields the admin form sends", async () => {
    const db = createMockPrisma();
    db.militaryEquipmentCatalog.findUnique.mockResolvedValue(catalogRow);
    db.defenseManufacturer.findFirst.mockResolvedValue({ key: "GENERAL_DYNAMICS" });
    db.militaryEquipmentCatalog.update.mockResolvedValue(catalogRow);
    jest.spyOn(console, "log").mockImplementation(() => {});

    await createCallerFactory(militaryEquipmentCatalogRouter)(adminCtx(db)).updateCatalogEquipment({
      id: catalogRow.id,
      name: "M1A2 Abrams SEPv3",
      manufacturer: "General Dynamics",
      category: "vehicle",
      era: "CONTEMPORARY",
      acquisitionCost: 12_500_000,
      technologyLevel: 90,
      crewRequirement: 4,
      imageUrl: "",
      isActive: false,
    });

    expect(db.defenseManufacturer.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ key: "General Dynamics" }, { name: "General Dynamics" }] },
      select: { key: true },
    });
    expect(db.militaryEquipmentCatalog.update).toHaveBeenCalledWith({
      where: { id: catalogRow.id },
      data: expect.objectContaining({
        name: "M1A2 Abrams SEPv3",
        manufacturer: "GENERAL_DYNAMICS",
        acquisitionCost: 12_500_000,
        technologyLevel: 90,
        imageUrl: null,
        isActive: false,
      }),
    });
  });

  it("createCatalogEquipment rejects an unknown manufacturer", async () => {
    const db = createMockPrisma();
    db.defenseManufacturer.findFirst.mockResolvedValue(null);
    jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      createCallerFactory(militaryEquipmentCatalogRouter)(adminCtx(db)).createCatalogEquipment({
        name: "Test Tank",
        manufacturer: "NOBODY",
        category: "vehicle",
        era: "MODERN",
        acquisitionCost: 1,
        maintenanceCost: 1,
        technologyLevel: 75,
        crewRequirement: 3,
      })
    ).rejects.toThrow(/Manufacturer not found/);
    expect(db.militaryEquipmentCatalog.create).not.toHaveBeenCalled();
  });
});

describe("economicArchetypes.getAllArchetypes", () => {
  it("seeds an empty table and serves rows with their key and era", async () => {
    const db = createMockPrisma();
    const [seed] = buildArchetypeSeedRows();
    db.economicArchetype.count.mockResolvedValueOnce(0).mockResolvedValue(1);
    db.economicArchetype.findMany.mockResolvedValue([
      { ...seed, id: "row_1", name: "Silicon Valley (admin edit)", usageCount: 3 },
    ]);
    jest.spyOn(console, "info").mockImplementation(() => {});

    const result = await createCallerFactory(economicArchetypesPublicRouter)(
      anonCtx(db)
    ).getAllArchetypes({ isActive: true });

    expect(db.economicArchetype.createMany).toHaveBeenCalledWith({
      data: buildArchetypeSeedRows(),
      skipDuplicates: true,
    });
    expect(result.archetypes[0]).toMatchObject({
      id: "row_1",
      key: "silicon-valley",
      era: "modern",
      name: "Silicon Valley (admin edit)",
      implementationComplexity: "high",
    });
  });

  it("incrementArchetypeUsage matches the row id or the archetype key", async () => {
    const db = createMockPrisma();
    db.economicArchetype.updateMany.mockResolvedValue({ count: 1 });

    await createCallerFactory(economicArchetypesPublicRouter)(
      createMockRouterContext({ db, rateLimitIdentifier: "ip:198.51.100.4" }) as never
    ).incrementArchetypeUsage({ archetypeId: "nordic" });

    expect(db.economicArchetype.updateMany).toHaveBeenCalledWith({
      where: { OR: [{ id: "nordic" }, { key: "nordic" }] },
      data: { usageCount: { increment: 1 } },
    });
  });
});

describe("component catalogs are code-defined", () => {
  it("governmentComponents.getAllComponents serves the code library with usage counts", async () => {
    const db = createMockPrisma();
    db.governmentComponentData.count.mockResolvedValue(64);
    db.governmentComponentData.findMany.mockResolvedValue([
      { componentType: "FEDERAL_SYSTEM", usageCount: 7 },
    ]);

    const result = await createCallerFactory(governmentComponentsRouter)(
      anonCtx(db)
    ).getAllComponents();

    const library = Object.values(ATOMIC_COMPONENTS).filter(Boolean);
    expect(result.count).toBe(library.length);
    const federal = result.components.find((c) => c.type === "FEDERAL_SYSTEM");
    expect(federal).toMatchObject({
      name: ATOMIC_COMPONENTS.FEDERAL_SYSTEM!.name,
      effectiveness: ATOMIC_COMPONENTS.FEDERAL_SYSTEM!.effectiveness,
      usageCount: 7,
    });
  });

  it("economicComponents.getAllComponents serves the code library even if the database differs", async () => {
    const db = createMockPrisma();
    db.economicComponentData.count.mockResolvedValue(27);
    db.economicComponentData.findMany.mockResolvedValue([]);

    const result = await createCallerFactory(economicComponentsRouter)(
      anonCtx(db)
    ).getAllComponents();

    expect(result.count).toBe(Object.values(ATOMIC_ECONOMIC_COMPONENTS).filter(Boolean).length);
    expect(result.components.every((c) => c.usageCount === 0)).toBe(true);
  });

  it("has no component edit endpoints", () => {
    for (const router of [governmentComponentsRouter, economicComponentsRouter]) {
      const procedures = Object.keys(router._def.procedures);
      for (const name of [
        "createComponent",
        "updateComponent",
        "deleteComponent",
        "createSynergy",
      ]) {
        expect(procedures).not.toContain(name);
      }
    }
  });
});

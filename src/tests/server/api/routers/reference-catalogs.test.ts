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
  it("doesn't reseed a catalog that already has rows", async () => {
    const db = createMockPrisma();
    db.militaryEquipmentCatalog.count.mockResolvedValue(5);
    db.defenseManufacturer.count.mockResolvedValue(3);

    await createCallerFactory(militaryEquipmentCatalogRouter)(anonCtx(db)).getPlayerCatalog();

    expect(db.militaryEquipmentCatalog.createMany).not.toHaveBeenCalled();
    expect(db.defenseManufacturer.createMany).not.toHaveBeenCalled();
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

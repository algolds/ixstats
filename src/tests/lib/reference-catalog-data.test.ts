import { describe, it, expect } from "@jest/globals";
import { buildEquipmentCatalogSeed, buildManufacturerSeed } from "~/lib/military/catalog-seed";
import { catalogRowToPreset } from "~/lib/military/player-catalog";
import { buildArchetypeSeedRows } from "~/lib/economy/archetypes/seed";

describe("military equipment seed", () => {
  const rows = buildEquipmentCatalogSeed();

  it("has unique keys and only known manufacturers", () => {
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    const manufacturers = new Set(buildManufacturerSeed().map((m) => m.key));
    expect(rows.filter((row) => !manufacturers.has(row.manufacturer))).toEqual([]);
  });

  it("maps every row to a player asset type", () => {
    const types = new Set(rows.map((row) => catalogRowToPreset(row).type));
    expect(types).toEqual(new Set(["aircraft", "ship", "vehicle", "weapon_system"]));
  });
});

describe("catalogRowToPreset", () => {
  const row = {
    key: "CUSTOM",
    name: "Field Hospital",
    manufacturer: "Some Maker",
    category: "support",
    subcategory: "medical",
    era: "MODERN",
    specifications: "not json",
    capabilities: "",
    acquisitionCost: 1000,
    maintenanceCost: 10,
    technologyLevel: 70,
  };

  it("tolerates unparseable JSON and falls back to the subcategory for the label", () => {
    expect(catalogRowToPreset(row)).toMatchObject({
      type: "installation",
      category: "medical",
      range: undefined,
      role: undefined,
      technologyLevel: 70,
    });
  });
});

describe("economic archetype seed", () => {
  it("seeds every built-in archetype once, with its era", () => {
    const rows = buildArchetypeSeedRows();
    expect(rows).toHaveLength(20);
    expect(new Set(rows.map((row) => row.key)).size).toBe(20);
    expect(rows.filter((row) => row.era === "historical")).toHaveLength(10);
    expect(rows.find((row) => row.key === "british-empire")?.era).toBe("historical");
  });
});

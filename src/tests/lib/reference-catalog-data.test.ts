import { describe, it, expect } from "@jest/globals";
import { buildEquipmentCatalogSeed, buildManufacturerSeed } from "~/lib/military/catalog-seed";
import { catalogRowToPreset } from "~/lib/military/player-catalog";
describe("military equipment seed", () => {
  const rows = buildEquipmentCatalogSeed();

  it("has unique keys and only known manufacturers", () => {
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    const manufacturers = new Set(buildManufacturerSeed().map((m) => m.key));
    expect(rows.filter((row) => !manufacturers.has(row.manufacturer))).toEqual([]);
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

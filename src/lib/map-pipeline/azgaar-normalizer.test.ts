import { describe, it, expect } from "@jest/globals";
import { generateWorld } from "../worldgen/engine";
import { normalizeAzgaarGraph } from "./azgaar-normalizer";

describe("azgaar-normalizer", () => {
  it("converts a generated world graph into normalized GeoJSON layers and country entities", () => {
    const world = generateWorld({ seed: 42, cellCount: 500 });
    const normalized = normalizeAzgaarGraph(world.graph, 42);

    expect(normalized.metadata.seed).toBe(42);
    expect(normalized.layers.political).toBeDefined();
    expect(normalized.layers.altitudes).toBeDefined();
    expect(normalized.layers.rivers).toBeDefined();
    expect(normalized.countries.length).toBeGreaterThan(0);
    expect(normalized.countries[0]).toHaveProperty("featureId");
    expect(normalized.countries[0]).toHaveProperty("name");
    expect(normalized.countries[0]).toHaveProperty("areaSqKm");
  });
});

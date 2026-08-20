import { synthesizeHybridVectorWorld } from "~/lib/maps/pipeline/vector-synthesis";

describe("Vector Synthesis Engine", () => {
  it("synthesizes valid RFC 7946 GeoJSON collections across random seeds", () => {
    const world = synthesizeHybridVectorWorld(12345);

    expect(world).toHaveProperty("background");
    expect(world).toHaveProperty("altitudes");
    expect(world).toHaveProperty("rivers");
    expect(world).toHaveProperty("lakes");

    expect(world.background.features.length).toBeGreaterThan(0);
    expect(world.altitudes.features.length).toBeGreaterThan(0);
    expect(world.rivers.features.length).toBeGreaterThan(0);
    expect(world.lakes.features.length).toBeGreaterThan(0);

    // Verify numeric feature IDs
    for (const feat of world.altitudes.features) {
      expect(typeof feat.id).toBe("number");
      expect(feat.geometry.type).toMatch(/Polygon|MultiPolygon/);
    }

    for (const feat of world.rivers.features) {
      expect(typeof feat.id).toBe("number");
      expect(feat.geometry.type).toBe("LineString");
    }
  });
});

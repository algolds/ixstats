import { generateWorld } from "./engine";

describe("Heightmap & Topographic Elevation Coverage", () => {
  it("guarantees 100% topographic elevation multi-zone gradient across random seeds", () => {
    const seeds = [101, 202, 303, 404, 505, 606, 707, 808, 909, 1010];

    for (const seed of seeds) {
      const world = generateWorld({ seed, cellCount: 1500 });
      const { cells } = world.graph;

      const zoneSet = new Set<number>();
      let landCount = 0;

      for (let i = 0; i < cells.n; i++) {
        if (cells.h[i]! > 50) {
          landCount++;
          zoneSet.add(cells.elevZone[i]!);
        }
      }

      expect(landCount).toBeGreaterThan(100);
      // Must contain at least 4 distinct elevation zones (Lowlands -> Hills -> Uplands -> Mountains)
      expect(zoneSet.size).toBeGreaterThanOrEqual(4);
    }
  });
});

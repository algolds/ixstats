import { generateMarchingSquaresAltitudes } from "./marching-squares";
import { generateWorld } from "./engine";

describe("Marching Squares Topographic Isolines", () => {
  it("generates smooth elevation contours with valid polygon geometries", () => {
    const world = generateWorld({ seed: 999, cellCount: 1500 });
    const altitudes = generateMarchingSquaresAltitudes(world.graph);

    expect(altitudes).toHaveProperty("features");
    expect(altitudes.features.length).toBeGreaterThan(0);

    for (const feat of altitudes.features) {
      expect(typeof feat.id).toBe("number");
      expect(feat.geometry.type).toBe("Polygon");
      expect((feat.geometry as any).coordinates[0].length).toBeGreaterThanOrEqual(4);
    }
  });
});

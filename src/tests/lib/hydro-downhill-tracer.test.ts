import { traceDownhillRiver } from "../../lib/maps/hydro-downhill-tracer";

describe("HydroDownhillTracer", () => {
  it("generates a valid LineString river path flowing downhill", () => {
    const startCoords: [number, number] = [12.5, 45.2];
    const result = traceDownhillRiver(startCoords, undefined, {
      maxSteps: 50,
      stepDeg: 0.05,
      meanderFactor: 1.0,
      initialOrder: 1,
    });

    expect(result.geometry.type).toBe("LineString");
    expect(result.geometry.coordinates.length).toBeGreaterThan(5);
    expect(result.lengthKm).toBeGreaterThan(0);
    expect(result.strahlerOrder).toBeGreaterThanOrEqual(1);
    expect(result.profile.length).toBe(result.geometry.coordinates.length);
    expect(result.profile[0]!.distanceKm).toBe(0);
  });

  it("follows elevation gradients when elevation sampling function is provided", () => {
    // Synthetic elevation field: mountain at [10, 10] with height 3000, slope drops toward [15, 10]
    const sampleElevation = (lng: number, _lat: number) => {
      const distFromCoast = 15 - lng;
      return Math.max(0, distFromCoast * 200);
    };

    const startCoords: [number, number] = [10.0, 10.0];
    const result = traceDownhillRiver(startCoords, sampleElevation, {
      maxSteps: 60,
      stepDeg: 0.08,
    });

    expect(result.geometry.coordinates.length).toBeGreaterThan(10);
    expect(result.elevationDropMeters).toBeGreaterThan(0);

    // Verify coordinates progressed eastward toward lower elevation
    const finalCoord = result.mouthCoords;
    expect(finalCoord[0]!).toBeGreaterThan(startCoords[0]);
  });
});

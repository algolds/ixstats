import {
  colorReliefRamp,
  DEFAULT_TERRAIN,
  readTerrainPrefs,
  TERRAIN_ZOOM,
  terrainFrame,
  TILT_PITCH,
  writeTerrainPrefs,
} from "./terrain";

describe("terrainFrame", () => {
  it("tilts a flat camera once, when zooming in past the tilt zoom", () => {
    expect(terrainFrame("auto", 3, 4.5, 0)).toEqual({ terrain: true, pitchTo: TILT_PITCH });
    expect(terrainFrame("auto", 4.5, 5, 0)).toEqual({ terrain: true, pitchTo: null });
    expect(terrainFrame("auto", 3, 4.5, 30)).toEqual({ terrain: true, pitchTo: null });
  });

  it("flattens the camera and drops terrain when zooming back out", () => {
    expect(terrainFrame("auto", 5, 2, 45)).toEqual({ terrain: false, pitchTo: 0 });
    expect(terrainFrame("auto", 2, 1, 0)).toEqual({ terrain: false, pitchTo: null });
    expect(terrainFrame("auto", 4, TERRAIN_ZOOM, 45).terrain).toBe(true);
  });

  it("keeps a 2D map flat", () => {
    expect(terrainFrame("off", 3, 6, 20)).toEqual({ terrain: false, pitchTo: 0 });
    expect(terrainFrame("off", 3, 6, 0)).toEqual({ terrain: false, pitchTo: null });
  });
});

it("ramps from a transparent sea level up through the elevation key, in rising order", () => {
  const ramp: readonly unknown[] = colorReliefRamp();
  const stops = ramp.slice(3).filter((_, i) => i % 2 === 0) as number[];
  for (let i = 1; i < stops.length; i++) expect(stops[i]!).toBeGreaterThan(stops[i - 1]!);
  expect(ramp[ramp.indexOf(0) + 1]).toBe("rgba(0, 0, 0, 0)");
  expect(ramp.at(-1)).toMatch(/^#[0-9a-f]{6}$/);
});

it("stores the viewer's choice and falls back to the default for anything else", () => {
  localStorage.clear();
  expect(readTerrainPrefs()).toEqual(DEFAULT_TERRAIN);
  writeTerrainPrefs({ mode: "off", exaggeration: 2.5 });
  expect(readTerrainPrefs()).toEqual({ mode: "off", exaggeration: 2.5 });
  localStorage.setItem("ixmaps:terrain", '{"mode":"x","exaggeration":99}');
  expect(readTerrainPrefs()).toEqual(DEFAULT_TERRAIN);
});

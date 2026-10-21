/** @jest-environment node */
/**
 * What the World tab uploads and how it words what comes back: the bundle built from a generated world (which the
 * server's parser must accept), the readable copy for a refusal, and the diff as a person reads it.
 */
import { encodeWorldBundle, parseWorldBundleJson } from "~/lib/maps/import/world-bundle";
import { parseWorldBundle } from "~/lib/maps/import/world-bundle.node";
import type { LandMaskLayers } from "~/lib/worldgen/land-mask";
import { MapUploadError } from "~/lib/maps/import/upload-client";
import { buildWorldBundle, failureOf, draftKey } from "~/lib/worldgen/world-apply";
import { worldResult } from "~/tests/helpers/fake-world-worker";
import { realWorld } from "~/tests/helpers/real-world-result";

/** A generated world as `useWorldGenerator` holds it, made by the real generator through the real worker runner. */
const generated = realWorld;

/** A realm's landmass and borders: a box of land with one country in it. */
const box: LandMaskLayers = {
  background: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-60, -30],
              [60, -30],
              [60, 30],
              [-60, 30],
              [-60, -30],
            ],
          ],
        },
      },
    ],
  },
  political: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Boxland" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-60, -30],
              [60, -30],
              [60, 30],
              [-60, 30],
              [-60, -30],
            ],
          ],
        },
      },
    ],
  },
};

describe("buildWorldBundle", () => {
  it("is a world around the realm's borders when they were kept: no political layer and no slots", () => {
    const result = worldResult({
      slots: [],
      layers: Object.fromEntries(
        Object.entries(worldResult().layers).filter(([name]) => name !== "political")
      ),
    });
    const bundle = buildWorldBundle(result, "realm-map");
    expect(bundle.source).toBe("realm-map");
    expect(bundle.layers).not.toHaveProperty("political");
    expect(bundle.slots).toEqual([]);
    expect(parseWorldBundleJson(JSON.stringify(bundle))).toMatchObject({ ok: true });
  });

  it("leaves a stray political layer out of a world around the realm's borders", () => {
    const bundle = buildWorldBundle(worldResult(), "realm-map");
    expect(bundle.layers).not.toHaveProperty("political");
  });

  it("names the layer a draft lacks", () => {
    const { rivers: _rivers, ...layers } = worldResult().layers;
    expect(() => buildWorldBundle(worldResult({ layers }), "preset")).toThrow(
      "The preview has no rivers layer"
    );
  });

  it("names the layer that cannot be read", () => {
    const layers = { ...worldResult().layers, lakes: "{not json" };
    expect(() => buildWorldBundle(worldResult({ layers }), "preset")).toThrow(
      "The lakes layer of the preview could not be read"
    );
  });
});

describe("draftKey", () => {
  it("is the same for the same world and differs by seed, parameters and source", () => {
    const world = worldResult({ seed: 7 });
    expect(draftKey(world, "preset")).toBe(draftKey(worldResult({ seed: 7 }), "preset"));
    expect(draftKey(world, "preset")).not.toBe(draftKey(world, "realm-map"));
    expect(draftKey(world, "preset")).not.toBe(draftKey(worldResult({ seed: 8 }), "preset"));
    const warmer = worldResult({ seed: 7, params: { ...world.params, temperatureOffset: 3 } });
    expect(draftKey(world, "preset")).not.toBe(draftKey(warmer, "preset"));
  });
});
describe("buildWorldBundle on worlds the generator really makes", () => {
  it.each([
    ["a preset world", () => buildWorldBundle(generated(), "preset"), "preset"],
    [
      "a world fitted to the realm's borders",
      () => buildWorldBundle(generated({ landMaskLayers: box, keepBorders: true }), "realm-map"),
      "realm-map",
    ],
  ] as const)(
    "is read by the server from the gzip the browser sends: %s",
    async (_name, build, source) => {
      const bundle = build();
      const parsed = parseWorldBundle(await encodeWorldBundle(bundle));
      expect(parsed).toMatchObject({ ok: true });
      if (!parsed.ok) return;
      expect(parsed.bundle.source).toBe(source);
      expect(parsed.bundle.seed).toBe(bundle.seed);
      expect(parsed.bundle.slots).toEqual(bundle.slots);
      expect(parsed.bundle.cells).toBe(bundle.cells);
      expect(parsed.bundle.params.developmentLevel).toBe(bundle.params.developmentLevel);
    }
  );
});

describe("failureOf", () => {
  it("reads the code a tRPC refusal carries", () => {
    const refusal = Object.assign(new Error("Archived"), { data: { code: "FORBIDDEN" } });
    expect(failureOf(refusal, "check")).toEqual({
      stage: "check",
      code: "FORBIDDEN",
      reason: "Archived",
    });
  });

  it.each([
    [400, "BAD_REQUEST"],
    [401, "UNAUTHORIZED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [409, "CONFLICT"],
    [413, "BAD_REQUEST"],
    [429, "TOO_MANY_REQUESTS"],
  ])("reads the upload route's %i as %s", (status, code) => {
    expect(failureOf(new MapUploadError("refused", status), "send")).toMatchObject({ code });
  });
});

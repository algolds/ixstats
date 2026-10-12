/** @jest-environment node */
/**
 * What the World tab uploads and how it words what comes back: the bundle built from a generated world (which the
 * server's parser must accept), the readable copy for a refusal, and the diff as a person reads it.
 */
import {
  decodeCells,
  encodeWorldBundle,
  parseWorldBundleJson,
} from "~/lib/maps/import/world-bundle";
import { parseWorldBundle } from "~/lib/maps/import/world-bundle.node";
import type { LandMaskLayers } from "~/lib/worldgen/land-mask";
import { controlsForPreset, paramsFromControls } from "~/lib/worldgen/world-controls";
import { MapUploadError } from "~/lib/maps/import/upload-client";
import {
  buildWorldBundle,
  describeWorldFailure,
  failureOf,
  draftKey,
  layerChangeText,
  slotChangeText,
  appliedText,
  countOf,
  splitWarnings,
} from "~/lib/worldgen/world-apply";
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
  it("makes a bundle the server's parser accepts from a generated world", () => {
    const result = generated();
    const bundle = buildWorldBundle(result, "preset");
    const parsed = parseWorldBundleJson(JSON.stringify(bundle));
    expect(parsed).toMatchObject({ ok: true });
    expect(bundle).toMatchObject({
      version: 1,
      seed: result.seed,
      source: "preset",
      params: { developmentLevel: result.params.developmentLevel },
    });
    expect(Object.keys(bundle.layers).sort()).toEqual(
      ["altitudes", "background", "climate", "icecaps", "lakes", "political", "rivers"].sort()
    );
    const decoded = decodeCells(bundle.cells);
    expect(decoded.ok && decoded.cells).toEqual(result.cells);
  });

  it("carries the slots, each left claimable, without the cell count", () => {
    const result = generated();
    const bundle = buildWorldBundle(result, "preset");
    expect(bundle.slots.length).toBeGreaterThan(0);
    expect(bundle.slots).toHaveLength(result.slots.length);
    const [first] = result.slots;
    expect(bundle.slots[0]).toEqual({
      key: first!.key,
      name: first!.name,
      colour: first!.colour,
      claimable: true,
      population: first!.population,
      gdpPerCapita: first!.gdpPerCapita,
      areaKm2: first!.areaKm2,
    });
  });

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

describe("describeWorldFailure", () => {
  const reason = "The world is locked: 2 claims are pending or approved in this realm";

  it.each([
    ["CONFLICT", "The realm can't take a world right now."],
    ["FORBIDDEN", "You can't change this realm's world."],
    ["BAD_REQUEST", "The server refused this world."],
    ["NOT_FOUND", "The realm or the uploaded world was not found."],
    ["UNAUTHORIZED", "You are signed out. Sign in again, then retry."],
    ["TOO_MANY_REQUESTS", "Too many requests. Wait a minute, then retry."],
  ])("words %s and keeps the server's reason", (code, title) => {
    expect(describeWorldFailure({ stage: "check", code, reason })).toEqual({ title, reason });
  });

  it.each([
    ["CONFLICT", "The relief can't be rebuilt right now."],
    ["FORBIDDEN", "You can't rebuild this realm's relief."],
    ["BAD_REQUEST", "The relief could not be rebuilt."],
    ["NOT_FOUND", "The realm was not found."],
  ])("words a %s refusal of a relief rebuild as the relief's, not the world's", (code, title) => {
    expect(describeWorldFailure({ stage: "relief", code, reason })).toEqual({ title, reason });
  });

  it.each([
    ["send", "The world could not be sent."],
    ["check", "The world could not be checked."],
    ["apply", "The world could not be applied."],
  ] as const)("says what failed when the server gave no code (%s)", (stage, title) => {
    expect(describeWorldFailure({ stage, reason: "Disk full" })).toEqual({
      title,
      reason: "Disk full",
    });
  });
});

describe("buildWorldBundle on worlds the generator really makes", () => {
  it("makes a world fitted to the realm's borders into a bundle with no borders and no nations", () => {
    const result = generated({ landMaskLayers: box, keepBorders: true });
    expect(result.slots).toEqual([]);
    expect(result.layers).not.toHaveProperty("political");
    const bundle = buildWorldBundle(result, "realm-map");
    expect(bundle).toMatchObject({ source: "realm-map", slots: [] });
    expect(Object.keys(bundle.layers).sort()).toEqual(
      ["altitudes", "background", "climate", "icecaps", "lakes", "rivers"].sort()
    );
    expect(parseWorldBundleJson(JSON.stringify(bundle))).toMatchObject({ ok: true });
  });

  it("keeps the layers of a world with no rivers and no lakes, empty", () => {
    const params = paramsFromControls({ ...controlsForPreset("ixnay"), rivers: 0, lakes: 0 });
    const result = generated({ params: { ...params, cellCount: 3000, plateCount: 8 } });
    const bundle = buildWorldBundle(result, "preset");
    expect(bundle.layers.rivers.features).toEqual([]);
    expect(bundle.layers.lakes.features).toEqual([]);
    expect(parseWorldBundleJson(JSON.stringify(bundle))).toMatchObject({ ok: true });
  });

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

  it("has no code for an upload that failed on the network, a status it does not know, or any other error", () => {
    expect(failureOf(new MapUploadError("too big", null), "send").code).toBeUndefined();
    expect(failureOf(new MapUploadError("bad gateway", 502), "send").code).toBeUndefined();
    expect(failureOf(new Error("boom"), "apply")).toEqual({
      stage: "apply",
      code: undefined,
      reason: "boom",
    });
  });
});

describe("the diff in words", () => {
  it.each([
    [{ create: 3, change: 2, retire: 1 }, "3 new, 2 changed, 1 retired"],
    [{ create: 0, change: 4, retire: 0 }, "4 changed"],
    [{ create: 12, change: 0, retire: 0 }, "12 new"],
    [{ create: 0, change: 0, retire: 0 }, "No change"],
  ])("sums up a layer (%j)", (diff, text) => {
    expect(layerChangeText(diff)).toBe(text);
  });

  it("sums up the nations: new, retired, kept, renamed", () => {
    expect(slotChangeText({ create: 12, retire: 3, keep: 2, renamed: 1 })).toBe(
      "12 new, 3 retired, 2 kept, 1 renamed"
    );
    expect(slotChangeText({ create: 0, retire: 0, keep: 0, renamed: 0 })).toBe("No change");
  });

  it("sums up what an apply wrote", () => {
    expect(appliedText({ written: 140, slots: { created: 12, retired: 3 } })).toBe(
      "140 map features written, 12 nations created, 3 nations retired"
    );
    expect(appliedText({ written: 1, slots: { created: 1, retired: 1 } })).toBe(
      "1 map feature written, 1 nation created, 1 nation retired"
    );
    expect(appliedText({ written: 0, slots: { created: 0, retired: 0 } })).toBe(
      "Nothing was written"
    );
  });

  it.each([
    [0, "0 nations"],
    [1, "1 nation"],
    [2, "2 nations"],
  ])("counts %i with the right plural", (count, text) => {
    expect(countOf(count, "nation")).toBe(text);
  });

  it("splits the warnings by the server's own list of what replaces work, not by their wording", () => {
    const warnings = [
      "Something odd about the wording",
      "3 names were already taken in this realm and got a number",
      "The realm's current map (40 features) will be replaced",
    ];
    expect(
      splitWarnings({
        warnings,
        replaces: ["Something odd about the wording"],
      })
    ).toEqual({
      replaces: ["Something odd about the wording"],
      notes: [
        "3 names were already taken in this realm and got a number",
        "The realm's current map (40 features) will be replaced",
      ],
    });
    expect(splitWarnings({ warnings, replaces: [] }).replaces).toEqual([]);
  });

  it("reads every warning as a note when there is no list, as in a check stored before the server made one", () => {
    const stored = { warnings: ["A", "B"] } as { warnings: string[]; replaces: string[] };
    expect(splitWarnings(stored)).toEqual({ replaces: [], notes: ["A", "B"] });
  });
});

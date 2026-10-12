/** @jest-environment node */
/**
 * What the World tab uploads and how it words what comes back: the bundle built from a generated world (which the
 * server's parser must accept), the readable copy for a refusal, and the diff as a person reads it.
 */
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import { generateWorld } from "~/lib/worldgen/v2";
import { parseWorldBundleJson, decodeCells } from "~/lib/maps/import/world-bundle";
import type { WorldGenResult } from "~/lib/worldgen/worker/world-messages";
import { MapUploadError } from "~/lib/maps/import/upload-client";
import {
  buildWorldBundle,
  describeWorldFailure,
  failureOf,
  isReplacementWarning,
  layerChangeText,
  slotChangeText,
  appliedText,
} from "~/lib/worldgen/world-apply";
import { worldResult } from "~/tests/helpers/fake-world-worker";

/** A generated world as the worker hands it over: each layer a JSON string. */
function generated(over: Partial<typeof DEFAULT_PARAMS> = {}): WorldGenResult {
  const world = generateWorld({
    ...DEFAULT_PARAMS,
    seed: 7,
    cellCount: 3000,
    plateCount: 8,
    ...over,
  });
  return {
    seed: world.seed,
    params: world.params,
    layers: Object.fromEntries(
      Object.entries(world.layers).map(([name, layer]) => [name, JSON.stringify(layer)])
    ),
    slots: world.slots,
    stats: { landShare: 0.3, continents: 4, climateMix: {}, slotCount: 0, baseline: null },
    cells: world.cells,
    relief: { width: 2, height: 2, rgba: new Uint8ClampedArray(16) },
  };
}

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
    expect(appliedText({ written: 0, slots: { created: 0, retired: 0 } })).toBe(
      "Nothing was written"
    );
  });

  it.each([
    ["14 features were edited by hand since the last generation and will be replaced", true],
    ["The realm's current map (40 features) will be replaced", true],
    ["2 map imports were applied since the last generation and will be replaced", true],
    ["3 names were already taken in this realm and got a number", false],
    ["The realm's borders are kept: 5 regions with no nation become claimable nations", false],
  ])("tells a warning about replaced work from the others (%s)", (warning, replaced) => {
    expect(isReplacementWarning(warning)).toBe(replaced);
  });
});

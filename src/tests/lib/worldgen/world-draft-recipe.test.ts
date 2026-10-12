/**
 * The World tab's draft recipe: seed and controls kept in browser storage per realm, so reopening the tab brings the
 * preview back. Storage may be missing, full, blocked or hold anything, and none of that may break the tab.
 */

import { CONTROL_LIMITS, controlsForPreset } from "~/lib/worldgen/world-controls";
import {
  clearWorldRecipe,
  loadWorldRecipe,
  saveWorldRecipe,
  worldRecipeKey,
  type WorldRecipe,
} from "~/lib/worldgen/world-draft-recipe";

const recipe = (): WorldRecipe => ({
  seed: 4242,
  controls: { ...controlsForPreset("eurth"), source: "realm-map", continents: 3 },
});

beforeEach(() => window.localStorage.clear());
afterEach(() => jest.restoreAllMocks());

describe("world draft recipe", () => {
  it("restores what was saved, per realm", () => {
    saveWorldRecipe("realm_a", recipe());
    expect(loadWorldRecipe("realm_a")).toEqual(recipe());
    expect(loadWorldRecipe("realm_b")).toBeNull();
  });

  it("keeps the seed, the source and the preset's controls under one key per realm", () => {
    saveWorldRecipe("realm_a", recipe());
    const stored = JSON.parse(window.localStorage.getItem(worldRecipeKey("realm_a"))!);
    expect(stored.seed).toBe(4242);
    expect(stored.controls.source).toBe("realm-map");
    expect(stored.controls.preset).toBe("eurth");
    expect(worldRecipeKey("realm_a")).not.toBe(worldRecipeKey("realm_b"));
  });

  it("forgets a recipe on request", () => {
    saveWorldRecipe("realm_a", recipe());
    clearWorldRecipe("realm_a");
    expect(loadWorldRecipe("realm_a")).toBeNull();
  });

  it("returns nothing for text that is not JSON", () => {
    window.localStorage.setItem(worldRecipeKey("realm_a"), "{not json");
    expect(loadWorldRecipe("realm_a")).toBeNull();
  });

  it("returns nothing for JSON of the wrong shape", () => {
    const key = worldRecipeKey("realm_a");
    for (const value of [
      "null",
      "[]",
      '{"seed":"x","controls":{}}',
      '{"seed":5}',
      JSON.stringify({ seed: 5, controls: { ...recipe().controls, source: "elsewhere" } }),
      JSON.stringify({ seed: 5, controls: { ...recipe().controls, preset: "mars" } }),
      JSON.stringify({ seed: 5, controls: { ...recipe().controls, developmentLevel: "none" } }),
      JSON.stringify({ seed: 5, controls: { ...recipe().controls, latitudeBand: [1] } }),
    ]) {
      window.localStorage.setItem(key, value);
      expect({ value, loaded: loadWorldRecipe("realm_a") }).toEqual({ value, loaded: null });
    }
  });

  it("pulls stored numbers back inside the slider limits", () => {
    window.localStorage.setItem(
      worldRecipeKey("realm_a"),
      JSON.stringify({ seed: 9, controls: { ...recipe().controls, continents: 99, rainfall: -3 } })
    );
    const loaded = loadWorldRecipe("realm_a");
    expect(loaded?.controls.continents).toBe(CONTROL_LIMITS.continents.max);
    expect(loaded?.controls.rainfall).toBe(CONTROL_LIMITS.rainfall.min);
  });

  it("turns a seed that is not a whole positive number into no recipe", () => {
    for (const seed of [0, -4, 1.5, Number.NaN]) {
      window.localStorage.setItem(
        worldRecipeKey("realm_a"),
        JSON.stringify({ seed, controls: recipe().controls })
      );
      expect(loadWorldRecipe("realm_a")).toBeNull();
    }
  });
});

describe("when storage throws", () => {
  it("loads nothing instead of failing", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(loadWorldRecipe("realm_a")).toBeNull();
  });

  it("saves nothing instead of failing", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(() => saveWorldRecipe("realm_a", recipe())).not.toThrow();
  });

  it("clears nothing instead of failing", () => {
    jest.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(() => clearWorldRecipe("realm_a")).not.toThrow();
  });

  it("copes with a browser whose localStorage getter throws", () => {
    jest.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(loadWorldRecipe("realm_a")).toBeNull();
    expect(() => saveWorldRecipe("realm_a", recipe())).not.toThrow();
    expect(() => clearWorldRecipe("realm_a")).not.toThrow();
  });
});

/**
 * The World tab's draft recipe: seed and controls kept in browser storage per realm, so reopening the tab brings the
 * preview back. Storage may be missing, full, blocked or hold anything, and none of that may break the tab.
 */

import { ATLAS_ENGINE_VERSION } from "~/lib/buildVersion";
import { CONTROL_LIMITS, controlsForPreset } from "~/lib/worldgen/world-controls";
import {
  clearWorldJob,
  clearWorldRecipe,
  loadWorldJob,
  loadWorldRecipe,
  saveWorldJob,
  saveWorldRecipe,
  WORLD_RECIPE_VERSION,
  worldJobKey,
  worldRecipeKey,
  type WorldJobRef,
  type WorldRecipe,
} from "~/lib/worldgen/world-draft-recipe";

/** What storage holds for a recipe: the recipe under the current format and engine. */
const stored = (fields: object) =>
  JSON.stringify({ version: WORLD_RECIPE_VERSION, engine: ATLAS_ENGINE_VERSION, ...fields });

const recipe = (): WorldRecipe => ({
  seed: 4242,
  controls: { ...controlsForPreset("eurth"), source: "realm-map", continents: 3 },
});

beforeEach(() => window.localStorage.clear());
afterEach(() => jest.restoreAllMocks());

describe("world draft recipe", () => {
  it("drops a recipe from before versions, or made by another format or generator", () => {
    const key = worldRecipeKey("realm_a");
    const { seed, controls } = recipe();
    for (const raw of [
      JSON.stringify({ seed, controls }),
      JSON.stringify({
        version: WORLD_RECIPE_VERSION + 1,
        engine: ATLAS_ENGINE_VERSION,
        seed,
        controls,
      }),
      JSON.stringify({
        version: WORLD_RECIPE_VERSION,
        engine: `${ATLAS_ENGINE_VERSION}-old`,
        seed,
        controls,
      }),
    ]) {
      window.localStorage.setItem(key, raw);
      expect(loadWorldRecipe("realm_a")).toBeNull();
      expect(window.localStorage.getItem(key)).toBeNull();
    }
  });

  it("drops a recipe that is corrupt, so it is not read again", () => {
    const key = worldRecipeKey("realm_a");
    window.localStorage.setItem(key, "{not json");
    expect(loadWorldRecipe("realm_a")).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });
  it("pulls stored numbers back inside the slider limits", () => {
    window.localStorage.setItem(
      worldRecipeKey("realm_a"),
      stored({ seed: 9, controls: { ...recipe().controls, continents: 99, rainfall: -3 } })
    );
    const loaded = loadWorldRecipe("realm_a");
    expect(loaded?.controls.continents).toBe(CONTROL_LIMITS.continents.max);
    expect(loaded?.controls.rainfall).toBe(CONTROL_LIMITS.rainfall.min);
  });

  it("turns a seed that is not a whole positive number into no recipe", () => {
    for (const seed of [0, -4, 1.5, Number.NaN]) {
      window.localStorage.setItem(
        worldRecipeKey("realm_a"),
        stored({ seed, controls: recipe().controls })
      );
      expect(loadWorldRecipe("realm_a")).toBeNull();
    }
  });
});

describe("the job in flight", () => {
  const job: WorldJobRef = {
    checkJobId: "j_check",
    applyJobId: "j_apply",
    draftKey: '["preset",7]',
  };

  it("is kept per realm, apart from the recipe, so saving the recipe again does not lose it", () => {
    saveWorldJob("realm_a", job);
    saveWorldRecipe("realm_a", recipe());
    expect(loadWorldJob("realm_a")).toEqual(job);
    expect(loadWorldJob("realm_b")).toBeNull();
    expect(worldJobKey("realm_a")).not.toBe(worldRecipeKey("realm_a"));
  });

  it("is not forgotten with the recipe: discarding a draft does not end the job", () => {
    saveWorldJob("realm_a", job);
    saveWorldRecipe("realm_a", recipe());
    clearWorldRecipe("realm_a");
    expect(loadWorldJob("realm_a")).toEqual(job);
  });
  it.each([
    ["text that is not JSON", "{oops"],
    ["no check job", JSON.stringify({ applyJobId: null, draftKey: "k" })],
    [
      "a check job that is not an id",
      JSON.stringify({ checkJobId: 4, applyJobId: null, draftKey: "k" }),
    ],
    ["an empty id", JSON.stringify({ checkJobId: "", applyJobId: null, draftKey: "k" })],
    ["no draft key", JSON.stringify({ checkJobId: "j", applyJobId: null })],
  ])("drops %s, so it is not read again", (_name, raw) => {
    window.localStorage.setItem(worldJobKey("realm_a"), raw);
    expect(loadWorldJob("realm_a")).toBeNull();
    expect(window.localStorage.getItem(worldJobKey("realm_a"))).toBeNull();
  });
});

describe("when storage throws", () => {
  it("loads nothing instead of failing", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(loadWorldRecipe("realm_a")).toBeNull();
  });
  it("copes with a browser whose localStorage getter throws", () => {
    jest.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(loadWorldRecipe("realm_a")).toBeNull();
    expect(() => saveWorldRecipe("realm_a", recipe())).not.toThrow();
    expect(() => clearWorldRecipe("realm_a")).not.toThrow();
    expect(loadWorldJob("realm_a")).toBeNull();
    expect(() =>
      saveWorldJob("realm_a", { checkJobId: "j", applyJobId: null, draftKey: "k" })
    ).not.toThrow();
    expect(() => clearWorldJob("realm_a")).not.toThrow();
  });
});

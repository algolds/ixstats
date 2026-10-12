/**
 * The Studio's saved recipe: kept per admin under `studio:<clerkUserId>`, restored as it was, and dropped when it is
 * from another format or engine, damaged, or out of bounds. Storage that refuses is as good as none.
 */
import { ATLAS_ENGINE_VERSION } from "~/lib/buildVersion";
import { paramsForPreset } from "~/lib/worldgen/studio-fields";
import {
  STUDIO_RECIPE_VERSION,
  clearStudioRecipe,
  loadStudioRecipe,
  saveStudioRecipe,
  studioRecipeKey,
  type StudioRecipe,
} from "~/lib/worldgen/studio-recipe";

const recipe: StudioRecipe = {
  seed: 1234,
  preset: "ixnay",
  mode: "fit",
  fitRealm: "ixnay",
  params: paramsForPreset({ oceanPercentage: 0.771, polarLand: { north: false, south: false } }),
};
const KEY = studioRecipeKey("user_1");
const store = (over: object = {}) =>
  window.localStorage.setItem(
    KEY,
    JSON.stringify({
      version: STUDIO_RECIPE_VERSION,
      engine: ATLAS_ENGINE_VERSION,
      ...recipe,
      ...over,
    })
  );

beforeEach(() => window.localStorage.clear());
afterEach(() => jest.restoreAllMocks());

describe("studio recipe", () => {
  it("is kept under the admin's own key", () => {
    expect(KEY).toBe("studio:user_1");
  });

  it("saves and restores every field", () => {
    saveStudioRecipe("user_1", recipe);
    expect(loadStudioRecipe("user_1")).toEqual(recipe);
    expect(loadStudioRecipe("user_2")).toBeNull();
  });

  it("stamps the format version and the Atlas engine", () => {
    saveStudioRecipe("user_1", recipe);
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toMatchObject({
      version: STUDIO_RECIPE_VERSION,
      engine: ATLAS_ENGINE_VERSION,
    });
  });

  it.each([
    ["an old version", { version: STUDIO_RECIPE_VERSION - 1 }],
    ["a newer version", { version: STUDIO_RECIPE_VERSION + 1 }],
    ["another engine", { engine: "0.0.0-other" }],
    ["a seed of 0", { seed: 0 }],
    ["a parameter out of bounds", { params: { ...recipe.params, cellCount: 5 } }],
    ["a missing parameter", { params: { cellCount: 5000 } }],
  ])("drops %s, and forgets it", (_name, over) => {
    store(over);
    expect(loadStudioRecipe("user_1")).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("keeps no seed among the parameters: the recipe's own seed is the one", () => {
    store({ params: { ...recipe.params, seed: 99 } });
    expect(loadStudioRecipe("user_1")?.params).not.toHaveProperty("seed");
    expect(loadStudioRecipe("user_1")?.seed).toBe(1234);
  });

  it("drops text that is not JSON", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(loadStudioRecipe("user_1")).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("clears the recipe", () => {
    saveStudioRecipe("user_1", recipe);
    clearStudioRecipe("user_1");
    expect(loadStudioRecipe("user_1")).toBeNull();
  });

  describe("when storage refuses", () => {
    it("loads nothing when reading throws", () => {
      jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("denied");
      });
      expect(loadStudioRecipe("user_1")).toBeNull();
    });

    it("saves nothing, quietly, when writing throws", () => {
      jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });
      expect(() => saveStudioRecipe("user_1", recipe)).not.toThrow();
    });

    it("copes when reaching the storage throws", () => {
      jest.spyOn(window, "localStorage", "get").mockImplementation(() => {
        throw new Error("blocked");
      });
      expect(loadStudioRecipe("user_1")).toBeNull();
      expect(() => saveStudioRecipe("user_1", recipe)).not.toThrow();
      expect(() => clearStudioRecipe("user_1")).not.toThrow();
    });
  });
});

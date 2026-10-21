/**
 * The Studio's recipe hook: a fresh start from Earth-like, a saved recipe restored, `?fit=` opening the fit source,
 * commits that change nothing making no new parameters, resets to the chosen preset, and the recipe saved on change.
 */
import { act, renderHook } from "@testing-library/react";

import { useStudioRecipe } from "~/hooks/useStudioRecipe";
import { paramsForPreset } from "~/lib/worldgen/studio-fields";
import { FACTORY_STUDIO_PRESETS, type StudioPreset } from "~/lib/worldgen/studio-presets";
import { saveStudioRecipe, studioRecipeKey } from "~/lib/worldgen/studio-recipe";

const PRESETS: readonly StudioPreset[] = [
  ...FACTORY_STUDIO_PRESETS,
  {
    slug: "badlands",
    name: "Badlands",
    builtIn: false,
    hasDraft: true,
    published: false,
    params: { terrainRoughness: 0.9, plateCount: 20 },
  },
];

const mount = (
  over: { fitParam?: string | null; presets?: readonly StudioPreset[]; persist?: boolean } = {}
) =>
  renderHook(() =>
    useStudioRecipe({
      userId: "user_1",
      presets: over.presets ?? PRESETS,
      fitParam: over.fitParam ?? null,
      persist: over.persist ?? true,
    })
  );

const stored = () => JSON.parse(window.localStorage.getItem(studioRecipeKey("user_1")) ?? "null");

beforeEach(() => window.localStorage.clear());

describe("useStudioRecipe", () => {
  describe("what is written", () => {
    it("writes nothing on mount: opening the Studio, or ?fit=, saves no recipe", () => {
      mount();
      expect(stored()).toBeNull();
      mount({ fitParam: "ixnay" });
      expect(stored()).toBeNull();
    });
    it("writes nothing while the built-in presets stand in, and keeps the saved preset slug", () => {
      saveStudioRecipe("user_1", {
        seed: 5,
        preset: "badlands",
        mode: "preset",
        fitRealm: null,
        params: paramsForPreset({ plateCount: 20 }),
      });
      const { result } = mount({ presets: FACTORY_STUDIO_PRESETS, persist: false });
      expect(result.current.presetSlug).toBe("earthlike");
      act(() => result.current.setParams({ cellCount: 5000 }));
      act(() => result.current.setSeed(99));
      expect(stored()).toMatchObject({ seed: 5, preset: "badlands" });
    });
  });
});

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
  it("starts from Earth-like with a seed of its own, in the preset source", () => {
    const { result } = mount();
    expect(result.current.presetSlug).toBe("earthlike");
    expect(result.current.params).toEqual(paramsForPreset({}));
    expect(result.current.presetParams).toEqual(paramsForPreset({}));
    expect(result.current.mode).toBe("preset");
    expect(Number.isInteger(result.current.seed)).toBe(true);
    expect(result.current.seed).toBeGreaterThanOrEqual(1);
  });

  it("restores the saved recipe, seed and all", () => {
    saveStudioRecipe("user_1", {
      seed: 77,
      preset: "ixnay",
      mode: "preset",
      fitRealm: null,
      params: paramsForPreset({ cellCount: 40000 }),
    });
    const { result } = mount();
    expect(result.current.seed).toBe(77);
    expect(result.current.presetSlug).toBe("ixnay");
    expect(result.current.params.cellCount).toBe(40000);
    // What a reset goes back to is the preset's, not the saved edit
    expect(result.current.presetParams.oceanPercentage).toBe(0.771);
  });

  it("starts a saved recipe whose preset has gone from Earth-like", () => {
    saveStudioRecipe("user_1", {
      seed: 5,
      preset: "archived-one",
      mode: "preset",
      fitRealm: null,
      params: paramsForPreset({}),
    });
    expect(mount().result.current.presetSlug).toBe("earthlike");
  });

  it("opens the fit source on the realm of ?fit=, keeping a saved recipe's parameters", () => {
    saveStudioRecipe("user_1", {
      seed: 5,
      preset: "eurth",
      mode: "preset",
      fitRealm: null,
      params: paramsForPreset({ cellCount: 30000 }),
    });
    const { result } = mount({ fitParam: "eurth" });
    expect(result.current.mode).toBe("fit");
    expect(result.current.fitRealm).toBe("eurth");
    expect(result.current.params.cellCount).toBe(30000);
    expect(mount({ fitParam: "ixnay" }).result.current.fitRealm).toBe("ixnay");
  });

  it("commits a change as new parameters, leaving the rest and the preset's values alone", () => {
    const { result } = mount();
    const before = result.current.params;
    act(() => result.current.setParams({ oceanPercentage: 0.5 }));
    expect(result.current.params).not.toBe(before);
    expect(result.current.params.oceanPercentage).toBe(0.5);
    expect(result.current.params.plateCount).toBe(before.plateCount);
    expect(result.current.presetParams.oceanPercentage).toBe(0.7);
  });

  it("makes no new parameters for a commit that changes nothing", () => {
    const { result } = mount();
    const before = result.current.params;
    act(() => result.current.setParams({ oceanPercentage: before.oceanPercentage }));
    act(() => result.current.setParams({ hypsometry: [...before.hypsometry] }));
    expect(result.current.params).toBe(before);
  });

  it("resets named fields to the preset's values", () => {
    const { result } = mount();
    act(() => result.current.setParams({ oceanPercentage: 0.5, plateCount: 4, cellCount: 5000 }));
    act(() => result.current.resetFields(["oceanPercentage", "plateCount"]));
    expect(result.current.params).toMatchObject({
      oceanPercentage: 0.7,
      plateCount: 10,
      cellCount: 5000,
    });
  });

  it("starts from a draft preset's values when picked, replacing the edits", () => {
    const { result } = mount();
    act(() => result.current.setParams({ cellCount: 5000 }));
    act(() => result.current.pickPreset("badlands"));
    expect(result.current.presetSlug).toBe("badlands");
    expect(result.current.params).toMatchObject({
      terrainRoughness: 0.9,
      plateCount: 20,
      cellCount: 100000,
    });
    expect(result.current.presetParams.plateCount).toBe(20);
  });

  it("ignores a preset that is not in the list", () => {
    const { result } = mount();
    act(() => result.current.pickPreset("nope"));
    expect(result.current.presetSlug).toBe("earthlike");
  });

  it("follows the preset's values when the list changes under it (a draft saved elsewhere)", () => {
    const { result, rerender } = renderHook(
      (props: { presets: readonly StudioPreset[] }) =>
        useStudioRecipe({
          userId: "user_1",
          presets: props.presets,
          fitParam: null,
          persist: true,
        }),
      { initialProps: { presets: PRESETS } }
    );
    act(() => result.current.pickPreset("badlands"));
    rerender({
      presets: PRESETS.map((p) =>
        p.slug === "badlands" ? { ...p, params: { terrainRoughness: 0.1 } } : p
      ),
    });
    expect(result.current.presetParams.terrainRoughness).toBe(0.1);
    // The parameters in use are what they were
    expect(result.current.params.terrainRoughness).toBe(0.9);
  });

  it("sets and rerolls the seed, and does nothing for the seed it has", () => {
    const { result } = mount();
    act(() => result.current.setSeed(4242));
    expect(result.current.seed).toBe(4242);
    act(() => result.current.reroll());
    expect(result.current.seed).not.toBe(4242);
  });

  it("switches source and realm", () => {
    const { result } = mount();
    act(() => result.current.setMode("fit"));
    act(() => result.current.setFitRealm("eurth"));
    expect(result.current).toMatchObject({ mode: "fit", fitRealm: "eurth" });
  });

  it("saves the recipe as it changes", () => {
    const { result } = mount();
    act(() => result.current.setParams({ plateCount: 12 }));
    act(() => result.current.setSeed(31));
    expect(stored()).toMatchObject({ seed: 31, preset: "earthlike", params: { plateCount: 12 } });
  });

  describe("what is written", () => {
    it("writes nothing on mount: opening the Studio, or ?fit=, saves no recipe", () => {
      mount();
      expect(stored()).toBeNull();
      mount({ fitParam: "ixnay" });
      expect(stored()).toBeNull();
    });

    it("writes the first change, ?fit= included", () => {
      const { result } = mount({ fitParam: "ixnay" });
      act(() => result.current.setParams({ plateCount: 12 }));
      expect(stored()).toMatchObject({
        mode: "fit",
        fitRealm: "ixnay",
        params: { plateCount: 12 },
      });
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

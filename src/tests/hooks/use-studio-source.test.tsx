/**
 * The Studio's source as the tabs set it: the kind and the realm, and the preset it names, which is loaded when it is
 * not the one in use.
 */
import { act, renderHook } from "@testing-library/react";

import { useStudioRecipe } from "~/hooks/useStudioRecipe";
import { useStudioSource } from "~/hooks/useStudioSource";
import { FACTORY_STUDIO_PRESETS } from "~/lib/worldgen/studio-presets";

beforeEach(() => window.localStorage.clear());

function setup(fitParam: string | null = null) {
  return renderHook(() => {
    const recipe = useStudioRecipe({
      userId: "user_1",
      presets: FACTORY_STUDIO_PRESETS,
      fitParam,
      persist: true,
    });
    return { recipe, ...useStudioSource(recipe) };
  });
}

describe("useStudioSource", () => {
  it("is the preset source on the preset in use, or the fit source on its realm", () => {
    expect(setup().result.current.source).toEqual({ kind: "preset", preset: "earthlike" });
    expect(setup("eurth").result.current.source).toEqual({
      kind: "fit",
      preset: "earthlike",
      realm: "eurth",
    });
  });

  it("loads the preset a preset source names", () => {
    const { result } = setup();
    act(() => result.current.setSource({ kind: "preset", preset: "ixnay" }));
    expect(result.current.source).toEqual({ kind: "preset", preset: "ixnay" });
    expect(result.current.recipe.params.oceanPercentage).toBe(0.771);
  });

  it("keeps the parameters when it names the preset already in use", () => {
    const { result } = setup();
    act(() => result.current.recipe.setParams({ cellCount: 5000 }));
    act(() => result.current.setSource({ kind: "preset", preset: "earthlike" }));
    expect(result.current.recipe.params.cellCount).toBe(5000);
  });

  it("switches to a realm and to another, and loads the preset a fit names", () => {
    const { result } = setup();
    act(() => result.current.setSource({ kind: "fit", preset: "eurth", realm: "ixnay" }));
    expect(result.current.source).toEqual({ kind: "fit", preset: "eurth", realm: "ixnay" });
    expect(result.current.recipe.params.temperatureOffset).toBe(3);
    act(() => result.current.setSource({ kind: "fit", preset: "eurth", realm: null }));
    expect(result.current.source).toMatchObject({ kind: "fit", realm: "ixnay" });
  });

  it("ignores a preset that does not exist", () => {
    const { result } = setup();
    act(() => result.current.setSource({ kind: "preset", preset: "nope" }));
    expect(result.current.source).toEqual({ kind: "preset", preset: "earthlike" });
  });
});

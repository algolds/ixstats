"use client";

import { useCallback, useMemo } from "react";
import type { StudioRecipeApi } from "~/hooks/useStudioRecipe";
import type { StudioSource } from "~/components/maps/studio/StudioContext";

/**
 * The recipe's source as the context gives it out, and the setter the tabs call. A source names its preset: when that
 * is not the one in use it is loaded (its values replace the parameters), as `pickPreset` does; a preset that does not
 * exist changes nothing. A fit with no realm keeps the realm it had.
 */
export function useStudioSource(recipe: StudioRecipeApi) {
  const { mode, fitRealm, presetSlug, setMode, setFitRealm, pickPreset } = recipe;
  const source = useMemo<StudioSource>(
    () =>
      mode === "fit"
        ? { kind: "fit", preset: presetSlug, realm: fitRealm }
        : { kind: "preset", preset: presetSlug },
    [mode, fitRealm, presetSlug]
  );
  const setSource = useCallback(
    (next: StudioSource) => {
      if (next.preset !== presetSlug) pickPreset(next.preset);
      setMode(next.kind);
      if (next.kind === "fit" && next.realm !== null) setFitRealm(next.realm);
    },
    [presetSlug, pickPreset, setMode, setFitRealm]
  );
  return { source, setSource };
}

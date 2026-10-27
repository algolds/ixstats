"use client";

/**
 * useMapEditorTransforms — multi-feature operations (merge, split, scale, rotate,
 * union/subtract/intersect). Each operation records a single "batch" history
 * entry so one Ctrl+Z undoes the whole operation.
 */

import type { Feature, Polygon, MultiPolygon } from "geojson";
import { point } from "@turf/helpers";
import { centroid } from "@turf/centroid";
import { transformRotate } from "@turf/transform-rotate";
import { transformScale } from "@turf/transform-scale";
import { union } from "@turf/union";
import { difference } from "@turf/difference";
import { intersect } from "@turf/intersect";
import { featureCollection } from "@turf/helpers";
import { splitPolygonByLine, cleanPolygonGeometry } from "~/lib/maps/map-editor-geom";
import type { EditorFeature } from "./editor-types";
import { useFeatureMutations } from "./feature-mutations";
import type { EditorAction, HistoryData, PushableEditorAction } from "./useMapHistory";

type PolyFeature = Feature<Polygon | MultiPolygon>;

interface UseMapEditorTransformsProps {
  countryId?: string;
  allFeatures: EditorFeature[];
  selectedIds: Set<string>;
  clearMultiSelect: () => void;
  invalidateAllMapData: () => void;
  debouncedRefetch: () => void;
  pushAction?: (action: PushableEditorAction) => void;
  setMutationError?: (err: string | null) => void;
  setLastSavedAt?: (date: Date) => void;
}

/** Full snapshot of a feature for re-creation on undo. */
function snapshot(f: EditorFeature): HistoryData {
  return {
    ...f.properties,
    name: f.name,
    coordinates: f.coordinates,
    geometry: f.geometry,
  };
}

function sub(
  type: EditorAction["type"],
  f: { id: string; type: EditorFeature["type"]; name: string },
  previousData?: HistoryData,
  newData?: HistoryData
): EditorAction {
  return {
    type,
    featureType: f.type,
    featureId: f.id,
    description: `${type} ${f.type} "${f.name}"`,
    timestamp: Date.now(),
    previousData,
    newData,
  };
}

/** Runs async tasks with bounded concurrency (keeps bulk ops fast without flooding the API). */
async function runLimited<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++]!;
      await task(item);
    }
  });
  await Promise.all(workers);
}

export function useMapEditorTransforms({
  countryId,
  allFeatures,
  selectedIds,
  clearMultiSelect,
  invalidateAllMapData,
  debouncedRefetch,
  pushAction,
  setMutationError,
  setLastSavedAt,
}: UseMapEditorTransformsProps) {
  const { city, subdivision } = useFeatureMutations();

  const finish = (description: string, subActions: EditorAction[], first?: EditorFeature) => {
    if (subActions.length > 0 && first) {
      pushAction?.({
        type: "batch",
        featureType: first.type,
        featureId: first.id,
        description,
        subActions,
      });
    }
    invalidateAllMapData();
    debouncedRefetch();
    setLastSavedAt?.(new Date());
    setMutationError?.(null);
  };

  const fail = (label: string, e: unknown) => {
    setMutationError?.(e instanceof Error && e.message ? e.message : `Failed to ${label}`);
    invalidateAllMapData();
    debouncedRefetch();
  };

  /**
   * Run a multi-step operation that collects history sub-actions. `work` returns the history
   * description on success; on error what was already applied is recorded as a partial batch.
   */
  const runBatch = async (
    first: EditorFeature | undefined,
    partialDescription: string,
    failLabel: string,
    work: (subActions: EditorAction[]) => Promise<string>
  ): Promise<boolean> => {
    const subActions: EditorAction[] = [];
    try {
      finish(await work(subActions), subActions, first);
      return true;
    } catch (e) {
      finish(partialDescription, subActions, first);
      fail(failLabel, e);
      return false;
    }
  };

  const selectedOfType = (type: EditorFeature["type"], needs?: "coordinates" | "geometry") =>
    allFeatures.filter((f) => selectedIds.has(f.id) && f.type === type && (!needs || f[needs]));

  const populationOf = (f: EditorFeature) => Number(f.properties.population) || 0;

  const mergeSelectedCities = async () => {
    if (!countryId || selectedIds.size < 2) return;
    const citiesToMerge = selectedOfType("city", "coordinates");
    if (citiesToMerge.length < 2) return;

    const baseCity = citiesToMerge[0]!;
    const basePop = populationOf(baseCity);
    const totalPopulation = Math.round(citiesToMerge.reduce((sum, c) => sum + populationOf(c), 0));

    await runBatch(baseCity, "Merged cities (partial)", "merge cities", async (subActions) => {
      await city.update.mutateAsync({
        countryId,
        cityId: baseCity.id,
        population: totalPopulation,
      });
      subActions.push(
        sub("update", baseCity, { population: basePop }, { population: totalPopulation })
      );
      for (const c of citiesToMerge.slice(1)) {
        await city.remove.mutateAsync({ countryId, cityId: c.id });
        subActions.push(sub("delete", c, snapshot(c)));
      }
      clearMultiSelect();
      return `Merged ${citiesToMerge.length} cities into "${baseCity.name}"`;
    });
  };

  const splitCity = async (cityId: string) => {
    if (!countryId) return;
    const target = allFeatures.find((f) => f.id === cityId && f.type === "city");
    if (!target || !target.coordinates) return;

    const name = target.name;
    const [lng, lat] = target.coordinates;
    const totalPop = populationOf(target);
    const halvedPop = Math.round(totalPop / 2);

    await runBatch(target, `Split City "${name}" (partial)`, "split city", async (subActions) => {
      await city.update.mutateAsync({
        countryId,
        cityId,
        name: `${name} A`,
        population: halvedPop,
      });
      subActions.push(
        sub(
          "update",
          target,
          { name, population: totalPop },
          { name: `${name} A`, population: halvedPop }
        )
      );
      const newCity = {
        name: `${name} B`,
        cityType: (target.properties.cityType as string) || "city",
        coordinates: [lng + 0.05, lat + 0.05] as [number, number],
        population: halvedPop,
        subdivisionId: (target.properties.subdivisionId as string | undefined) ?? undefined,
      };
      const res = await city.create.mutateAsync({
        countryId,
        ...newCity,
        isNationalCapital: false,
        isSubdivisionCapital: false,
      });
      subActions.push(
        sub("create", { id: res.id, type: "city", name: newCity.name }, undefined, newCity)
      );
      return `Split City "${name}"`;
    });
  };

  const scaleSelectedCitiesPopulation = async (multiplier: number) => {
    if (!countryId || selectedIds.size === 0) return;
    const cities = selectedOfType("city");

    await runBatch(
      cities[0],
      "Scaled city population (partial)",
      "scale population",
      async (subActions) => {
        await runLimited(cities, 4, async (c) => {
          const cur = populationOf(c);
          const scaled = Math.max(1, Math.round(cur * multiplier));
          await city.update.mutateAsync({ countryId, cityId: c.id, population: scaled });
          subActions.push(sub("update", c, { population: cur }, { population: scaled }));
        });
        return `Scaled population of ${cities.length} cities ×${multiplier}`;
      }
    );
  };

  const rotateSelectedCities = async (angleDeg: number) => {
    if (!countryId || selectedIds.size < 2) return;
    const cities = selectedOfType("city", "coordinates");
    if (cities.length < 2) return;

    const pivot = centroid(featureCollection(cities.map((c) => point(c.coordinates!))));
    await runBatch(cities[0], "Rotated cities (partial)", "rotate cities", async (subActions) => {
      await runLimited(cities, 4, async (c) => {
        const rotated = transformRotate(point(c.coordinates!), angleDeg, { pivot });
        const newCoords = rotated.geometry.coordinates as [number, number];
        await city.update.mutateAsync({ countryId, cityId: c.id, coordinates: newCoords });
        subActions.push(
          sub("update", c, { coordinates: c.coordinates }, { coordinates: newCoords })
        );
      });
      return `Rotated ${cities.length} cities ${angleDeg}°`;
    });
  };

  const pathfinderOperation = async (op: "union" | "subtract" | "intersect") => {
    if (!countryId || selectedIds.size < 2) return;
    const subs = selectedOfType("subdivision", "geometry");
    if (subs.length < 2) return;

    const combine = { union, subtract: difference, intersect }[op];
    const baseSub = subs[0]!;
    let resultGeom: PolyFeature | null = null;

    for (const s of subs) {
      const feat: PolyFeature = {
        type: "Feature",
        geometry: s.geometry as Polygon | MultiPolygon,
        properties: {},
      };
      if (!resultGeom) {
        resultGeom = feat;
        continue;
      }
      try {
        const res = combine(featureCollection([resultGeom, feat]));
        if (res) resultGeom = res as PolyFeature;
      } catch (e) {
        console.warn(`Pathfinder ${op} failed:`, e);
      }
    }

    if (!resultGeom) return;
    const cleaned = cleanPolygonGeometry(resultGeom.geometry);
    if (!cleaned) {
      setMutationError?.(`The ${op} produced an empty shape — nothing was changed.`);
      return;
    }

    await runBatch(baseSub, `Region ${op} (partial)`, `${op} regions`, async (subActions) => {
      await subdivision.update.mutateAsync({
        countryId,
        subdivisionId: baseSub.id,
        geometry: cleaned as unknown as Record<string, unknown>,
      });
      subActions.push(
        sub("update", baseSub, { geometry: baseSub.geometry }, { geometry: cleaned })
      );
      // Union consumes the other regions; subtract/intersect only reshape the first.
      if (op === "union") {
        for (const s of subs.slice(1)) {
          await subdivision.remove.mutateAsync({ countryId, subdivisionId: s.id });
          subActions.push(sub("delete", s, snapshot(s)));
        }
      }
      clearMultiSelect();
      const verb = { union: "Merged", subtract: "Subtracted", intersect: "Intersected" }[op];
      return `${verb} ${subs.length} regions into "${baseSub.name}"`;
    });
  };

  /** Splits a region along a drawn line. Returns true when the split was applied. */
  const executeSplitSubdivision = async (
    subdivisionId: string,
    lineCoords: [number, number][]
  ): Promise<boolean> => {
    if (!countryId) return false;
    if (lineCoords.length < 2) {
      setMutationError?.("Draw a split line with at least two points across the region.");
      return false;
    }
    const s = allFeatures.find((f) => f.id === subdivisionId && f.type === "subdivision");
    if (!s || !s.geometry) return false;

    const pieces = splitPolygonByLine(s.geometry, lineCoords);
    if (!pieces || pieces.length < 2) {
      setMutationError?.("The split line must cross the region completely (edge to edge).");
      return false;
    }
    const p1 = cleanPolygonGeometry(pieces[0]!);
    const p2 = cleanPolygonGeometry(pieces[1]!);
    if (!p1 || !p2) {
      setMutationError?.("The split produced an empty piece — try a different line.");
      return false;
    }

    const type = (s.properties.type as string) || "region";
    const level = Number(s.properties.level) || 1;
    return runBatch(s, `Split Region "${s.name}" (partial)`, "split region", async (subActions) => {
      await subdivision.update.mutateAsync({
        countryId,
        subdivisionId: s.id,
        name: `${s.name} A`,
        geometry: p1 as unknown as Record<string, unknown>,
      });
      subActions.push(
        sub(
          "update",
          s,
          { name: s.name, geometry: s.geometry },
          { name: `${s.name} A`, geometry: p1 }
        )
      );
      const newSub = { name: `${s.name} B`, type, level, geometry: p2 };
      const res = await subdivision.create.mutateAsync({
        countryId,
        ...newSub,
        geometry: p2 as unknown as Record<string, unknown>,
      });
      subActions.push(
        sub("create", { id: res.id, type: "subdivision", name: newSub.name }, undefined, newSub)
      );
      return `Split Region "${s.name}"`;
    });
  };

  const applyGeometryTransformation = async (
    subdivisionId: string,
    transform: { type: "rotate" | "scale"; factor: number; pivot?: [number, number] }
  ) => {
    if (!countryId) return;
    const s = allFeatures.find((f) => f.id === subdivisionId && f.type === "subdivision");
    if (!s || !s.geometry) return;

    const feat: PolyFeature = {
      type: "Feature",
      geometry: s.geometry as Polygon | MultiPolygon,
      properties: {},
    };
    const pivot = transform.pivot ? point(transform.pivot) : undefined;
    const transformed = (
      transform.type === "rotate"
        ? transformRotate(feat, transform.factor, { pivot })
        : transformScale(feat, transform.factor, { origin: pivot })
    ) as PolyFeature;

    if (!transformed?.geometry) return;
    const cleaned = cleanPolygonGeometry(transformed.geometry);
    if (!cleaned) return;

    try {
      await subdivision.update.mutateAsync({
        countryId,
        subdivisionId: s.id,
        geometry: cleaned as unknown as Record<string, unknown>,
      });
      finish(
        `${transform.type === "rotate" ? "Rotated" : "Scaled"} Region "${s.name}"`,
        [sub("update", s, { geometry: s.geometry }, { geometry: cleaned })],
        s
      );
    } catch (e) {
      fail(`${transform.type} region`, e);
    }
  };

  return {
    mergeSelectedCities,
    splitCity,
    scaleSelectedCitiesPopulation,
    rotateSelectedCities,
    mergeSelectedSubdivisions: () => pathfinderOperation("union"),
    pathfinderOperation,
    executeSplitSubdivision,
    applyGeometryTransformation,
  };
}

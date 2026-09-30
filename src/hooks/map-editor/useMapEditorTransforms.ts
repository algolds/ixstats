"use client";

/**
 * useMapEditorTransforms — multi-feature operations (merge, split, scale, rotate,
 * union/subtract/intersect). Each operation records a single "batch" history
 * entry so one Ctrl+Z undoes the whole operation.
 */

import { useCallback } from "react";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import { point } from "@turf/helpers";
import { centroid } from "@turf/centroid";
import { transformRotate } from "@turf/transform-rotate";
import { transformScale } from "@turf/transform-scale";
import { union } from "@turf/union";
import { difference } from "@turf/difference";
import { intersect } from "@turf/intersect";
import { featureCollection } from "@turf/helpers";
import { api } from "~/trpc/react";
import { splitPolygonByLine, cleanPolygonGeometry } from "~/lib/maps/map-editor-geom";
import type { EditorFeature } from "./editor-types";
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
  const updateCity = api.geoFeatures.updateCity.useMutation();
  const createCity = api.geoFeatures.createCity.useMutation();
  const deleteCity = api.geoFeatures.deleteCity.useMutation();
  const updateSubdivision = api.geoFeatures.updateSubdivision.useMutation();
  const createSubdivision = api.geoFeatures.createSubdivision.useMutation();
  const deleteSubdivision = api.geoFeatures.deleteSubdivision.useMutation();

  const finish = useCallback(
    (description: string, subActions: EditorAction[], first?: EditorFeature) => {
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
    },
    [pushAction, invalidateAllMapData, debouncedRefetch, setLastSavedAt, setMutationError]
  );

  const fail = useCallback(
    (label: string, e: unknown) => {
      setMutationError?.(e instanceof Error && e.message ? e.message : `Failed to ${label}`);
      invalidateAllMapData();
      debouncedRefetch();
    },
    [setMutationError, invalidateAllMapData, debouncedRefetch]
  );

  const mergeSelectedCities = useCallback(async () => {
    if (!countryId || selectedIds.size < 2) return;
    const citiesToMerge = allFeatures.filter(
      (f) => selectedIds.has(f.id) && f.type === "city" && f.coordinates
    );
    if (citiesToMerge.length < 2) return;

    const baseCity = citiesToMerge[0]!;
    const basePop = Number(baseCity.properties.population) || 0;
    let totalPopulation = basePop;
    for (let i = 1; i < citiesToMerge.length; i++) {
      totalPopulation += Number(citiesToMerge[i]!.properties.population) || 0;
    }

    const subActions: EditorAction[] = [];
    try {
      await updateCity.mutateAsync({
        countryId,
        cityId: baseCity.id,
        population: Math.round(totalPopulation),
      });
      subActions.push(
        sub(
          "update",
          baseCity,
          { population: basePop },
          { population: Math.round(totalPopulation) }
        )
      );
      for (let i = 1; i < citiesToMerge.length; i++) {
        const c = citiesToMerge[i]!;
        await deleteCity.mutateAsync({ countryId, cityId: c.id });
        subActions.push(sub("delete", c, snapshot(c)));
      }
      clearMultiSelect();
      finish(`Merged ${citiesToMerge.length} cities into "${baseCity.name}"`, subActions, baseCity);
    } catch (e) {
      finish(`Merged cities (partial)`, subActions, baseCity);
      fail("merge cities", e);
    }
  }, [countryId, selectedIds, allFeatures, updateCity, deleteCity, clearMultiSelect, finish, fail]);

  const splitCity = useCallback(
    async (cityId: string) => {
      if (!countryId) return;
      const city = allFeatures.find((f) => f.id === cityId && f.type === "city");
      if (!city || !city.coordinates) return;

      const name = city.name;
      const [lng, lat] = city.coordinates;
      const totalPop = Number(city.properties.population) || 0;
      const halvedPop = Math.round(totalPop / 2);
      const subActions: EditorAction[] = [];
      try {
        await updateCity.mutateAsync({
          countryId,
          cityId,
          name: `${name} A`,
          population: halvedPop,
        });
        subActions.push(
          sub(
            "update",
            city,
            { name, population: totalPop },
            { name: `${name} A`, population: halvedPop }
          )
        );
        const newCity = {
          name: `${name} B`,
          cityType: (city.properties.cityType as string) || "city",
          coordinates: [lng + 0.05, lat + 0.05] as [number, number],
          population: halvedPop,
          subdivisionId: (city.properties.subdivisionId as string | undefined) ?? undefined,
        };
        const res = await createCity.mutateAsync({
          countryId,
          ...newCity,
          isNationalCapital: false,
          isSubdivisionCapital: false,
        });
        subActions.push(
          sub("create", { id: res.id, type: "city", name: newCity.name }, undefined, newCity)
        );
        finish(`Split City "${name}"`, subActions, city);
      } catch (e) {
        finish(`Split City "${name}" (partial)`, subActions, city);
        fail("split city", e);
      }
    },
    [countryId, allFeatures, updateCity, createCity, finish, fail]
  );

  const scaleSelectedCitiesPopulation = useCallback(
    async (multiplier: number) => {
      if (!countryId || selectedIds.size === 0) return;
      const cities = allFeatures.filter((f) => selectedIds.has(f.id) && f.type === "city");
      const subActions: EditorAction[] = [];
      try {
        await runLimited(cities, 4, async (city) => {
          const cur = Number(city.properties.population) || 0;
          const scaled = Math.max(1, Math.round(cur * multiplier));
          await updateCity.mutateAsync({ countryId, cityId: city.id, population: scaled });
          subActions.push(sub("update", city, { population: cur }, { population: scaled }));
        });
        finish(
          `Scaled population of ${cities.length} cities ×${multiplier}`,
          subActions,
          cities[0]
        );
      } catch (e) {
        finish(`Scaled city population (partial)`, subActions, cities[0]);
        fail("scale population", e);
      }
    },
    [countryId, selectedIds, allFeatures, updateCity, finish, fail]
  );

  const rotateSelectedCities = useCallback(
    async (angleDeg: number) => {
      if (!countryId || selectedIds.size < 2) return;
      const cities = allFeatures.filter(
        (f) => selectedIds.has(f.id) && f.type === "city" && f.coordinates
      );
      if (cities.length < 2) return;

      const pivot = centroid(featureCollection(cities.map((c) => point(c.coordinates!))));
      const subActions: EditorAction[] = [];
      try {
        await runLimited(cities, 4, async (city) => {
          const rotated = transformRotate(point(city.coordinates!), angleDeg, { pivot });
          const newCoords = rotated.geometry.coordinates as [number, number];
          await updateCity.mutateAsync({ countryId, cityId: city.id, coordinates: newCoords });
          subActions.push(
            sub("update", city, { coordinates: city.coordinates }, { coordinates: newCoords })
          );
        });
        finish(`Rotated ${cities.length} cities ${angleDeg}°`, subActions, cities[0]);
      } catch (e) {
        finish(`Rotated cities (partial)`, subActions, cities[0]);
        fail("rotate cities", e);
      }
    },
    [countryId, selectedIds, allFeatures, updateCity, finish, fail]
  );

  const pathfinderOperation = useCallback(
    async (op: "union" | "subtract" | "intersect") => {
      if (!countryId || selectedIds.size < 2) return;
      const subs = allFeatures.filter(
        (f) => selectedIds.has(f.id) && f.type === "subdivision" && f.geometry
      );
      if (subs.length < 2) return;

      let resultGeom: PolyFeature | null = null;
      const baseSub = subs[0]!;

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
          const fc = featureCollection([resultGeom, feat]);
          const res =
            op === "union" ? union(fc) : op === "subtract" ? difference(fc) : intersect(fc);
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

      const subActions: EditorAction[] = [];
      try {
        await updateSubdivision.mutateAsync({
          countryId,
          subdivisionId: baseSub.id,
          geometry: cleaned as unknown as Record<string, unknown>,
        });
        subActions.push(
          sub("update", baseSub, { geometry: baseSub.geometry }, { geometry: cleaned })
        );
        // Union consumes the other regions; subtract/intersect only reshape the first.
        if (op === "union") {
          for (let i = 1; i < subs.length; i++) {
            const s = subs[i]!;
            await deleteSubdivision.mutateAsync({ countryId, subdivisionId: s.id });
            subActions.push(sub("delete", s, snapshot(s)));
          }
        }
        clearMultiSelect();
        const verb = op === "union" ? "Merged" : op === "subtract" ? "Subtracted" : "Intersected";
        finish(`${verb} ${subs.length} regions into "${baseSub.name}"`, subActions, baseSub);
      } catch (e) {
        finish(`Region ${op} (partial)`, subActions, baseSub);
        fail(`${op} regions`, e);
      }
    },
    [
      countryId,
      selectedIds,
      allFeatures,
      updateSubdivision,
      deleteSubdivision,
      clearMultiSelect,
      finish,
      fail,
      setMutationError,
    ]
  );

  const mergeSelectedSubdivisions = useCallback(async () => {
    await pathfinderOperation("union");
  }, [pathfinderOperation]);

  /** Splits a region along a drawn line. Returns true when the split was applied. */
  const executeSplitSubdivision = useCallback(
    async (subdivisionId: string, lineCoords: [number, number][]): Promise<boolean> => {
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
      const subActions: EditorAction[] = [];
      try {
        await updateSubdivision.mutateAsync({
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
        const res = await createSubdivision.mutateAsync({
          countryId,
          ...newSub,
          geometry: p2 as unknown as Record<string, unknown>,
        });
        subActions.push(
          sub("create", { id: res.id, type: "subdivision", name: newSub.name }, undefined, newSub)
        );
        finish(`Split Region "${s.name}"`, subActions, s);
        return true;
      } catch (e) {
        finish(`Split Region "${s.name}" (partial)`, subActions, s);
        fail("split region", e);
        return false;
      }
    },
    [countryId, allFeatures, updateSubdivision, createSubdivision, finish, fail, setMutationError]
  );

  const applyGeometryTransformation = useCallback(
    async (
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
      const transformed =
        transform.type === "rotate"
          ? (transformRotate(feat, transform.factor, {
              pivot: transform.pivot ? point(transform.pivot) : undefined,
            }) as PolyFeature)
          : (transformScale(feat, transform.factor, {
              origin: transform.pivot ? point(transform.pivot) : undefined,
            }) as PolyFeature);

      if (!transformed?.geometry) return;
      const cleaned = cleanPolygonGeometry(transformed.geometry);
      if (!cleaned) return;

      try {
        await updateSubdivision.mutateAsync({
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
    },
    [countryId, allFeatures, updateSubdivision, finish, fail]
  );

  return {
    mergeSelectedCities,
    splitCity,
    scaleSelectedCitiesPopulation,
    rotateSelectedCities,
    mergeSelectedSubdivisions,
    pathfinderOperation,
    executeSplitSubdivision,
    applyGeometryTransformation,
  };
}

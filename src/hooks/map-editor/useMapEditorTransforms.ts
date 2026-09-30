"use client";

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

type PolyFeature = Feature<Polygon | MultiPolygon>;

interface UseMapEditorTransformsProps {
  countryId?: string;
  allFeatures: EditorFeature[];
  selectedIds: Set<string>;
  clearMultiSelect: () => void;
  invalidateAllMapData: () => void;
  debouncedRefetch: () => void;
}

export function useMapEditorTransforms({
  countryId,
  allFeatures,
  selectedIds,
  clearMultiSelect,
  invalidateAllMapData,
  debouncedRefetch,
}: UseMapEditorTransformsProps) {
  const updateCity = api.geoFeatures.updateCity.useMutation();
  const createCity = api.geoFeatures.createCity.useMutation();
  const deleteCity = api.geoFeatures.deleteCity.useMutation();
  const updateSubdivision = api.geoFeatures.updateSubdivision.useMutation();
  const createSubdivision = api.geoFeatures.createSubdivision.useMutation();
  const deleteSubdivision = api.geoFeatures.deleteSubdivision.useMutation();

  const mergeSelectedCities = useCallback(async () => {
    if (!countryId || selectedIds.size < 2) return;

    const citiesToMerge = allFeatures.filter(
      (f) => selectedIds.has(f.id) && f.type === "city" && f.coordinates
    );

    if (citiesToMerge.length < 2) return;

    const baseCity = citiesToMerge[0]!;
    let totalPopulation = Number(baseCity.properties.population) || 0;
    for (let i = 1; i < citiesToMerge.length; i++) {
      totalPopulation += Number(citiesToMerge[i]!.properties.population) || 0;
    }

    await updateCity.mutateAsync({
      countryId,
      cityId: baseCity.id,
      name: baseCity.name,
      cityType: baseCity.properties.cityType as string,
      coordinates: baseCity.coordinates!,
      population: totalPopulation,
      isNationalCapital: !!baseCity.properties.isNationalCapital,
      isSubdivisionCapital: !!baseCity.properties.isSubdivisionCapital,
    });

    for (let i = 1; i < citiesToMerge.length; i++) {
      await deleteCity.mutateAsync({
        countryId,
        cityId: citiesToMerge[i]!.id,
      });
    }

    clearMultiSelect();
    invalidateAllMapData();
    debouncedRefetch();
  }, [
    countryId,
    selectedIds,
    allFeatures,
    updateCity,
    deleteCity,
    clearMultiSelect,
    invalidateAllMapData,
    debouncedRefetch,
  ]);

  const splitCity = useCallback(
    async (cityId: string) => {
      if (!countryId) return;
      const city = allFeatures.find((f) => f.id === cityId && f.type === "city");
      if (!city || !city.coordinates) return;

      const name = city.name;
      const [lng, lat] = city.coordinates;
      const totalPop = Number(city.properties.population) || 0;
      const halvedPop = Math.round(totalPop / 2);

      await updateCity.mutateAsync({
        countryId,
        cityId,
        name: `${name} A`,
        cityType: city.properties.cityType as string,
        coordinates: [lng, lat],
        population: halvedPop,
        isNationalCapital: !!city.properties.isNationalCapital,
        isSubdivisionCapital: !!city.properties.isSubdivisionCapital,
      });

      await createCity.mutateAsync({
        countryId,
        name: `${name} B`,
        cityType: city.properties.cityType as string,
        coordinates: [lng + 0.05, lat + 0.05],
        population: halvedPop,
        isNationalCapital: false,
        isSubdivisionCapital: false,
        subdivisionId: city.properties.subdivisionId as string | undefined,
      });

      invalidateAllMapData();
      debouncedRefetch();
    },
    [countryId, allFeatures, updateCity, createCity, invalidateAllMapData, debouncedRefetch]
  );

  const scaleSelectedCitiesPopulation = useCallback(
    async (multiplier: number) => {
      if (!countryId || selectedIds.size === 0) return;
      const cities = allFeatures.filter((f) => selectedIds.has(f.id) && f.type === "city");
      for (const city of cities) {
        const cur = Number(city.properties.population) || 0;
        const scaled = Math.max(1, Math.round(cur * multiplier));
        await updateCity.mutateAsync({
          countryId,
          cityId: city.id,
          name: city.name,
          cityType: city.properties.cityType as string,
          coordinates: city.coordinates!,
          population: scaled,
          isNationalCapital: !!city.properties.isNationalCapital,
          isSubdivisionCapital: !!city.properties.isSubdivisionCapital,
        });
      }
      invalidateAllMapData();
      debouncedRefetch();
    },
    [countryId, selectedIds, allFeatures, updateCity, invalidateAllMapData, debouncedRefetch]
  );

  const rotateSelectedCities = useCallback(
    async (angleDeg: number) => {
      if (!countryId || selectedIds.size < 2) return;
      const cities = allFeatures.filter(
        (f) => selectedIds.has(f.id) && f.type === "city" && f.coordinates
      );
      if (cities.length < 2) return;

      const pts = cities.map((c) => point(c.coordinates!));
      const fc = featureCollection(pts);
      const pivot = centroid(fc);

      for (const city of cities) {
        const pt = point(city.coordinates!);
        const rotated = transformRotate(pt, angleDeg, { pivot });
        const newCoords = rotated.geometry.coordinates as [number, number];

        await updateCity.mutateAsync({
          countryId,
          cityId: city.id,
          name: city.name,
          cityType: city.properties.cityType as string,
          coordinates: newCoords,
          population: city.properties.population ? Number(city.properties.population) : undefined,
          isNationalCapital: !!city.properties.isNationalCapital,
          isSubdivisionCapital: !!city.properties.isSubdivisionCapital,
        });
      }
      invalidateAllMapData();
      debouncedRefetch();
    },
    [countryId, selectedIds, allFeatures, updateCity, invalidateAllMapData, debouncedRefetch]
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

      for (let i = 0; i < subs.length; i++) {
        const sub = subs[i]!;
        const feat: PolyFeature = {
          type: "Feature",
          geometry: sub.geometry as Polygon | MultiPolygon,
          properties: {},
        };
        if (!resultGeom) {
          resultGeom = feat;
        } else {
          try {
            if (op === "union") {
              const res = union(featureCollection([resultGeom, feat]));
              if (res) resultGeom = res as PolyFeature;
            } else if (op === "subtract") {
              const res = difference(featureCollection([resultGeom, feat]));
              if (res) resultGeom = res as PolyFeature;
            } else if (op === "intersect") {
              const res = intersect(featureCollection([resultGeom, feat]));
              if (res) resultGeom = res as PolyFeature;
            }
          } catch (e) {
            console.warn(`Pathfinder ${op} failed:`, e);
          }
        }
      }

      if (!resultGeom) return;

      const cleaned = cleanPolygonGeometry(resultGeom.geometry);
      if (!cleaned) return;

      await updateSubdivision.mutateAsync({
        countryId,
        subdivisionId: baseSub.id,
        name: baseSub.name,
        geometry: cleaned,
        type: baseSub.properties.type as string,
        level: Number(baseSub.properties.level) || 1,
      });

      for (let i = 1; i < subs.length; i++) {
        await deleteSubdivision.mutateAsync({
          countryId,
          subdivisionId: subs[i]!.id,
        });
      }

      clearMultiSelect();
      invalidateAllMapData();
      debouncedRefetch();
    },
    [
      countryId,
      selectedIds,
      allFeatures,
      updateSubdivision,
      deleteSubdivision,
      clearMultiSelect,
      invalidateAllMapData,
      debouncedRefetch,
    ]
  );

  const mergeSelectedSubdivisions = useCallback(async () => {
    await pathfinderOperation("union");
  }, [pathfinderOperation]);

  const executeSplitSubdivision = useCallback(
    async (subdivisionId: string, lineCoords: [number, number][]) => {
      if (!countryId || lineCoords.length < 2) return;
      const sub = allFeatures.find((f) => f.id === subdivisionId && f.type === "subdivision");
      if (!sub || !sub.geometry) return;

      const pieces = splitPolygonByLine(sub.geometry, lineCoords);
      if (!pieces || pieces.length < 2) return;

      const p1 = cleanPolygonGeometry(pieces[0]!);
      const p2 = cleanPolygonGeometry(pieces[1]!);
      if (!p1 || !p2) return;

      await updateSubdivision.mutateAsync({
        countryId,
        subdivisionId: sub.id,
        name: `${sub.name} North`,
        geometry: p1,
        type: sub.properties.type as string,
        level: Number(sub.properties.level) || 1,
      });

      await createSubdivision.mutateAsync({
        countryId,
        name: `${sub.name} South`,
        geometry: p2,
        type: sub.properties.type as string,
        level: Number(sub.properties.level) || 1,
      });

      invalidateAllMapData();
      debouncedRefetch();
    },
    [
      countryId,
      allFeatures,
      updateSubdivision,
      createSubdivision,
      invalidateAllMapData,
      debouncedRefetch,
    ]
  );

  const applyGeometryTransformation = useCallback(
    async (
      subdivisionId: string,
      transform: { type: "rotate" | "scale"; factor: number; pivot?: [number, number] }
    ) => {
      if (!countryId) return;
      const sub = allFeatures.find((f) => f.id === subdivisionId && f.type === "subdivision");
      if (!sub || !sub.geometry) return;

      const feat: PolyFeature = {
        type: "Feature",
        geometry: sub.geometry as Polygon | MultiPolygon,
        properties: {},
      };
      let transformed: PolyFeature | null = null;

      if (transform.type === "rotate") {
        transformed = transformRotate(feat, transform.factor, {
          pivot: transform.pivot ? point(transform.pivot) : undefined,
        }) as PolyFeature;
      } else if (transform.type === "scale") {
        transformed = transformScale(feat, transform.factor, {
          origin: transform.pivot ? point(transform.pivot) : undefined,
        }) as PolyFeature;
      }

      if (!transformed?.geometry) return;
      const cleaned = cleanPolygonGeometry(transformed.geometry);
      if (!cleaned) return;

      await updateSubdivision.mutateAsync({
        countryId,
        subdivisionId: sub.id,
        name: sub.name,
        geometry: cleaned,
        type: sub.properties.type as string,
        level: Number(sub.properties.level) || 1,
      });

      invalidateAllMapData();
      debouncedRefetch();
    },
    [countryId, allFeatures, updateSubdivision, invalidateAllMapData, debouncedRefetch]
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

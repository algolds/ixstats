"use client";

import { useState, useCallback } from "react";
import { api } from "~/trpc/react";
import type { Polygon, MultiPolygon, Position } from "geojson";
// oxlint-disable-next-line eslint/no-unused-vars
import { featureCollection } from "@turf/helpers";
// oxlint-disable-next-line eslint/no-unused-vars
import { area } from "@turf/area";
import { bezierSpline } from "@turf/bezier-spline";
import type {
  EditorFeature,
  SubdivisionFormData,
} from "./editor-types";
import type { useMapHistory } from "./useMapHistory";

interface UseSubdivisionEditorProps {
  countryId?: string;
  isWorldMode?: boolean;
  history: ReturnType<typeof useMapHistory>;
  refetchFeatures: () => void;
}

export function useSubdivisionEditor({
  // oxlint-disable-next-line eslint/no-unused-vars
  countryId,
  // oxlint-disable-next-line eslint/no-unused-vars
  isWorldMode,
  // oxlint-disable-next-line eslint/no-unused-vars
  history,
  // oxlint-disable-next-line eslint/no-unused-vars
  refetchFeatures,
}: UseSubdivisionEditorProps) {
  const [subdivisionForm, setSubdivisionForm] = useState<SubdivisionFormData>({
    name: "",
    type: "province",
    level: 1,
  });

  const [drawCoordinates, setDrawCoordinates] = useState<[number, number][]>([]);
  const [lassoGeometry, setLassoGeometry] = useState<Polygon | null>(null);

  const upsertSubdivisionMut = api.countryGeo.upsertSubdivision.useMutation();
  const deleteSubdivisionMut = api.geoFeatures.deleteSubdivision.useMutation();

  const isMutating = upsertSubdivisionMut.isPending || deleteSubdivisionMut.isPending;

  const resetSubdivisionForm = useCallback(() => {
    setSubdivisionForm({ name: "", type: "province", level: 1 });
    setDrawCoordinates([]);
    setLassoGeometry(null);
  }, []);

  const populateSubdivisionForm = useCallback((feature: EditorFeature) => {
    const p = feature.properties ?? {};
    setSubdivisionForm({
      name: feature.name,
      type: p.type ?? "province",
      level: p.level ?? 1,
      capital: p.capital,
      population: p.population,
      areaSqKm: p.areaSqKm,
      color: p.color,
      wikiPageTitle: p.wikiPageTitle,
      geometry: feature.geometry,
    });
  }, []);

  const smoothPolygonGeometry = useCallback((geom: Polygon | MultiPolygon): Polygon | MultiPolygon => {
    try {
      if (geom.type === "Polygon") {
        const line = { type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: geom.coordinates[0]! }, properties: {} };
        const smoothed = bezierSpline(line);
        return {
          type: "Polygon",
          coordinates: [smoothed.geometry.coordinates as Position[]],
        };
      }
      return geom;
    } catch {
      return geom;
    }
  }, []);

  return {
    subdivisionForm,
    setSubdivisionForm,
    drawCoordinates,
    setDrawCoordinates,
    lassoGeometry,
    setLassoGeometry,
    isMutating,
    resetSubdivisionForm,
    populateSubdivisionForm,
    smoothPolygonGeometry,
    upsertSubdivisionMut,
    deleteSubdivisionMut,
  };
}

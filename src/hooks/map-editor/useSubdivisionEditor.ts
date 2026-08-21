"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "~/trpc/react";
import type { Polygon, MultiPolygon, Position } from "geojson";
import { union } from "@turf/union";
import { difference } from "@turf/difference";
import { intersect } from "@turf/intersect";
import { featureCollection } from "@turf/helpers";
import { simplify } from "@turf/simplify";
import { bbox } from "@turf/bbox";
import { centroid } from "@turf/centroid";
import { area } from "@turf/area";
import { buffer } from "@turf/buffer";
import { bezierSpline } from "@turf/bezier-spline";
import { transformRotate } from "@turf/transform-rotate";
import { transformScale } from "@turf/transform-scale";
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
  countryId,
  isWorldMode,
  history,
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

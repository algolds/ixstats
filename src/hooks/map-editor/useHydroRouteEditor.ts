"use client";

import { useState, useCallback } from "react";
import { api } from "~/trpc/react";
import type {
  EditorFeature,
  NamedRiverFormData,
  NamedLakeFormData,
} from "./editor-types";
import { traceDownhillRiver } from "~/lib/maps/hydro-downhill-tracer";

interface UseHydroRouteEditorProps {
  countryId?: string;
  isWorldMode?: boolean;
  refetchFeatures: () => void;
}

export function useHydroRouteEditor({
  // oxlint-disable-next-line eslint/no-unused-vars
  countryId,
  // oxlint-disable-next-line eslint/no-unused-vars
  isWorldMode,
  // oxlint-disable-next-line eslint/no-unused-vars
  refetchFeatures,
}: UseHydroRouteEditorProps) {
  const [riverForm, setRiverForm] = useState<NamedRiverFormData>({
    name: "",
  });

  const [lakeForm, setLakeForm] = useState<NamedLakeFormData>({
    name: "",
    waterType: "freshwater",
  });

  const [routeWaypoints, setRouteWaypoints] = useState<[number, number][]>([]);

  const upsertRiverMut = api.geoFeatures.createNamedRiver.useMutation();
  const deleteRiverMut = api.geoFeatures.deleteNamedRiver.useMutation();
  const upsertLakeMut = api.geoFeatures.createNamedLake.useMutation();
  const deleteLakeMut = api.geoFeatures.deleteNamedLake.useMutation();

  const isMutating =
    upsertRiverMut.isPending ||
    deleteRiverMut.isPending ||
    upsertLakeMut.isPending ||
    deleteLakeMut.isPending;

  const resetHydroForms = useCallback(() => {
    setRiverForm({ name: "" });
    setLakeForm({ name: "", waterType: "freshwater" });
    setRouteWaypoints([]);
  }, []);

  const populateHydroForm = useCallback((feature: EditorFeature) => {
    const p = feature.properties ?? {};
    if (feature.type === "river") {
      setRiverForm({
        name: feature.name,
        wikiPageTitle: p.wikiPageTitle,
        geometry: feature.geometry,
      });
    } else if (feature.type === "lake") {
      setLakeForm({
        name: feature.name,
        waterType: p.waterType ?? "freshwater",
        wikiPageTitle: p.wikiPageTitle,
        geometry: feature.geometry,
      });
    }
  }, []);

  const addRouteWaypoint = useCallback((coord: [number, number]) => {
    setRouteWaypoints((prev) => [...prev, coord]);
  }, []);

  const undoLastWaypoint = useCallback(() => {
    setRouteWaypoints((prev) => prev.slice(0, -1));
  }, []);

  const clearRouteWaypoints = useCallback(() => {
    setRouteWaypoints([]);
  }, []);

  const traceRiverFromPoint = useCallback(
    (startCoord: [number, number], sampleElevation?: (lng: number, lat: number) => number) => {
      return traceDownhillRiver(startCoord, sampleElevation, {
        maxSteps: 80,
        stepDeg: 0.05,
        meanderFactor: 1.0,
      });
    },
    []
  );

  return {
    riverForm,
    setRiverForm,
    lakeForm,
    setLakeForm,
    routeWaypoints,
    setRouteWaypoints,
    addRouteWaypoint,
    undoLastWaypoint,
    clearRouteWaypoints,
    traceRiverFromPoint,
    isMutating,
    resetHydroForms,
    populateHydroForm,
    upsertRiverMut,
    deleteRiverMut,
    upsertLakeMut,
    deleteLakeMut,
  };
}

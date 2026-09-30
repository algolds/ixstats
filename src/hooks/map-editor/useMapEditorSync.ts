"use client";

import { useMemo, useCallback } from "react";
import { api } from "~/trpc/react";
import { debounce } from "~/lib/utils";
import type { EditorFeature } from "./editor-types";

interface UseMapEditorSyncProps {
  countryId?: string;
  skipLinkageGate?: boolean;
}

export function useMapEditorSync({ countryId, skipLinkageGate = false }: UseMapEditorSyncProps) {
  const utils = api.useUtils();

  // Queries
  const {
    data: countryGeo,
    isLoading: geometryLoading,
    refetch: refetchCountryGeo,
  } = api.geoCore.getCountryGeometry.useQuery({ countryId: countryId! }, { enabled: !!countryId });

  const {
    data: features,
    isLoading: featuresLoading,
    refetch: refetchGeoFeatures,
  } = api.geoCore.getCountryFeatures.useQuery({ countryId: countryId! }, { enabled: !!countryId });

  const {
    data: linkage,
    isLoading: linkageLoading,
    refetch: refetchCountryLinkage,
  } = api.geoCore.getCountryLinkage.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId && !skipLinkageGate }
  );

  const {
    data: routes,
    isLoading: routesLoading,
    refetch: refetchRoutes,
  } = api.transport.getCountryRoutes.useQuery({ countryId: countryId! }, { enabled: !!countryId });

  // Invalidation & Refetch
  const invalidateAllMapData = useCallback(() => {
    if (!countryId) return;
    void utils.geoCore.getCountryFeatures.invalidate({ countryId });
    void utils.transport.getCountryRoutes.invalidate({ countryId });
    void utils.geoCore.getCountryGeometry.invalidate({ countryId });
    void utils.geoCore.getCountryLinkage.invalidate({ countryId });
  }, [countryId, utils]);

  const refetchFeatures = useCallback(() => {
    void refetchGeoFeatures();
    void refetchRoutes();
    void refetchCountryGeo();
    void refetchCountryLinkage();
  }, [refetchGeoFeatures, refetchRoutes, refetchCountryGeo, refetchCountryLinkage]);

  const debouncedRefetch = useMemo(() => debounce(refetchFeatures, 200), [refetchFeatures]);

  // Aggregate All Features
  const allFeatures: EditorFeature[] = useMemo(() => {
    if (!features) return [];
    const list: EditorFeature[] = [];

    features.cities?.forEach((c) => {
      list.push({
        id: c.id,
        type: "city",
        name: c.name,
        coordinates: (c.coordinates as [number, number]) || undefined,
        properties: c as Record<string, string | number | boolean | null | undefined | object>,
      });
    });

    features.subdivisions?.forEach((s) => {
      list.push({
        id: s.id,
        type: "subdivision",
        name: s.name,
        geometry: (s.geometry as object) || undefined,
        properties: s as Record<string, string | number | boolean | null | undefined | object>,
      });
    });

    features.pois?.forEach((p) => {
      list.push({
        id: p.id,
        type: "poi",
        name: p.name,
        coordinates: (p.coordinates as [number, number]) || undefined,
        properties: p as Record<string, string | number | boolean | null | undefined | object>,
      });
    });

    features.storyPins?.forEach((sp) => {
      list.push({
        id: sp.id,
        type: "storyPin",
        name: sp.title,
        coordinates: (sp.coordinates as [number, number]) || undefined,
        properties: sp as Record<string, string | number | boolean | null | undefined | object>,
      });
    });

    features.mapLabels?.forEach((ml) => {
      list.push({
        id: ml.id,
        type: "mapLabel",
        name: ml.text,
        coordinates: (ml.coordinates as [number, number]) || undefined,
        properties: ml as Record<string, string | number | boolean | null | undefined | object>,
      });
    });

    features.peaks?.forEach((pk) => {
      list.push({
        id: pk.id,
        type: "peak",
        name: pk.name,
        coordinates: (pk.coordinates as [number, number]) || undefined,
        properties: pk as Record<string, string | number | boolean | null | undefined | object>,
      });
    });

    features.namedRivers?.forEach((r) => {
      list.push({
        id: r.id,
        type: "river",
        name: r.name,
        geometry: (r.geometry as object) || undefined,
        properties: r as Record<string, string | number | boolean | null | undefined | object>,
      });
    });

    features.namedLakes?.forEach((l) => {
      list.push({
        id: l.id,
        type: "lake",
        name: l.name,
        geometry: (l.geometry as object) || undefined,
        properties: l as Record<string, string | number | boolean | null | undefined | object>,
      });
    });

    (routes?.features || []).forEach((f) => {
      list.push({
        id: f.properties.id,
        type: "route",
        name: f.properties.name || "Route",
        geometry: f.geometry || undefined,
        properties: f.properties as Record<string, string | number | boolean | null | undefined | object>,
      });
    });

    return list;
  }, [features, routes]);

  return {
    countryGeo,
    geometryLoading,
    linkage,
    linkageLoading,
    features,
    featuresLoading: featuresLoading || routesLoading,
    routes,
    routesLoading,
    allFeatures,
    refetchFeatures,
    debouncedRefetch,
    invalidateAllMapData,
  };
}

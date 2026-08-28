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

    (features.cities || []).forEach((c: any) => {
      list.push({
        id: c.id,
        type: "city",
        name: c.name,
        coordinates: (c.coordinates as [number, number]) || undefined,
        properties: c,
      });
    });

    (features.subdivisions || []).forEach((s: any) => {
      list.push({
        id: s.id,
        type: "subdivision",
        name: s.name,
        geometry: (s.geometry as object) || undefined,
        properties: s,
      });
    });

    (features.pois || []).forEach((p: any) => {
      list.push({
        id: p.id,
        type: "poi",
        name: p.name,
        coordinates: (p.coordinates as [number, number]) || undefined,
        properties: p,
      });
    });

    (features.storyPins || []).forEach((sp: any) => {
      list.push({
        id: sp.id,
        type: "storyPin",
        name: sp.title,
        coordinates: (sp.coordinates as [number, number]) || undefined,
        properties: sp,
      });
    });

    (features.mapLabels || []).forEach((ml: any) => {
      list.push({
        id: ml.id,
        type: "mapLabel",
        name: ml.text,
        coordinates: (ml.coordinates as [number, number]) || undefined,
        properties: ml,
      });
    });

    (features.peaks || []).forEach((pk: any) => {
      list.push({
        id: pk.id,
        type: "peak",
        name: pk.name,
        coordinates: (pk.coordinates as [number, number]) || undefined,
        properties: pk,
      });
    });

    (features.namedRivers || []).forEach((r: any) => {
      list.push({
        id: r.id,
        type: "river",
        name: r.name,
        geometry: (r.geometry as object) || undefined,
        properties: r,
      });
    });

    (features.namedLakes || []).forEach((l: any) => {
      list.push({
        id: l.id,
        type: "lake",
        name: l.name,
        geometry: (l.geometry as object) || undefined,
        properties: l,
      });
    });

    (((routes as any)?.features as any[]) || []).forEach((f: any) => {
      list.push({
        id: f.properties?.id || f.id,
        type: "route",
        name: f.properties?.name || f.name || "Route",
        geometry: f.geometry || undefined,
        properties: f.properties || f,
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

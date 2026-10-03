"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { api } from "~/trpc/react";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import type { useMapRealm } from "~/components/maps/core/MapRealmContext";
import { notifyFromStore } from "~/hooks/useNotify";
import { invalidateMapViews, notifyFailure, notifySuccess } from "./geo-invalidation";

interface Props {
  mapSelectedCountry: SelectedCountry | null;
  realm: ReturnType<typeof useMapRealm>;
  refetchValidation: () => unknown;
}

/** Inline-editable properties (name, linkage, wiki title, JSON) of the selected map shape. */
export function useEditorFeatureProperties({
  mapSelectedCountry,
  realm,
  refetchValidation,
}: Props) {
  const utils = api.useUtils();

  const [editableFeatureName, setEditableFeatureName] = useState("");
  const [editableCountryLinkageId, setEditableCountryLinkageId] = useState("");
  const [wikiPageTitle, setWikiPageTitle] = useState("");
  const [propertiesJsonString, setPropertiesJsonString] = useState("");
  const [isEditingJson, setIsEditingJson] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const parsedProperties = useMemo(() => {
    try {
      return propertiesJsonString ? JSON.parse(propertiesJsonString) : {};
    } catch {
      return {};
    }
  }, [propertiesJsonString]);

  const { data: featureDetails, refetch: refetchFeatureDetails } =
    api.geoEditor.getFeatureDetails.useQuery(
      { featureId: mapSelectedCountry?.featureId ?? "", realm },
      { enabled: !!mapSelectedCountry?.featureId }
    );

  const recalculateAreaMutation = api.geoCore.recalculateArea.useMutation({
    onSuccess: () => {
      refetchFeatureDetails();
      notifyFromStore(notifySuccess("Area recalculated"));
    },
    onError: (err) => notifyFromStore(notifyFailure("Area recalculation failed", err.message)),
  });

  const updatePropertiesMutation = api.geoEditor.updateFeatureProperties.useMutation({
    onSuccess: () => {
      invalidateMapViews(utils, { list: true, stats: true });
      refetchValidation();
      notifyFromStore(notifySuccess("Feature properties saved"));
    },
    onError: (err) =>
      notifyFromStore(notifyFailure("Could not save feature properties", err.message)),
  });

  const createCountryFromShapeMutation = api.geoEditor.createCountryFromShape.useMutation({
    onSuccess: () => {
      invalidateMapViews(utils, { list: true });
      refetchValidation();
    },
    onError: (err) => notifyFromStore(notifyFailure("Could not create country", err.message)),
  });

  const createCountryFromShapeAction = useCallback(
    (name: string) => {
      if (!mapSelectedCountry?.featureId) return;
      createCountryFromShapeMutation.mutate({
        featureId: mapSelectedCountry.featureId,
        name,
        realm,
      });
    },
    [mapSelectedCountry, createCountryFromShapeMutation, realm]
  );

  useEffect(() => {
    setWikiPageTitle(featureDetails?.wikiPageTitle ?? "");
    setPropertiesJsonString(
      featureDetails ? JSON.stringify(featureDetails.properties ?? {}, null, 2) : ""
    );
    setIsEditingJson(false);
    setJsonError(null);
  }, [featureDetails]);

  useEffect(() => {
    setEditableFeatureName(mapSelectedCountry?.displayName || "");
    setEditableCountryLinkageId(mapSelectedCountry?.countryId || "");
  }, [mapSelectedCountry]);

  const handleSaveFeatureProperties = () => {
    if (!mapSelectedCountry?.featureId) return;
    updatePropertiesMutation.mutate(
      {
        featureId: mapSelectedCountry.featureId,
        displayName: editableFeatureName || undefined,
        countryId: editableCountryLinkageId || null,
        properties: parsedProperties,
        wikiPageTitle: wikiPageTitle || null,
        realm,
      },
      {
        onSuccess: () => {
          refetchFeatureDetails();
          setIsEditingJson(false);
        },
      }
    );
  };

  return {
    editableFeatureName,
    setEditableFeatureName,
    editableCountryLinkageId,
    setEditableCountryLinkageId,
    wikiPageTitle,
    setWikiPageTitle,
    propertiesJsonString,
    setPropertiesJsonString,
    isEditingJson,
    setIsEditingJson,
    jsonError,
    setJsonError,
    parsedProperties,
    featureDetails,
    refetchFeatureDetails,
    recalculateAreaMutation,
    updatePropertiesMutation,
    createCountryFromShapeAction,
    createCountryFromShapeMutation,
    handleSaveFeatureProperties,
  };
}

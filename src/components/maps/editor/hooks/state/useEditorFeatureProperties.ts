"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
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

  // What the editable fields were last loaded with, to tell unsaved edits from a plain refetch.
  const syncedRef = useRef({ featureId: "", wikiPageTitle: "", json: "" });
  const draftRef = useRef({ wikiPageTitle, json: propertiesJsonString });
  // oxlint-disable-next-line -- latest-value ref read by the details effect
  draftRef.current = { wikiPageTitle, json: propertiesJsonString };

  // Reload from the server when another feature is selected or nothing was edited; a refetch of
  // the same feature must not wipe in-progress edits.
  useEffect(() => {
    const incoming = {
      featureId: mapSelectedCountry?.featureId ?? "",
      wikiPageTitle: featureDetails?.wikiPageTitle ?? "",
      json: featureDetails ? JSON.stringify(featureDetails.properties ?? {}, null, 2) : "",
    };
    const synced = syncedRef.current;
    const hasUnsavedEdits =
      draftRef.current.wikiPageTitle !== synced.wikiPageTitle ||
      draftRef.current.json !== synced.json;
    if (incoming.featureId === synced.featureId && hasUnsavedEdits) return;

    syncedRef.current = incoming;
    setWikiPageTitle(incoming.wikiPageTitle);
    setPropertiesJsonString(incoming.json);
    setIsEditingJson(false);
    setJsonError(null);
    // oxlint-disable-next-line -- keyed on the loaded details; the selection id is read at that time
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

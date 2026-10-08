"use client";

import { useState, useMemo } from "react";
import { useMapRealm } from "~/components/maps/core/MapRealmContext";
import { api } from "~/trpc/react";
import { confirmEditorAction } from "~/components/maps/editor/components/EditorConfirmDialog";
import type {
  SovereigntyRelation,
  SovereigntyFormData,
} from "~/components/maps/editor/types/editor-state";
import { invalidateMapViews } from "./geo-invalidation";

const EMPTY_SOVEREIGNTY_FORM: SovereigntyFormData = {
  sovereignId: "",
  subjectId: "",
  relationshipType: "crown_possession",
  autonomyLevel: 50,
  description: "",
  establishedDate: "",
};

const includesText = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.toLowerCase());

/** Sovereignty relations: list, filters, the create/edit form and its mutations. */
export function useEditorSovereigntyState({
  isWorldMode,
  activeCountryId,
}: {
  isWorldMode: boolean;
  activeCountryId: string | null;
}) {
  const utils = api.useUtils();
  const realm = useMapRealm();

  const { data: relations, isLoading: relationsLoading } =
    api.geoSovereignty.getSovereigntyRelations.useQuery({ realm }, { enabled: isWorldMode });

  const [sovereigntySearch, setSovereigntySearch] = useState("");
  const [sovereigntyTypeFilter, setSovereigntyTypeFilter] = useState("all");
  const [showSovereigntyForm, setShowSovereigntyForm] = useState(false);
  const [editingSovereigntyId, setEditingSovereigntyId] = useState<string | null>(null);
  const [sovereigntyForm, setSovereigntyForm] =
    useState<SovereigntyFormData>(EMPTY_SOVEREIGNTY_FORM);

  const resetSovereigntyForm = () => {
    setShowSovereigntyForm(false);
    setEditingSovereigntyId(null);
    setSovereigntyForm(EMPTY_SOVEREIGNTY_FORM);
  };

  const refreshAfterChange = (stats: boolean) => {
    utils.geoSovereignty.getSovereigntyRelations.invalidate();
    invalidateMapViews(utils, { stats });
  };

  const createSovereignty = api.geoSovereignty.createSovereignty.useMutation({
    onSuccess: () => {
      refreshAfterChange(true);
      resetSovereigntyForm();
    },
  });

  const updateSovereignty = api.geoSovereignty.updateSovereignty.useMutation({
    onSuccess: () => {
      refreshAfterChange(false);
      resetSovereigntyForm();
    },
  });

  const deleteSovereignty = api.geoSovereignty.deleteSovereignty.useMutation({
    onSuccess: () => refreshAfterChange(true),
  });

  const filteredRelations = useMemo(
    () =>
      (relations ?? []).filter(
        (r) =>
          (sovereigntyTypeFilter === "all" || r.relationshipType === sovereigntyTypeFilter) &&
          (!sovereigntySearch ||
            includesText(r.sovereignName, sovereigntySearch) ||
            includesText(r.subjectName, sovereigntySearch))
      ),
    [relations, sovereigntyTypeFilter, sovereigntySearch]
  );

  const countryRelations = useMemo(
    () =>
      activeCountryId
        ? (relations ?? []).filter(
            (r) => r.sovereignId === activeCountryId || r.subjectId === activeCountryId
          )
        : [],
    [relations, activeCountryId]
  );

  const formPayload = () => ({
    relationshipType: sovereigntyForm.relationshipType,
    autonomyLevel: sovereigntyForm.autonomyLevel / 100,
    description: sovereigntyForm.description || undefined,
    establishedDate: sovereigntyForm.establishedDate || undefined,
  });

  const handleCreateSovereignty = () => {
    if (!sovereigntyForm.sovereignId || !sovereigntyForm.subjectId) return;
    createSovereignty.mutate({
      sovereignId: sovereigntyForm.sovereignId,
      subjectId: sovereigntyForm.subjectId,
      ...formPayload(),
    });
  };

  const handleUpdateSovereignty = () => {
    if (!editingSovereigntyId) return;
    updateSovereignty.mutate({ id: editingSovereigntyId, ...formPayload() });
  };

  const handleDeleteSovereignty = async (id: string) => {
    const ok = await confirmEditorAction({
      title: "Delete this sovereignty relationship?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) deleteSovereignty.mutate({ id });
  };

  const handleEditSovereignty = (rel: SovereigntyRelation) => {
    setEditingSovereigntyId(rel.id);
    setSovereigntyForm({
      sovereignId: rel.sovereignId,
      subjectId: rel.subjectId,
      relationshipType: rel.relationshipType,
      autonomyLevel: Math.round(rel.autonomyLevel * 100),
      description: rel.description || "",
      establishedDate: rel.establishedDate ? rel.establishedDate.split("T")[0] : "",
    });
    setShowSovereigntyForm(true);
  };

  return {
    relations,
    relationsLoading,
    sovereigntySearch,
    setSovereigntySearch,
    sovereigntyTypeFilter,
    setSovereigntyTypeFilter,
    showSovereigntyForm,
    setShowSovereigntyForm,
    editingSovereigntyId,
    setEditingSovereigntyId,
    sovereigntyForm,
    setSovereigntyForm,
    createSovereignty,
    updateSovereignty,
    deleteSovereignty,
    filteredRelations,
    countryRelations,
    resetSovereigntyForm,
    handleCreateSovereignty,
    handleUpdateSovereignty,
    handleDeleteSovereignty,
    handleEditSovereignty,
  };
}

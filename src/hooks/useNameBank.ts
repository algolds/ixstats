// src/hooks/useNameBank.ts
// Onoma Lab — Custom Hook for Name Bank & Dictionary Actions

import { useState } from "react";
import { api } from "~/trpc/react";
import { NameCategory, CulturalProfile } from "~/lib/onoma/types";

export function useNameBank() {
  const utils = api.useUtils();

  // Filters for public dictionaries
  const [publicCategoryFilter, setPublicCategoryFilter] = useState<string | null>(null);
  const [publicProfileFilter, setPublicProfileFilter] = useState<string | null>(null);

  // Queries
  const {
    data: nameBank,
    isLoading: isLoadingBank,
    refetch: refetchBank,
  } = api.onoma.getNameBank.useQuery();

  const {
    data: publicDictionaries,
    isLoading: isLoadingPublic,
    refetch: refetchPublic,
  } = api.onoma.getPublicDictionaries.useQuery({
    category: publicCategoryFilter,
    culturalProfile: publicProfileFilter,
  });

  // Mutations
  const saveMutation = api.onoma.saveToNameBank.useMutation({
    onSuccess: () => {
      void refetchBank();
      void refetchPublic();
    },
  });

  const deleteMutation = api.onoma.deleteFromNameBank.useMutation({
    onSuccess: () => {
      void refetchBank();
      void refetchPublic();
    },
  });

  const cloneMutation = api.onoma.cloneDictionary.useMutation({
    onSuccess: () => {
      void refetchBank();
    },
  });

  const togglePublicMutation = api.onoma.togglePublic.useMutation({
    onSuccess: () => {
      void refetchBank();
      void refetchPublic();
    },
  });

  // Handlers
  const saveEntry = async (params: {
    id?: string;
    type: "dictionary" | "saved-name";
    title: string;
    values: string[];
    category?: NameCategory | null;
    culturalProfile?: CulturalProfile | null;
    isPublic?: boolean;
    countryId?: string | null;
    stashId?: string;
  }) => {
    return saveMutation.mutateAsync({
      id: params.id,
      type: params.type,
      title: params.title,
      values: params.values,
      category: params.category || null,
      culturalProfile: params.culturalProfile || null,
      isPublic: params.isPublic,
      countryId: params.countryId || null,
      stashId: params.stashId,
    });
  };

  const deleteEntry = async (id: string) => {
    return deleteMutation.mutateAsync({ id });
  };

  const cloneDictionary = async (id: string) => {
    return cloneMutation.mutateAsync({ id });
  };

  const togglePublic = async (id: string, isPublic: boolean) => {
    return togglePublicMutation.mutateAsync({ id, isPublic });
  };

  return {
    // Personal collection queries
    nameBank,
    isLoadingBank,
    refetchBank,

    // Public dictionaries queries & filters
    publicDictionaries,
    isLoadingPublic,
    refetchPublic,
    publicCategoryFilter,
    setPublicCategoryFilter,
    publicProfileFilter,
    setPublicProfileFilter,

    // Mutations
    saveEntry,
    isSaving: saveMutation.isPending,
    deleteEntry,
    isDeleting: deleteMutation.isPending,
    cloneDictionary,
    isCloning: cloneMutation.isPending,
    togglePublic,
    isToggling: togglePublicMutation.isPending,
  };
}

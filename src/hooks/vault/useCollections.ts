"use client";

import { api } from "~/trpc/react";

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cardCount: number;
  isPublic: boolean;
  totalValue: number;
  thumbnailCards: string[];
  createdAt: Date;
}

export function useCollections() {
  const utils = api.useUtils();

  const { data, isLoading, refetch } = api.vault.getMyCollections.useQuery({});

  const createCollectionMutation = api.vault.createCollection.useMutation({
    onSuccess: () => {
      void utils.vault.getMyCollections.invalidate();
    },
  });

  const updateCollectionMutation = api.vault.updateCollection.useMutation({
    onSuccess: () => {
      void utils.vault.getMyCollections.invalidate();
    },
  });

  const deleteCollectionMutation = api.vault.deleteCollection.useMutation({
    onSuccess: () => {
      void utils.vault.getMyCollections.invalidate();
    },
  });

  const collections: Collection[] =
    data?.collections.map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      cardCount: c.cardCount,
      isPublic: c.isPublic,
      totalValue: c.totalValue,
      thumbnailCards: c.thumbnailCards ?? [],
      createdAt: c.createdAt,
    })) ?? [];

  const createCollection = async (params: {
    name: string;
    description?: string;
    isPublic: boolean;
  }) => {
    return createCollectionMutation.mutateAsync(params);
  };

  const deleteCollection = async (id: string) => {
    return deleteCollectionMutation.mutateAsync({ collectionId: id });
  };

  const updateCollection = async (
    id: string,
    data: {
      name?: string;
      description?: string;
      isPublic?: boolean;
    }
  ) => {
    return updateCollectionMutation.mutateAsync({ collectionId: id, ...data });
  };

  return {
    collections,
    loading: isLoading,
    createCollection,
    deleteCollection,
    updateCollection,
    refetch,
  };
}

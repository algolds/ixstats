// src/hooks/useOnomaHistory.ts
// Onoma — Generation History & Favorites Hook

import { useState, useCallback, useMemo } from "react";
import { api } from "~/trpc/react";

export function useOnomaHistory(initialOptions?: {
  category?: string;
  culturalProfile?: string;
  favoritesOnly?: boolean;
}) {
  const [category, setCategory] = useState(initialOptions?.category);
  const [culturalProfile, setCulturalProfile] = useState(initialOptions?.culturalProfile);
  const [favoritesOnly, setFavoritesOnly] = useState(initialOptions?.favoritesOnly ?? false);

  const utils = api.useUtils();

  const historyQuery = api.onoma.getHistory.useInfiniteQuery(
    { limit: 20, category, culturalProfile, favoritesOnly },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const statsQuery = api.onoma.getStats.useQuery();

  const toggleFavoriteMutation = api.onoma.toggleFavorite.useMutation({
    onSuccess: () => {
      void utils.onoma.getHistory.invalidate();
      void utils.onoma.getStats.invalidate();
      void utils.onoma.getFavorites.invalidate();
    },
  });

  const toggleFavorite = useCallback(
    async (eventId: string, name: string) => {
      return toggleFavoriteMutation.mutateAsync({ eventId, name });
    },
    [toggleFavoriteMutation]
  );

  const allEvents = useMemo(() => {
    return historyQuery.data?.pages.flatMap((page) => page.events) ?? [];
  }, [historyQuery.data]);

  return {
    events: allEvents,
    stats: statsQuery.data,
    isLoading: historyQuery.isLoading,
    isLoadingMore: historyQuery.isFetchingNextPage,
    hasMore: historyQuery.hasNextPage,
    loadMore: () => historyQuery.fetchNextPage(),
    toggleFavorite,
    isTogglingFavorite: toggleFavoriteMutation.isPending,
    // Filters
    category,
    setCategory,
    culturalProfile,
    setCulturalProfile,
    favoritesOnly,
    setFavoritesOnly,
    // Refetch
    refetch: () => {
      void utils.onoma.getHistory.invalidate();
      void utils.onoma.getStats.invalidate();
    },
  };
}

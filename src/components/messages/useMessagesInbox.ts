import { api } from "~/trpc/react";
import type { ThinkShareConversation } from "~/types/thinkshare";
import type { MessageFolder } from "~/types/messages";

/**
 * A folder's conversations, newest first, one server page at a time (`fetchNextPage` adds the next).
 * Realtime events invalidate this query, so it refetches every loaded page.
 */
export function useMessagesInbox(folder: MessageFolder, currentUserId: string) {
  const query = api.messages.getConversationsByFolder.useInfiniteQuery(
    { userId: currentUserId, folder },
    {
      enabled: !!currentUserId,
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    }
  );

  // The server types `type` as a string; it is always one of the three the client knows.
  const conversations = (query.data?.pages.flatMap((page) => page.conversations) ??
    []) as ThinkShareConversation[];

  return {
    conversations,
    isLoading: query.isLoading,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
    refetch: query.refetch,
  };
}

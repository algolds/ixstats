import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { updateReactionsInCacheData, updatePostReactionsList } from "./ReactionCacheUpdater";

type MutationContext = {
  queriesToBackup: [any[], any][];
};

/** Add/remove reaction mutations that patch the feed and post caches optimistically. */
export function useReactionMutations(accounts: any[]) {
  const notify = useNotify();
  const queryClient = useQueryClient();

  // Feed lists whose cached posts carry reaction state
  const feedKeys = () => [
    getQueryKey(api.thinkpages.getFeed),
    getQueryKey(api.thinkpages.getPostsByClerkUserId),
    getQueryKey(api.activities.getGlobalFeed),
    getQueryKey(api.activities.getFollowingFeed),
  ];

  // Cancel in-flight fetches, snapshot the caches for rollback, then patch them optimistically
  const applyOptimisticReaction = async (
    variables: { postId: string; accountId: string },
    reactionType: string,
    isRemoval: boolean
  ): Promise<MutationContext> => {
    const activeAccount = accounts.find((a) => a.id === variables.accountId);
    const postKey = getQueryKey(api.thinkpages.getPost);
    const keys = [...feedKeys(), postKey, getQueryKey(api.thinkpages.getPostReactions)];

    await Promise.all(keys.map((queryKey) => queryClient.cancelQueries({ queryKey })));

    const queriesToBackup = keys.flatMap((queryKey) =>
      queryClient.getQueriesData({ queryKey })
    ) as [any[], any][];

    for (const queryKey of [...feedKeys(), postKey]) {
      queryClient.setQueriesData({ queryKey }, (old: any) =>
        updateReactionsInCacheData(
          old,
          variables.postId,
          variables.accountId,
          reactionType,
          isRemoval
        )
      );
    }

    // Also update the reactions list query for this specific post
    queryClient.setQueriesData(
      { queryKey: getQueryKey(api.thinkpages.getPostReactions, { postId: variables.postId }) },
      (old: any) =>
        updatePostReactionsList(
          old,
          variables.postId,
          variables.accountId,
          reactionType,
          isRemoval,
          activeAccount
        )
    );

    return { queriesToBackup };
  };

  const rollbackReaction = (context: MutationContext | undefined) => {
    for (const [queryKey, queryData] of context?.queriesToBackup ?? []) {
      queryClient.setQueryData(queryKey, queryData);
    }
  };

  const settleReaction = (postId: string) => {
    // Silent invalidation of feeds (avoid refetch storms)
    for (const queryKey of feedKeys()) {
      void queryClient.invalidateQueries({ queryKey, refetchType: "none" });
    }

    // Active refetch of specific post and its reactions since they are cheap
    void queryClient.invalidateQueries({
      queryKey: getQueryKey(api.thinkpages.getPost, { postId }),
    });
    void queryClient.invalidateQueries({
      queryKey: getQueryKey(api.thinkpages.getPostReactions, { postId }),
    });
  };

  const addReactionMutation = api.thinkpages.addReaction.useMutation({
    onMutate: (variables) => applyOptimisticReaction(variables, variables.reactionType, false),
    onSuccess: (data) => {
      // Show feedback
      const dataAny = data as any;
      if ("removed" in dataAny && dataAny.removed) {
        notify.success("Reaction removed");
      } else if ("updated" in dataAny && dataAny.updated) {
        notify.success("Reaction updated");
      } else {
        notify.success("Reaction added");
      }
    },
    onError: (error, variables, context) => {
      console.error("addReactionMutation error:", error);
      rollbackReaction(context);
      notify.error(error.message || "Failed to add reaction");
    },
    onSettled: (data, error, variables) => settleReaction(variables.postId),
  });

  const removeReactionMutation = api.thinkpages.removeReaction.useMutation({
    onMutate: (variables) => applyOptimisticReaction(variables, "", true),
    onSuccess: () => {
      notify.success("Reaction removed");
    },
    onError: (error, variables, context) => {
      console.error("removeReactionMutation error:", error);
      rollbackReaction(context);
      notify.error(error.message || "Failed to remove reaction");
    },
    onSettled: (data, error, variables) => settleReaction(variables.postId),
  });

  return { addReactionMutation, removeReactionMutation };
}

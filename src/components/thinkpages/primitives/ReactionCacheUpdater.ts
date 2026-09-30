/**
 * Helper utilities for optimistic reaction updates in tRPC query caches.
 */

export const updateReactionsInCacheData = (
  oldData: any,
  postId: string,
  accountId: string,
  reactionType: string,
  isRemove: boolean
) => {
  if (!oldData) return oldData;

  const updatePost = (post: any) => {
    if (!post || post.id !== postId) return post;

    const reactions = [...(post.reactions ?? [])];
    let reactionCounts: Record<string, number> = {};
    try {
      reactionCounts =
        typeof post.reactionCounts === "string"
          ? JSON.parse(post.reactionCounts)
          : { ...(post.reactionCounts ?? {}) };
    } catch {
      reactionCounts = {};
    }

    const existingIndex = reactions.findIndex((r: any) => r.accountId === accountId);

    if (isRemove) {
      if (existingIndex !== -1) {
        const removedType = reactions[existingIndex].reactionType;
        reactions.splice(existingIndex, 1);
        reactionCounts[removedType] = Math.max(0, (reactionCounts[removedType] ?? 1) - 1);
        if (reactionCounts[removedType] === 0) {
          delete reactionCounts[removedType];
        }
      }
    } else {
      if (existingIndex !== -1) {
        const oldReactionType = reactions[existingIndex].reactionType;
        if (oldReactionType !== reactionType) {
          // Change reaction type
          reactions[existingIndex] = { ...reactions[existingIndex], reactionType };
          reactionCounts[oldReactionType] = Math.max(0, (reactionCounts[oldReactionType] ?? 1) - 1);
          if (reactionCounts[oldReactionType] === 0) {
            delete reactionCounts[oldReactionType];
          }
          reactionCounts[reactionType] = (reactionCounts[reactionType] ?? 0) + 1;
        } else {
          // Same type -> toggle off (act as remove)
          reactions.splice(existingIndex, 1);
          reactionCounts[reactionType] = Math.max(0, (reactionCounts[reactionType] ?? 1) - 1);
          if (reactionCounts[reactionType] === 0) {
            delete reactionCounts[reactionType];
          }
        }
      } else {
        // Add new reaction
        reactions.push({
          id: `optimistic-reaction-${Date.now()}`,
          accountId,
          reactionType,
          postId,
        });
        reactionCounts[reactionType] = (reactionCounts[reactionType] ?? 0) + 1;
      }
    }

    const serializedReactionCounts =
      typeof post.reactionCounts === "string" ? JSON.stringify(reactionCounts) : reactionCounts;

    const likeCount = reactionCounts.like ?? 0;

    return {
      ...post,
      reactions,
      reactionCounts: serializedReactionCounts,
      likeCount,
    };
  };

  // Case 1: Infinite Query Data { pages: Array<{ posts: Array<any> }> }
  if (oldData.pages && Array.isArray(oldData.pages)) {
    return {
      ...oldData,
      pages: oldData.pages.map((page: any) => {
        if (!page || !Array.isArray(page.posts)) return page;
        return {
          ...page,
          posts: page.posts.map(updatePost),
        };
      }),
    };
  }

  // Case 2: Standard Query Data with posts array { posts: Array<any> }
  if (oldData.posts && Array.isArray(oldData.posts)) {
    return {
      ...oldData,
      posts: oldData.posts.map(updatePost),
    };
  }

  // Case 3: Activity Feed Data { activities: Array<any> } (Dashboard feeds)
  if (oldData.activities && Array.isArray(oldData.activities)) {
    return {
      ...oldData,
      activities: oldData.activities.map((item: any) => {
        if (!item) return item;
        if (item.source === "thinkpages" && item.rawPost) {
          const updatedRawPost = updatePost(item.rawPost);
          if (updatedRawPost !== item.rawPost) {
            return {
              ...item,
              rawPost: updatedRawPost,
              engagement: {
                ...item.engagement,
                likes: updatedRawPost.likeCount ?? item.engagement?.likes ?? 0,
              },
            };
          }
        }
        return item;
      }),
    };
  }

  // Case 4: Single post object
  if (oldData.id === postId) {
    return updatePost(oldData);
  }

  return oldData;
};

export const updatePostReactionsList = (
  oldData: any[] | undefined,
  postId: string,
  accountId: string,
  reactionType: string,
  isRemove: boolean,
  activeAccount: any
) => {
  if (!oldData) return [];

  const existingIndex = oldData.findIndex((r) => r.accountId === accountId);

  if (isRemove) {
    if (existingIndex !== -1) {
      return oldData.filter((r) => r.accountId !== accountId);
    }
    return oldData;
  } else {
    // Toggling off same reaction type
    if (existingIndex !== -1 && oldData[existingIndex].reactionType === reactionType) {
      return oldData.filter((r) => r.accountId !== accountId);
    }

    const updatedReaction = {
      id: `optimistic-reaction-${Date.now()}`,
      postId,
      accountId,
      reactionType,
      account: activeAccount
        ? {
            id: activeAccount.id,
            displayName: activeAccount.displayName,
            username: activeAccount.username,
            avatarUrl: activeAccount.avatarUrl,
          }
        : undefined,
    };

    if (existingIndex !== -1) {
      const updated = [...oldData];
      updated[existingIndex] = updatedReaction;
      return updated;
    }

    return [updatedReaction, ...oldData];
  }
};

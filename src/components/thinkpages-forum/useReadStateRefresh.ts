"use client";

import { useCallback } from "react";
import { api } from "~/trpc/react";

/** After anything that changes what is unread or watched: the lists, the counts and the boards that show them. */
export function useReadStateRefresh(): () => Promise<void> {
  const utils = api.useUtils();
  return useCallback(async () => {
    await Promise.all([
      utils.thinkpagesForum.newPosts.invalidate(),
      utils.thinkpagesForum.watchedThreads.invalidate(),
      utils.thinkpagesForum.navCounts.invalidate(),
      utils.thinkpagesForum.category.invalidate(),
      utils.thinkpagesForum.categories.invalidate(),
      utils.thinkpagesForum.realmSection.invalidate(),
    ]);
  }, [utils]);
}

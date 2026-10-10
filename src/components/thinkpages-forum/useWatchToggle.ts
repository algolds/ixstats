"use client";

import { useCallback } from "react";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import { useReadStateRefresh } from "./useReadStateRefresh";

/**
 * Watches or unwatches a thread, then refreshes the lists, the sidebar count and the thread's own page state. One
 * error string for both directions; resolves true when the change was saved. The Watched page's Unwatch and the
 * thread page's Watch toggle share it.
 */
export function useWatchToggle(): {
  setWatching: (threadId: string, watching: boolean) => Promise<boolean>;
  isPending: boolean;
} {
  const notify = useNotify();
  const utils = api.useUtils();
  const refresh = useReadStateRefresh();
  const watch = api.thinkpagesForum.watchThread.useMutation();
  const unwatch = api.thinkpagesForum.unwatchThread.useMutation();
  const { mutateAsync: watchThread } = watch;
  const { mutateAsync: unwatchThread } = unwatch;

  const setWatching = useCallback(
    async (threadId: string, watching: boolean) => {
      try {
        await (watching ? watchThread({ threadId }) : unwatchThread({ threadId }));
      } catch (e) {
        notify.error("Could not update watching", e instanceof Error ? e.message : undefined);
        return false;
      }
      // The change is saved; a failed refresh of the lists is not an error to report.
      await Promise.all([refresh(), utils.thinkpagesForum.thread.invalidate({ threadId })]).catch(
        () => undefined
      );
      return true;
    },
    [watchThread, unwatchThread, notify, refresh, utils]
  );
  return { setWatching, isPending: watch.isPending || unwatch.isPending };
}

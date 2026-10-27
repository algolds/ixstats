import { useUser } from "~/context/auth-context";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import { useReadStateRefresh } from "../useReadStateRefresh";

/** The board's own unread count (the list shows one page): the home's or the realm's board row; unknown until loaded. */
export function useBoardUnread(categoryKey: string, realm: string | undefined): number | undefined {
  const { isSignedIn } = useUser();
  const sitewideBoards = api.thinkpagesForum.categories.useQuery(undefined, {
    enabled: !!isSignedIn && !realm,
  });
  const realmBoards = api.thinkpagesForum.realmSection.useQuery(
    { realm: realm ?? "" },
    { enabled: !!isSignedIn && !!realm }
  );
  return (realm ? realmBoards.data?.categories : sitewideBoards.data)?.find(
    (b) => b.key === categoryKey
  )?.unreadThreads;
}

/** Marks the whole board read, then refreshes the lists; a failed mark is reported, a failed refresh is not. */
export function useMarkBoardRead(categoryKey: string, realm: string | undefined) {
  const notify = useNotify();
  const refreshReadState = useReadStateRefresh();
  const { mutateAsync: markRead, isPending: marking } =
    api.thinkpagesForum.markCategoryRead.useMutation();
  const markBoardRead = async () => {
    try {
      await markRead({ key: categoryKey, realm });
    } catch (e) {
      notify.error("Could not mark the board read", e instanceof Error ? e.message : undefined);
      return;
    }
    // The mark is saved; a failed refresh of the lists is not an error to report.
    await refreshReadState().catch(() => undefined);
  };
  return { markBoardRead, marking };
}

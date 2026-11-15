import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { withBasePath } from "~/lib/base-path";
import {
  folderFromPath,
  messagesPath,
  normaliseConversationParams,
  parseMessagesAddress,
  selectConversationParams,
  setArchivedView,
  type MessagesAddress,
} from "~/lib/messages/deep-links";
import type { MessageFolder } from "~/types/messages";

/** Marks a history entry this page pushed for a thread, so Back returns to the inbox instead of leaving. */
const THREAD_ENTRY = "messagesThreadEntry";

interface Rewrite {
  mode: "push" | "replace";
  /** App path to move to, without the base path; the current path when left out. */
  path?: string;
  /** Edits the query in place; returning false leaves the address as it is. */
  change?: (query: URLSearchParams) => boolean | void;
  marker?: boolean;
}

function rewriteAddress({ mode, path, change, marker }: Rewrite) {
  const url = new URL(window.location.href);
  if (path) url.pathname = withBasePath(path);
  if (change?.(url.searchParams) === false) return;
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (mode === "push") {
    window.history.pushState(marker ? { [THREAD_ENTRY]: true } : null, "", next);
  } else {
    // Only our own marker carries over: passing Next's state back (it holds `__NA`) makes the router skip the
    // call, so the URL would change while useSearchParams kept the old address.
    const keep = window.history.state?.[THREAD_ENTRY] ? { [THREAD_ENTRY]: true } : null;
    window.history.replaceState(keep, "", next);
  }
}

export interface MessagesAddressApi extends MessagesAddress {
  folder: MessageFolder;
  /** Opens a thread (or closes it with null). Opening from the inbox adds a history entry; switching threads replaces it. */
  selectConversation: (conversationId: string | null, options?: { replace?: boolean }) => void;
  /** Leaves the open thread the way the browser's Back would. */
  leaveConversation: () => void;
  setFolder: (folder: MessageFolder) => void;
  setArchived: (archived: boolean) => void;
}

/**
 * The /messages address as state: the folder (`/messages`, `/messages/requests`), the selected thread
 * (`?conversation=`) and the archived view (`?view=archived`) are read from the URL on every change, so Back, Forward
 * and links from Halo or other pages all work. Older `?id=` and `?conversationId=` links are rewritten once.
 */
export function useMessagesAddress(): MessagesAddressApi {
  const pathname = usePathname();
  const params = useSearchParams();
  const address = parseMessagesAddress(params ?? new URLSearchParams());
  const paramsKey = params?.toString() ?? "";

  useEffect(() => {
    rewriteAddress({ mode: "replace", change: normaliseConversationParams });
  }, [paramsKey]);

  const hasThread = address.conversationId !== null;

  return {
    ...address,
    folder: folderFromPath(pathname),
    selectConversation: (conversationId, options) =>
      rewriteAddress({
        // A link that resolves into a thread replaces its own entry: Back must not land on it again.
        mode: conversationId && !hasThread && !options?.replace ? "push" : "replace",
        marker: true,
        change: (query) => selectConversationParams(query, conversationId),
      }),
    leaveConversation: () => {
      if (window.history.state?.[THREAD_ENTRY]) {
        window.history.back();
        return;
      }
      rewriteAddress({ mode: "replace", change: (query) => selectConversationParams(query, null) });
    },
    setFolder: (folder) =>
      rewriteAddress({
        mode: "push",
        path: messagesPath(folder),
        change: (query) => {
          selectConversationParams(query, null);
          setArchivedView(query, false);
        },
      }),
    setArchived: (archived) =>
      rewriteAddress({
        mode: "replace",
        change: (query) => {
          selectConversationParams(query, null);
          setArchivedView(query, archived);
        },
      }),
  };
}

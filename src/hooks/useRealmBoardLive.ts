"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "~/context/auth-context";
import { useThinkPagesWebSocket } from "~/hooks/useThinkPagesWebSocket";
import {
  BOARD_TYPING_EXPIRY_MS,
  BOARD_TYPING_THROTTLE_MS,
  boardRefetchInterval,
  boardRoomOf,
  type BoardLiveEvent,
} from "~/lib/thinkpages-forum/board-live";
import { api } from "~/trpc/react";
import {
  applyLiveChange,
  applyLiveSettings,
  isFirstPage,
  type BoardData,
} from "./realm-board-live-cache";

/** The names shown as typing: one entry per name, each expiring a few seconds after its last event. */
function useTypingNames() {
  const [names, setNames] = useState<string[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const remove = useCallback((name: string) => {
    clearTimeout(timers.current.get(name));
    timers.current.delete(name);
    setNames((current) => (current.includes(name) ? current.filter((n) => n !== name) : current));
  }, []);

  const add = useCallback(
    (name: string) => {
      clearTimeout(timers.current.get(name));
      timers.current.set(
        name,
        setTimeout(() => remove(name), BOARD_TYPING_EXPIRY_MS)
      );
      setNames((current) => (current.includes(name) ? current : [...current, name]));
    },
    [remove]
  );

  const clear = useCallback(() => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
    setNames((current) => (current.length === 0 ? current : []));
  }, []);

  useEffect(() => clear, [clear]);
  return { names, add, remove, clear };
}

/** Runs `change` over each cached `getBoard` query of the realm; a query it leaves alone is not touched. */
function patchBoards(
  queryClient: QueryClient,
  patch: (page: BoardData | undefined, firstPage: boolean) => BoardData | undefined
) {
  const queryKey = getQueryKey(api.thinkpagesForum.getBoard);
  for (const [key, page] of queryClient.getQueriesData<BoardData>({ queryKey })) {
    const next = patch(page, isFirstPage(key));
    if (next && next !== page) queryClient.setQueryData(key, next);
  }
}

const holdsModeratorCopy = (queryClient: QueryClient, realmId: string): boolean =>
  queryClient
    .getQueriesData<BoardData>({ queryKey: getQueryKey(api.thinkpagesForum.getBoard) })
    .some(([, page]) => page?.realm.id === realmId && page.access.isModerator);

/**
 * A realm board kept live over the ThinkPages socket (spec section 2). Subscribes to the realm's public room, signed
 * in or not, and merges its events into the cached `getBoard` pages by post id. `live` is true once the socket is
 * connected and the room has confirmed the join (its first presence event). Until then the page polls: pass
 * `refetchInterval` to the board query and show "Live updates paused, retrying" while `live` is false. Typing is the
 * names of people typing now; `online` is the room's count, null while not live.
 */
export function useRealmBoardLive(realmId: string | null) {
  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [online, setOnline] = useState<number | null>(null);
  const {
    names: typingNames,
    add: addTyping,
    remove: removeTyping,
    clear: clearTyping,
  } = useTypingNames();
  const lastTypingSent = useRef(0);

  const onBoardEvent = useCallback(
    (event: BoardLiveEvent) => {
      if (event.realmId !== realmId) return;
      switch (event.type) {
        case "board:message":
          removeTyping(event.message.author.name);
          patchBoards(queryClient, (page, first) =>
            applyLiveChange(page, event.realmId, { type: "updated", message: event.message }, first)
          );
          return;
        case "board:updated":
          // A moderator keeps a hidden message, flagged: its copy comes from the query, not from a removal.
          if (event.change.type === "removed" && holdsModeratorCopy(queryClient, event.realmId)) {
            void queryClient.invalidateQueries({
              queryKey: getQueryKey(api.thinkpagesForum.getBoard),
            });
            return;
          }
          patchBoards(queryClient, (page, first) =>
            applyLiveChange(page, event.realmId, event.change, first)
          );
          return;
        case "board:settings":
          patchBoards(queryClient, (page) =>
            applyLiveSettings(page, event.realmId, event.settings)
          );
          // Whether the viewer may post follows the settings: ask the server.
          void queryClient.invalidateQueries({
            queryKey: getQueryKey(api.thinkpagesForum.getBoard),
          });
          return;
        case "board:typing":
          addTyping(event.name);
          return;
        case "board:presence":
          setOnline(event.count);
          return;
      }
    },
    [queryClient, realmId, addTyping, removeTyping]
  );

  // Connect once the session is known, so a signed-in reader is not taken for a signed-out one.
  const { clientState, subscribeToChannel, unsubscribeFromChannel, emitBoardTyping } =
    useThinkPagesWebSocket({ accountId: user?.id, anonymous: isLoaded, onBoardEvent });
  const connected = clientState.connected;
  const live = connected && online !== null;

  useEffect(() => {
    if (!connected || !realmId) {
      setOnline(null);
      clearTyping();
      return;
    }
    const room = boardRoomOf(realmId);
    subscribeToChannel(room);
    return () => {
      unsubscribeFromChannel(room);
      setOnline(null);
    };
  }, [connected, realmId, subscribeToChannel, unsubscribeFromChannel, clearTyping]);

  // Whatever was posted while the socket was down or not yet joined comes from the query.
  useEffect(() => {
    if (live) {
      void queryClient.invalidateQueries({ queryKey: getQueryKey(api.thinkpagesForum.getBoard) });
    }
  }, [live, queryClient]);

  const sendTyping = useCallback(
    (personaId?: string | null) => {
      const now = Date.now();
      if (!live || !isSignedIn || !realmId) return;
      if (now - lastTypingSent.current < BOARD_TYPING_THROTTLE_MS) return;
      lastTypingSent.current = now;
      emitBoardTyping({ realmId, personaId: personaId ?? null });
    },
    [live, isSignedIn, realmId, emitBoardTyping]
  );

  return {
    connected,
    live,
    typing: typingNames,
    online: live ? online : null,
    sendTyping,
    refetchInterval: boardRefetchInterval(live),
  };
}

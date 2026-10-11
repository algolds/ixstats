"use client";

import { useCallback, useEffect, useRef } from "react";
import { api } from "~/trpc/react";

/** The board is marked read at most this often: live messages arrive continuously. */
export const BOARD_READ_INTERVAL_MS = 10_000;

const isTabVisible = (): boolean => document.visibilityState === "visible";

interface RealmBoardRead {
  /** The reader is at the top of the feed, in view of this newest message. */
  markSeen: (newestMessageId: string) => void;
  /** The reader scrolled the top of the feed out of view: a mark that is waiting is dropped. */
  leaveTop: () => void;
}

/**
 * Marks the realm's live board read for a signed-in reader. The feed calls `markSeen` with its newest message while the
 * reader is at the top and `leaveTop` when they scroll away. A newest message already marked is skipped, and marks are
 * at least `BOARD_READ_INTERVAL_MS` apart: a newer message seen inside that window is marked when it ends, so the last
 * one seen is not lost, unless the reader has left the top by then (the next arrival at the top marks it). After a
 * mark, the sidebar counts are refreshed. Switching realm starts over: nothing marked or waiting carries across.
 * A tab nobody is looking at marks nothing: the newest message seen while it was hidden is marked when it is shown
 * again, if the reader is still at the top.
 */
export function useRealmBoardRead(slug: string, signedIn: boolean): RealmBoardRead {
  const utils = api.useUtils();
  const { mutateAsync: markBoardRead } = api.thinkpagesForum.markRealmBoardRead.useMutation();
  const lastMarked = useRef<string | null>(null);
  const lastMarkAt = useRef<number | null>(null);
  const atTop = useRef(true);
  const waiting = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  /** The newest message the feed showed while the tab was hidden: not yet seen by anyone. */
  const unseen = useRef<string | null>(null);

  const mark = useCallback(
    (newestId: string) => {
      lastMarked.current = newestId;
      lastMarkAt.current = Date.now();
      markBoardRead({ realm: slug }).then(
        // The mark is saved; a failed refresh of the counts is not an error to report.
        () => void utils.thinkpagesForum.navCounts.invalidate().catch(() => undefined),
        () => {
          // Not saved: the next message seen tries again.
          if (lastMarked.current === newestId) lastMarked.current = null;
        }
      );
    },
    [markBoardRead, slug, utils]
  );

  const markSeen = useCallback(
    (newestId: string) => {
      atTop.current = true;
      if (!signedIn || lastMarked.current === newestId) return;
      if (!isTabVisible()) {
        unseen.current = newestId;
        return;
      }
      if (waiting.current) {
        // A mark is already waiting out the interval; it will carry the newest message.
        waiting.current.id = newestId;
        return;
      }
      const elapsed = lastMarkAt.current === null ? Infinity : Date.now() - lastMarkAt.current;
      if (elapsed >= BOARD_READ_INTERVAL_MS) {
        mark(newestId);
        return;
      }
      const pending = {
        id: newestId,
        timer: setTimeout(() => {
          waiting.current = null;
          if (!atTop.current || lastMarked.current === pending.id) return;
          if (isTabVisible()) mark(pending.id);
          else unseen.current = pending.id;
        }, BOARD_READ_INTERVAL_MS - elapsed),
      };
      waiting.current = pending;
    },
    [signedIn, mark]
  );

  const leaveTop = useCallback(() => {
    atTop.current = false;
    unseen.current = null;
  }, []);

  useEffect(() => {
    const onVisible = () => {
      const id = unseen.current;
      if (id === null || !atTop.current || !isTabVisible()) return;
      unseen.current = null;
      markSeen(id);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markSeen]);

  useEffect(
    () => () => {
      // A new realm, or the page going away: drop what the last one marked or was about to mark.
      if (waiting.current) clearTimeout(waiting.current.timer);
      waiting.current = null;
      lastMarked.current = null;
      lastMarkAt.current = null;
      unseen.current = null;
      atTop.current = true;
    },
    [slug]
  );
  return { markSeen, leaveTop };
}

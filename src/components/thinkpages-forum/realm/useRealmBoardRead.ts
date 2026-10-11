"use client";

import { useCallback, useEffect, useRef } from "react";
import { api } from "~/trpc/react";

/** The board is marked read at most this often: live messages arrive continuously. */
export const BOARD_READ_INTERVAL_MS = 10_000;

/**
 * Marks the realm's live board read for a signed-in reader. The feed calls the returned function with its newest message
 * while the reader is at the top. A newest message already marked is skipped, and marks are at least
 * `BOARD_READ_INTERVAL_MS` apart: a newer message seen inside that window is marked when it ends, so the last one seen
 * is never lost. After a mark, the sidebar counts are refreshed.
 */
export function useRealmBoardRead(
  slug: string,
  signedIn: boolean
): (newestMessageId: string) => void {
  const utils = api.useUtils();
  const { mutateAsync: markBoardRead } = api.thinkpagesForum.markRealmBoardRead.useMutation();
  const lastMarked = useRef<string | null>(null);
  const lastMarkAt = useRef<number | null>(null);
  const waiting = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  const mark = useCallback(
    (newestId: string) => {
      lastMarked.current = newestId;
      lastMarkAt.current = Date.now();
      markBoardRead({ realm: slug }).then(
        // The mark is saved; a failed refresh of the counts is not an error to report.
        () => void utils.thinkpagesForum.navCounts.invalidate().catch(() => undefined),
        () => {
          // Not saved: the next message seen tries again.
          lastMarked.current = null;
        }
      );
    },
    [markBoardRead, slug, utils]
  );

  const markSeen = useCallback(
    (newestId: string) => {
      if (!signedIn || lastMarked.current === newestId) return;
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
          if (lastMarked.current !== pending.id) mark(pending.id);
        }, BOARD_READ_INTERVAL_MS - elapsed),
      };
      waiting.current = pending;
    },
    [signedIn, mark]
  );

  useEffect(
    () => () => {
      if (waiting.current) clearTimeout(waiting.current.timer);
      waiting.current = null;
    },
    []
  );
  return markSeen;
}

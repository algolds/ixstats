/**
 * How a live board event lands in the cached `thinkpagesForum.getBoard` pages (spec section 2). Pure. A board's
 * first page (no `before` cursor) takes new messages at the top and holds every message newer than what was loaded;
 * an older page (loaded with a cursor) only updates or drops a message it already holds. Merging is by post id, so a
 * message the poll fetched and the socket repeats, or a socket that reconnects, never duplicates or loses one.
 */
import type { QueryKey } from "@tanstack/react-query";
import { z } from "zod";
import {
  removeBoardMessage,
  upsertBoardMessage,
  type BoardLiveChange,
  type BoardLiveMessage,
} from "~/lib/thinkpages-forum/board-live";
import type { RouterOutputs } from "~/trpc/react";

export type BoardData = RouterOutputs["thinkpagesForum"]["getBoard"];
type CachedMessage = BoardData["messages"][number];

const pageKeySchema = z.object({ input: z.object({ before: z.string().nullish() }) });

/** Whether a cached `getBoard` query is the board's newest page (no `before` cursor in its input). */
export function isFirstPage(queryKey: QueryKey): boolean {
  const parsed = pageKeySchema.safeParse(queryKey[1]);
  return parsed.success ? !parsed.data.input.before : true;
}

/**
 * A live (public-shape) message as a cached one. What only the viewer's own page knows is kept from the cached copy
 * of the same message: `byViewer`, `canEdit`, a continued link as the viewer may see it, and a moderator's player id
 * for a persona. A moderator's copy carries the `hidden` flag, which a message on the wire never has set, and the
 * server's verdicts on what they may do to it (`moderable`, `sanctionable`; a message first seen on the wire gets
 * the cautious ones until the next read).
 */
export function toCachedMessage(
  live: BoardLiveMessage,
  existing: CachedMessage | undefined,
  moderator: boolean
): CachedMessage {
  return {
    ...live,
    authorUserId: live.authorUserId ?? existing?.authorUserId ?? null,
    continued: existing?.continued ?? live.continued,
    createdAt: new Date(live.createdAt),
    editedAt: live.editedAt ? new Date(live.editedAt) : null,
    byViewer: existing?.byViewer ?? false,
    canEdit: existing?.canEdit ?? false,
    ...(moderator
      ? {
          hidden: false,
          moderable: existing?.moderable ?? true,
          sanctionable: existing?.sanctionable ?? false,
        }
      : {}),
  };
}

/** The cached page with the change applied; the same page when the change does not touch it. */
export function applyLiveChange(
  page: BoardData | undefined,
  realmId: string,
  change: BoardLiveChange,
  firstPage: boolean
): BoardData | undefined {
  if (page?.realm.id !== realmId) return page;
  if (change.type === "removed") {
    const messages = removeBoardMessage(page.messages, change.postId);
    return messages === page.messages ? page : { ...page, messages };
  }
  const existing = page.messages.find((m) => m.id === change.message.id);
  if (!existing && !firstPage) return page;
  const incoming = toCachedMessage(change.message, existing, page.access.isModerator);
  const messages = upsertBoardMessage(page.messages, incoming, { complete: !page.hasMore });
  return messages === page.messages ? page : { ...page, messages };
}

/** The cached page with the board's new rules. */
export function applyLiveSettings(
  page: BoardData | undefined,
  realmId: string,
  settings: BoardData["realm"]["settings"]
): BoardData | undefined {
  return page?.realm.id === realmId ? { ...page, realm: { ...page.realm, settings } } : page;
}

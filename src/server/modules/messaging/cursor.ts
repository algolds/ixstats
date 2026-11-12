/**
 * Pagination cursors for messaging lists.
 *
 * A cursor names the last item a page returned (its timestamp and id), so the next page starts right after
 * it: nothing is skipped and nothing repeats, even when two rows share a timestamp. The id half is optional so
 * a bare ISO timestamp from an older client still parses (it then pages by time alone).
 */
import { MessagingValidationError } from "./errors";

interface DecodedCursor {
  at: Date;
  id: string | null;
}

export function encodeCursor(at: Date, id: string): string {
  return `${at.toISOString()}|${id}`;
}

export function decodeCursor(cursor: string): DecodedCursor {
  const split = cursor.indexOf("|");
  const at = new Date(split < 0 ? cursor : cursor.slice(0, split));
  if (Number.isNaN(at.getTime())) throw new MessagingValidationError("Invalid cursor");
  return { at, id: split < 0 ? null : cursor.slice(split + 1) };
}

/** A where clause for the rows strictly after the cursor in the given sort direction. */
export function afterCursor<F extends string>(field: F, cursor: string, direction: "asc" | "desc") {
  const { at, id } = decodeCursor(cursor);
  const op = direction === "desc" ? "lt" : "gt";
  if (id === null) return { [field]: { [op]: at } };
  return {
    OR: [{ [field]: { [op]: at } }, { [field]: at, id: { [op]: id } }],
  };
}

/** The sort for a cursor-paged list: the timestamp, then the id as the tie-break. */
export function cursorOrder<F extends string>(field: F, direction: "asc" | "desc") {
  return [{ [field]: direction }, { id: direction }];
}

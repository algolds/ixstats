/**
 * save-failure.ts — what the editor says when a save fails. A refusal the author can act on (saving too fast, a page
 * deleted meanwhile, no passport handle) shows the server's sentence; anything else (an internal error, the network)
 * the generic one, so no server detail leaks into the notice.
 */

export const SAVE_FAILED = "Could not save article changes.";

/** The tRPC codes whose message is written for the author. */
const SHOWN_CODES: ReadonlySet<string> = new Set(["TOO_MANY_REQUESTS", "PRECONDITION_FAILED"]);

/** A failed save as the tRPC client hands it over: the message, and the server's code under `data`. */
interface SaveError extends Error {
  data?: { code?: string } | null;
}

export function saveFailureMessage(error: SaveError): string {
  const code = error.data?.code;
  return code && SHOWN_CODES.has(code) ? error.message : SAVE_FAILED;
}

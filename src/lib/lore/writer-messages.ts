/**
 * What the lore writer says when something fails: a save the server refused (the title of a deleted page reads
 * plainly) and the Lore tab record after a saved page. A refusal the author can act on shows the server's sentence;
 * anything else a generic line, so no server detail leaks. Pure.
 */
import { loreCategory } from "./lore-types";
import { saveFailureMessage } from "~/lib/wiki-os/editor/save-failure";

/** A failure as the tRPC client hands it over: the message, and the server's code under `data`. */
interface FailedCall extends Error {
  data?: { code?: string } | null;
}

export const DELETED_TITLE =
  "This title belongs to a deleted page. Your text is still here: go back and choose another title, or ask an administrator to restore the page.";

export const RECORD_FAILED = "It could not be added to the Lore tab just now.";

/** The lore refusals written for the author or the owner (record, curation, lore team). */
const REFUSALS_SHOWN: ReadonlySet<string> = new Set([
  "BAD_REQUEST",
  "FORBIDDEN",
  "NOT_FOUND",
  "TOO_MANY_REQUESTS",
  "CONFLICT",
]);

export function saveRefusalMessage(error: FailedCall): string {
  if (error.data?.code === "PRECONDITION_FAILED" && /deleted/i.test(error.message)) {
    return DELETED_TITLE;
  }
  return saveFailureMessage(error);
}

/** The server's sentence for a lore refusal the reader can act on, else `fallback`, so no server detail leaks. */
export function refusalMessage(error: FailedCall, fallback: string): string {
  const code = error.data?.code;
  return code && REFUSALS_SHOWN.has(code) ? error.message : fallback;
}

export function recordFailureMessage(error: FailedCall): string {
  return refusalMessage(error, RECORD_FAILED);
}

/** The record was refused because the saved page does not carry `Category:<Country> lore`. */
export function isMissingCategoryRefusal(error: FailedCall, countryName: string): boolean {
  return error.data?.code === "BAD_REQUEST" && error.message.includes(loreCategory(countryName));
}

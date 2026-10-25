/**
 * What the lore writer says when something fails: a save the server refused (the title of a deleted page reads
 * plainly) and the Lore tab record after a saved page. A refusal the author can act on shows the server's sentence;
 * anything else a generic line, so no server detail leaks. Pure.
 */
import { loreCategory } from "./lore-types";
import { saveFailureMessage } from "~/lib/wiki-os/editor/save-failure";

/** A failure as the tRPC client hands it over: the message, and the server's code (and any input errors) under `data`. */
interface FailedCall extends Error {
  data?: { code?: string; zodError?: object | null } | null;
}

/** One input problem as Zod reports it (the refusal's message is a JSON list of these). */
interface InputIssue {
  code?: string;
  path?: readonly (string | number)[];
}

const CHECK_ENTRY = "Check what you entered and try again.";

/** The input problems of a refusal that is the server's input validation, else null (a sentence written for people). */
function inputIssues(error: FailedCall): InputIssue[] | null {
  const parsed = parseJson(error.message);
  if (Array.isArray(parsed)) return parsed as InputIssue[];
  // Validation data with any other message, or a JSON object, is still never shown.
  const isObject = typeof parsed === "object" && parsed !== null;
  return error.data?.zodError || isObject ? [] : null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Plain words for refused input, by its first problem: never the validation detail itself. */
function inputMessage(issues: readonly InputIssue[]): string {
  const [first] = issues;
  const field = first?.path?.[0];
  if (field === "title") {
    return first?.code === "too_big" ? "That title is too long." : "Check the title and try again.";
  }
  if (field === "handle") return "Check the handle and try again.";
  return CHECK_ENTRY;
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

/**
 * The server's sentence for a lore refusal the reader can act on, else `fallback`, so no server detail leaks. Input the
 * server's validation refused reads in plain words (a title too long, a handle to check), never as its JSON.
 */
export function refusalMessage(error: FailedCall, fallback: string): string {
  const code = error.data?.code;
  if (!code || !REFUSALS_SHOWN.has(code)) return fallback;
  const issues = inputIssues(error);
  return issues ? inputMessage(issues) : error.message;
}

export function recordFailureMessage(error: FailedCall): string {
  return refusalMessage(error, RECORD_FAILED);
}

/** The record was refused because the saved page does not carry `Category:<Country> lore`. */
export function isMissingCategoryRefusal(error: FailedCall, countryName: string): boolean {
  return error.data?.code === "BAD_REQUEST" && error.message.includes(loreCategory(countryName));
}

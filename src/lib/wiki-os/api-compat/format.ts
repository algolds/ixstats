/**
 * format.ts — turning module results into the JSON api.php answers with (plan 410).
 *
 * Modules build their results the way `formatversion=2` shows them (plain values, real booleans,
 * arrays). `toWire` then makes the `formatversion=1` differences: a true boolean is `""` and a
 * false one is left out. The few shapes that differ beyond that (`{"*": text}` wrappers, the pages
 * map, namespaces) are built by the module that owns them with `wrapText`/`formatVersion` helpers.
 */

import { ApiError } from "./errors";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type FormatVersion = 1 | 2;

/** The `docref` line MediaWiki adds to every error. */
export const API_DOCREF = "See /w/api.php for API usage.";

/** `2026-09-30T12:34:56Z`: MediaWiki's ISO timestamp (second precision). */
export function mwTimestamp(date: Date): string {
  return `${date.toISOString().slice(0, 19)}Z`;
}

/** `20260930123456`: the 14-digit form MediaWiki uses in continuation values. */
export function mwTimestamp14(date: Date): string {
  return date.toISOString().slice(0, 19).replace(/[-:T]/g, "");
}

/** v1 shows text as `{"*": text}`; v2 shows the text itself. */
export function wrapText(text: string, version: FormatVersion): JsonValue {
  return version === 1 ? { "*": text } : text;
}

/**
 * v1: a true boolean is the empty string and a false one is absent; undefined is dropped in every
 * version. v2 keeps booleans as they are.
 */
export function toWire(value: JsonValue, version: FormatVersion): JsonValue {
  if (Array.isArray(value)) {
    return value.flatMap((item) => (item === undefined ? [] : [toWire(item, version)]));
  }
  if (value !== null && typeof value === "object") {
    const out: JsonObject = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || (version === 1 && item === false)) continue;
      out[key] = toWire(item, version);
    }
    return out;
  }
  return version === 1 && value === true ? "" : value;
}

export type ErrorFormat = "bc" | "plaintext" | "wikitext" | "html" | "raw" | "none";
export const ERROR_FORMATS: readonly ErrorFormat[] = [
  "bc",
  "plaintext",
  "wikitext",
  "html",
  "raw",
  "none",
];

/**
 * The body of a failed request. `errorformat=bc` (the default) is the single `error` object most
 * bots read; the other formats are the `errors` array of the newer envelope.
 */
export function errorBody(
  error: ApiError,
  version: FormatVersion,
  errorFormat: ErrorFormat = "bc"
): JsonObject {
  if (errorFormat === "bc") {
    return { error: { code: error.code, info: error.info, "*": API_DOCREF } };
  }
  const text = errorFormat === "none" ? undefined : error.info;
  const entry: JsonObject =
    version === 1
      ? { code: error.code, "*": text, module: "main" }
      : { code: error.code, text, module: "main" };
  return { errors: [entry], docref: API_DOCREF };
}

/**
 * `warnings: {module: {warnings: text}}` (v2) or `{module: {"*": text}}` (v1): MediaWiki's backward
 * compatible shape, one text per module (several warnings of a module are joined by a newline).
 */
export function warningsBody(
  warnings: ReadonlyMap<string, readonly string[]>,
  version: FormatVersion
): JsonObject | undefined {
  if (warnings.size === 0) return undefined;
  const out: JsonObject = {};
  for (const [module, texts] of warnings) {
    const text = texts.join("\n");
    out[module] = version === 1 ? { "*": text } : { warnings: text };
  }
  return out;
}

/** What a request collects while it runs, and `finish` turns into the response body. */
export class ResponseBuilder {
  readonly warnings = new Map<string, string[]>();

  addWarning = (module: string, text: string): void => {
    const list = this.warnings.get(module) ?? [];
    if (!list.includes(text)) list.push(text);
    this.warnings.set(module, list);
  };

  /** The JSON body: the module's result, `warnings` when there are any, all in `version`'s shape. */
  finish(result: JsonObject, version: FormatVersion): JsonObject {
    const warnings = warningsBody(this.warnings, version);
    const body = warnings ? { ...result, warnings } : result;
    return toWire(body, version) as JsonObject;
  }
}

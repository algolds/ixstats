/**
 * main-params.ts — the parameters every api.php request carries (plan 410): the output format, the
 * error format, the assertions and which action to run. Read in one place, in the order that lets
 * an error be reported in the format the request asked for, and so `action=paraminfo` can describe
 * the main module by reading it.
 */

import { badValues } from "./errors";
import { ERROR_FORMATS, type ErrorFormat, type FormatVersion } from "./format";
import type { ApiParams } from "./params";

export const OUTPUT_FORMATS = ["json", "jsonfm"] as const;
export const FORMAT_VERSIONS = ["1", "2", "latest"] as const;
export const ASSERTIONS = ["anon", "user", "bot"] as const;

/** What an error needs to be written: filled in as the parameters are read, so a later failure still uses them. */
export interface OutputSettings {
  version: FormatVersion;
  errorFormat: ErrorFormat;
}

export interface MainRequest {
  action: string | undefined;
  assertKind: (typeof ASSERTIONS)[number] | undefined;
  assertUser: string | undefined;
}

/** Read the main parameters; `settings` is updated as each is read. `actions` are the names `action` may take. */
export function readMainParams(
  params: ApiParams,
  actions: readonly string[],
  settings: OutputSettings
): MainRequest {
  const version = params.oneOf("formatversion", FORMAT_VERSIONS, "1");
  settings.version = version === "1" ? 1 : 2;
  settings.errorFormat = params.oneOf("errorformat", ERROR_FORMATS, "bc");
  params.oneOf("format", OUTPUT_FORMATS, "json");
  params.string("maxlag");
  params.flag("utf8");
  params.flag("ascii");
  if (params.flag("callback")) throw badValues("callback", ["JSONP is not supported"]);
  return {
    action: params.oneOf("action", actions),
    assertKind: params.oneOf("assert", ASSERTIONS),
    assertUser: params.string("assertuser"),
  };
}

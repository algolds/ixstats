/**
 * errors.ts — the errors an api.php request answers with (plan 410).
 *
 * MediaWiki reports a failed request as HTTP 200 with `{"error": {"code", "info"}}`, so a module
 * throws an `ApiError` and the dispatcher turns it into that body (format.ts). The codes are
 * MediaWiki's own: bots branch on them (`badtoken`, `editconflict`, `missingtitle`, ...).
 */

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly info: string
  ) {
    super(`${code}: ${info}`);
    this.name = "ApiError";
  }
}

const quoted = (name: string) => `"${name}"`;

export const missingParam = (name: string) =>
  new ApiError("missingparam", `The ${quoted(name)} parameter must be set.`);

export const missingOneOf = (names: readonly string[]) =>
  new ApiError(
    "missingparam",
    `One of the parameters ${names.join(", ")} is required.`
  );

export const mixedParams = (names: readonly string[]) =>
  new ApiError("invalidparammix", `The parameters ${names.join(", ")} can not be used together.`);

export const badValue = (name: string, value: string) =>
  new ApiError("badvalue", `Unrecognized value for parameter ${quoted(name)}: ${value}.`);

export const badValues = (name: string, values: readonly string[]) =>
  new ApiError(
    "badvalue",
    `Unrecognized ${values.length === 1 ? "value" : "values"} for parameter ${quoted(name)}: ${values.join(", ")}.`
  );

export const badInteger = (name: string, value: string) =>
  new ApiError("badinteger", `Invalid value ${quoted(value)} for integer parameter ${quoted(name)}.`);

export const badTimestamp = (name: string, value: string) =>
  new ApiError("badtimestamp", `Invalid value ${quoted(value)} for timestamp parameter ${quoted(name)}.`);

export const tooManyValues = (name: string, limit: number) =>
  new ApiError(
    "toomanyvalues",
    `Too many values supplied for parameter ${quoted(name)}. The limit is ${limit}.`
  );

export const badContinue = () =>
  new ApiError(
    "badcontinue",
    "Invalid continue param. You should pass the original value returned by the previous query."
  );

export const invalidTitle = (title: string) =>
  new ApiError("invalidtitle", `Bad title ${quoted(title)}.`);

export const mustBePosted = (module: string) =>
  new ApiError("mustbeposted", `The ${quoted(module)} module requires a POST request.`);

/** A module WikiOS cannot serve until another plan lands, reported the way MediaWiki reports an unknown value. */
export const unavailable = (name: string, value: string, reason: string) =>
  new ApiError("badvalue", `Unrecognized value for parameter ${quoted(name)}: ${value}. ${reason}`);

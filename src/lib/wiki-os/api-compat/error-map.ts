/**
 * error-map.ts — the existing services' refusals as api.php errors (plan 410).
 *
 * The permission, page and upload services throw `TRPCError` / `PageOperationError` / `UploadError`; a bot expects
 * MediaWiki's error codes. `authorizeAction` puts its reason code first in a FORBIDDEN message
 * (`blocked: You are blocked ...`), which maps here to MediaWiki's own codes.
 */

import { TRPCError } from "@trpc/server";
import { PageOperationError } from "~/lib/wiki-os/core/page-management-service";
import { UploadError } from "~/lib/wiki-os/services/upload-error";
import { ApiError } from "./errors";

/** WikiOS's denial codes (`permissions.ts`) as MediaWiki's error codes. */
const DENIAL_CODES: Readonly<Record<string, string>> = {
  blocked: "blocked",
  namespaceprotected: "protectednamespace",
  protectedpage: "protectedpage",
  titleprotected: "protectedtitle",
  permissiondenied: "permissiondenied",
};

/** The upload service's refusal codes that MediaWiki spells differently (the others, `empty-file` and the like, are its own). */
const UPLOAD_CODES: Readonly<Record<string, string>> = {
  "unsafe-svg": "uploaded-script-svg",
  corrupt: "verification-error",
};

const DENIAL_MESSAGE = /^(\w+): ([\s\S]*)$/;

function fromForbidden(message: string): ApiError {
  const match = DENIAL_MESSAGE.exec(message);
  const code = match?.[1] ? DENIAL_CODES[match[1]] : undefined;
  return code && match?.[2]
    ? new ApiError(code, match[2])
    : new ApiError("permissiondenied", message);
}

/**
 * The api.php error for a service refusal, or null when `error` is not one (a bug: the dispatcher
 * logs it and answers `internal_api_error`).
 */
export function toApiError(error: Error): ApiError | null {
  if (error instanceof ApiError) return error;
  if (error instanceof PageOperationError) return fromPageCode(error.code, error.message);
  if (error instanceof UploadError)
    return new ApiError(UPLOAD_CODES[error.code] ?? error.code, error.message);
  if (error instanceof TRPCError) return fromTrpc(error);
  return null;
}

function fromPageCode(code: string, message: string): ApiError {
  switch (code) {
    case "NOT_FOUND":
      return new ApiError("missingtitle", message);
    case "CONFLICT":
      return new ApiError("articleexists", message);
    default:
      return new ApiError("invalidparam", message);
  }
}

function fromTrpc(error: TRPCError): ApiError {
  switch (error.code) {
    case "FORBIDDEN":
      return fromForbidden(error.message);
    case "UNAUTHORIZED":
      return new ApiError("permissiondenied", error.message);
    case "BAD_REQUEST":
      return /title is not valid/i.test(error.message)
        ? new ApiError("invalidtitle", error.message)
        : new ApiError("invalidparam", error.message);
    case "NOT_FOUND":
      return new ApiError("missingtitle", error.message);
    case "PRECONDITION_FAILED":
      return new ApiError("pagedeleted", error.message);
    default:
      return new ApiError("internal_api_error", "The request could not be completed.");
  }
}

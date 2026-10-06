/** A template preview is read again after a day (the server keeps its own, Redis, copy for as long). */
export const TEMPLATE_PREVIEW_STALE_MS = 24 * 60 * 60 * 1000;

/** An error from a tRPC call, which carries the procedure's error code in `data`. */
type ProcedureError = Error & { data?: { code?: string } | null };

/** Why a template preview could not be fetched, in words an author can act on. */
export function previewFailureReason(err: unknown): string {
  if (!(err instanceof Error)) return "";
  switch ((err as ProcedureError).data?.code) {
    case "TOO_MANY_REQUESTS":
      return "Too many previews were asked for just now; try again in a minute.";
    case "UNAUTHORIZED":
      return "Sign in to preview templates.";
    case "BAD_REQUEST":
      return "The preview service refused these parameters.";
    default:
      return "The preview service did not answer.";
  }
}

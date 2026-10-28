import { z } from "zod";

/** The longest content warning a ThinkPages post may carry, shared by the composer and the post mutations. */
export const CONTENT_WARNING_MAX_LENGTH = 100;

/**
 * A post's optional content warning: trimmed, at most CONTENT_WARNING_MAX_LENGTH characters, and null when empty
 * (so an edit can clear it). Left out, it stays undefined, which an edit reads as "keep the stored warning".
 */
export const contentWarningInput = z
  .string()
  .trim()
  .max(CONTENT_WARNING_MAX_LENGTH)
  .nullish()
  .transform((warning) => (warning === undefined ? undefined : warning || null));

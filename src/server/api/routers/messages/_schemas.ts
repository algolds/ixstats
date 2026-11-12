/**
 * Input schemas shared by the messages routers.
 */
import { z } from "zod";

/** A path on this site: one slash, then not another slash or a backslash (browsers read `/\host` as `//host`). */
const RELATIVE_PATH = /^\/(?![/\\])[^\s\\]*$/;

/** Whether `value` is safe to render as a link or file URL: a relative path, or an `https:` URL. */
export function isSafeUrl(value: string): boolean {
  if (RELATIVE_PATH.test(value)) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export const SafeUrl = z
  .string()
  .max(2048)
  .refine(isSafeUrl, { message: "Use a relative path or an https: URL" });

/** Most attachments one message carries. */
export const MAX_ATTACHMENTS = 10;

export const AttachmentSchema = z.object({
  type: z.string().min(1).max(64),
  url: SafeUrl,
  filename: z.string().max(255).optional(),
  size: z.number().int().nonnegative().optional(),
});

export const AttachmentsSchema = z.array(AttachmentSchema).max(MAX_ATTACHMENTS);

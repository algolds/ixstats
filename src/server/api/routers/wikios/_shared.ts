import { z } from "zod/v4";

/** Wiki selector shared by every WikiOS reader procedure; defaults to IxWiki. */
export const wikiSourceSchema = z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki");

/**
 * A template preview's input: a bare template name (no wikitext syntax) and at most 200 bounded parameters, since
 * the preview is rendered by MediaWiki's parser.
 */
export const templatePreviewInput = z.object({
  template: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[^{}|\[\]<>\n]+$/),
  params: z
    .record(z.string().max(64), z.string().max(20_000))
    .refine((params) => Object.keys(params).length <= 200, "At most 200 parameters"),
});

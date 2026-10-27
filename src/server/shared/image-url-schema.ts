import { z } from "zod";

/**
 * An image URL as the media repository picker (`MediaSearchModal`) hands it back.
 *
 * The picker returns root-relative paths, not absolute URLs: Wikimedia Commons picks are routed
 * through the local proxy (`/projects/ixstats/api/mediawiki/commons/Special:Filepath/...`), IxWiki
 * picks are downloaded to `/projects/ixstats/images/downloaded/...`, and stash/upload picks are
 * served from our own origin. `z.string().url()` rejects every one of those, so this accepts an
 * absolute http(s) URL or a same-origin root-relative path (never protocol-relative `//host`).
 */
export const imageUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => {
      if (value.startsWith("/")) return !value.startsWith("//") && !value.startsWith("/\\");
      try {
        const { protocol } = new URL(value);
        return protocol === "https:" || protocol === "http:";
      } catch {
        return false;
      }
    },
    { message: "Must be an http(s) URL or a site-relative image path" }
  );

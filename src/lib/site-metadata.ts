import type { Metadata } from "next";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";

/** Where the site lives when `NEXT_PUBLIC_APP_URL` is unset or not a URL: the wiki's host, which
 * also serves IxStates under its base path. */
function fallbackOrigin(): URL {
  return new URL(new URL(mediaWikiOrigin()).origin);
}

/**
 * The root layout's `metadataBase`: the absolute base for canonical, og:url and OG image URLs.
 * Origin only, never the base path: Next appends every relative metadata URL to
 * `metadataBase.pathname`, and file-based OG image URLs (`opengraph-image.tsx`) already start with
 * the base path, so a base path here would appear twice. Pages pass `withBasePath(...)` paths.
 */
export function siteMetadataBase(appUrl = process.env.NEXT_PUBLIC_APP_URL): URL {
  if (!appUrl) return fallbackOrigin();
  try {
    return new URL(new URL(appUrl).origin);
  } catch {
    return fallbackOrigin();
  }
}

/** The og:site_name of IxStates pages. */
export const SITE_NAME = "IxStates";

/** Keeps a page out of search results (`robots: noindex, nofollow`). */
export const NOINDEX: Metadata = { robots: { index: false, follow: false } };

type OpenGraph = NonNullable<Metadata["openGraph"]>;

/** Title, description, the given og tags and a large-image twitter card. No images: a route's
 * `opengraph-image.tsx` supplies them, and an `images` key here would replace it. */
export function socialMetadata(
  title: string,
  description: string | undefined,
  openGraph: OpenGraph
): Metadata {
  return {
    title,
    description,
    openGraph,
    twitter: { card: "summary_large_image", title, description },
  };
}

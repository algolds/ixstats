import "server-only";

import type { Metadata } from "next";
import { getWikiBaseUrl } from "~/lib/wiki-os/config";
import { articleSeo } from "~/lib/wiki-os/article-seo";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";
import {
  canonicalPathRedirect,
  type ArticleTarget,
  type SearchParamsLike,
} from "~/lib/wiki-os/wiki-path";
import { loadArticle, type ArticleHtml } from "./load-article";

const NO_INDEX = { index: false, follow: false } as const;
/** Namespaces whose page may have no text and still be worth indexing: User, File and Category pages. */
const NAMESPACES_WITHOUT_TEXT = new Set([2, 6, 14]);

function publicOrigin(): string {
  return getWikiBaseUrl("ixwiki").replace(/\/+$/, "");
}

/** Title, description, canonical URL and link-preview card of an article, from the same data the reader is served. */
function articleMetadata(data: ArticleHtml): Metadata {
  const canon = canonicalizeTitle(data.title);
  const origin = publicOrigin();
  const url = `${origin}/wiki/${canon?.urlPath ?? encodeURIComponent(data.title.replace(/ /g, "_"))}`;
  const { description, image } = articleSeo(data, origin);

  return {
    title: data.title,
    ...(description ? { description } : {}),
    alternates: { canonical: url },
    openGraph: {
      siteName: "IxWiki",
      type: "article",
      url,
      title: data.title,
      ...(description ? { description } : {}),
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: data.title,
      ...(description ? { description } : {}),
      ...(image ? { images: [image] } : {}),
    },
  };
}

/**
 * The metadata of `/wiki/<path>`: an article's own title, description, canonical URL (WikiOS is the
 * canonical host, plan D12) and card; edit, history, diff, revision and info views are not indexed
 * and point at the article; a missing page is not indexed. Another wiki's page is client-rendered
 * and sets its own. Tool, special and raw routes redirect, so they have none.
 */
export async function articleTargetMetadata(
  target: ArticleTarget,
  segments: readonly string[],
  query: SearchParamsLike
): Promise<Metadata> {
  const { canon, view, source } = target;
  if (source !== "ixwiki" || canon.title === "Main Page") return {};

  const canonical = `${publicOrigin()}/wiki/${canon.urlPath}`;
  if (view.type !== "read") {
    return { title: canon.title, alternates: { canonical }, robots: NO_INDEX };
  }
  // A URL that is not the canonical spelling redirects before it renders anything.
  if (canonicalPathRedirect(segments, canon, query)) return {};

  const loaded = await loadArticle(canon.title, view.followRedirect);
  if (loaded.status === "found")
    return loaded.data.resolvedFrom ? {} : articleMetadata(loaded.data);
  if (loaded.status === "unavailable") return { alternates: { canonical } };
  return NAMESPACES_WITHOUT_TEXT.has(canon.namespaceId)
    ? { title: canon.title, alternates: { canonical } }
    : { robots: NO_INDEX };
}

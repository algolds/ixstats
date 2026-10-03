// Server entry for the article reader. The reader itself is client-rendered
// (ArticlePageClient); this wrapper exists so crawlers that do not run JavaScript get the
// article's own canonical URL instead of a site-wide one.

import { type Metadata } from "next";
import ArticlePageClient from "./ArticlePageClient";
import { RESERVED_TOOL_PAGES } from "./reserved-tool-pages";
import { getWikiBaseUrl } from "~/lib/wiki-os/config";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const title = safeDecode(rawSlug).replace(/_/g, " ").trim();
  const dashed = title.toLowerCase().replace(/[\s_]+/g, "-");

  // Tool routes, special pages, categories and user pages redirect client-side to their own routes.
  if (!title || RESERVED_TOOL_PAGES[dashed] || /^(special|category|user|user talk):/i.test(title)) {
    return {};
  }

  const origin = getWikiBaseUrl("ixwiki").replace(/\/+$/, "");
  return {
    alternates: { canonical: `${origin}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}` },
  };
}

export default function WikiOSArticlePage() {
  return <ArticlePageClient />;
}

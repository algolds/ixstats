// src/app/(wikios)/w/[slug]/page.tsx
// WikiOS Article Reader — renders a wiki article in reader mode
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wikios/shared/WikiOSLayout";
import { ArticleRenderer } from "~/components/wikios/reader/ArticleRenderer";
import { WikiOSMainPage } from "~/components/wikios/reader/WikiOSMainPage";
import { useLinkPreviews } from "~/components/wikios/reader/LinkPreview";
import { withBasePath } from "~/lib/base-path";

export default function WikiOSArticlePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const articleRef = useRef<HTMLDivElement>(null);
  const slug = params.slug;
  const title = decodeURIComponent(slug).replace(/_/g, " ");

  const isMainPage = title === "Main Page" || title === "Main_Page";

  // Redirect Category: pages to the category browser
  useEffect(() => {
    if (title.startsWith("Category:")) {
      const catName = title.slice("Category:".length);
      router.replace(withBasePath(`/wiki-special/categories/${encodeURIComponent(catName.replace(/ /g, "_"))}`));
    }
  }, [title, router]);

  // Fetch article HTML (disabled for Main Page — uses custom component)
  const { data, isLoading, error } = api.wikios.getArticleHtml.useQuery(
    { title },
    { enabled: !!title && !isMainPage, staleTime: 5 * 60 * 1000 }
  );

  // Canonical link and page title
  useEffect(() => {
    if (isMainPage) {
      document.title = "IxWiki — WikiOS";
    } else if (data?.title) {
      document.title = `${data.title} — IxWiki`;
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
      }
      canonical.href = `https://ixwiki.com/wiki/${encodeURIComponent(data.title.replace(/ /g, "_"))}`;
    }
  }, [data?.title, isMainPage]);

  // Link hover previews
  const previewPortal = useLinkPreviews(articleRef);

  // Main Page — render custom component
  if (isMainPage) {
    return (
      <WikiOSLayout>
        <WikiOSMainPage />
      </WikiOSLayout>
    );
  }

  // Standard article
  return (
    <WikiOSLayout title={data?.title ?? title}>
      <div ref={articleRef}>
        {isLoading && (
          <div className="wikios-loading">
            <div className="wikios-loading-spinner" />
            <p className="mt-4 text-sm text-zinc-400">Loading article...</p>
          </div>
        )}
        {error && (
          <div className="wikios-error glass-hierarchy-child rounded-lg p-6">
            <h2 className="mb-2 text-lg font-semibold text-red-400">Article not found</h2>
            <p className="text-sm text-zinc-400">
              The page &ldquo;{title}&rdquo; does not exist on IxWiki.
            </p>
            <div className="mt-4 flex gap-3">
              <a
                href={`/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`}
                className="wikios-action-btn"
              >
                Try MediaWiki
              </a>
              <a
                href={`/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}?action=edit`}
                className="wikios-action-btn"
              >
                Create this page
              </a>
            </div>
          </div>
        )}
        {data && (
          <ArticleRenderer
            title={data.title}
            contentHtml={data.contentHtml}
            infoboxHtml={data.infoboxHtml}
            noticesHtml={data.noticesHtml}
            toc={data.toc}
            categories={data.categories}
            lastModified={data.lastModified}
          />
        )}
      </div>
      {previewPortal}
    </WikiOSLayout>
  );
}

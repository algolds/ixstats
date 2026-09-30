"use client";
// src/app/(wiki-os)/wiki/[slug]/edit/page.tsx
// WikiOS Article Editor Entrypoint — delegates to WikiEditBridge with instant mode support.

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { WikiEditBridge } from "~/components/wiki-os/editor/WikiEditBridge";
import { ArticleNotFound } from "~/components/wiki-os/reader/ArticleNotFound";
import { withBasePath } from "~/lib/base-path";
import { parseWikiSource, wikiReaderPath } from "~/lib/wiki-os/config";
import { canonicalizeTitle, decodeTitleParam } from "~/lib/wiki-os/core/title";

export default function WikiOSEditPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const source = parseWikiSource(searchParams.get("source"));
  const isIxWiki = source === "ixwiki";

  // The URL segment is decoded once; the editor and its save work on the canonical title.
  const slug = decodeTitleParam(params.slug);
  const canon = useMemo(() => canonicalizeTitle(slug, { source }), [slug, source]);
  const title = canon?.title ?? "";

  // Section edit links open the source editor at the heading they came from.
  const section = searchParams.get("section") ?? undefined;
  const initialMode: "source" | "visual" =
    !section && searchParams.get("mode") === "visual" ? "visual" : "source";

  const handleClose = useCallback(() => {
    router.push(withBasePath(wikiReaderPath(title)));
  }, [router, title]);

  // Another wiki's page (?source=) is read-only in WikiOS (ruling E-l′): back to its read view.
  useEffect(() => {
    if (!isIxWiki) router.replace(withBasePath(wikiReaderPath(title, source)));
  }, [isIxWiki, router, title, source]);
  if (!isIxWiki) return null;

  if (!canon) {
    return (
      <WikiOSLayout title="Invalid page title" hideTitleHeading>
        <ArticleNotFound title={slug} wikiSource={source} onCreate={() => {}} />
      </WikiOSLayout>
    );
  }

  return (
    <WikiOSLayout title={`Editing ${title}`} hideTitleHeading>
      <div className="wikios-editor-page w-full">
        <WikiEditBridge
          title={title}
          initialMode={initialMode}
          initialSection={section}
          onClose={handleClose}
          onSaveSuccess={handleClose}
        />
      </div>
    </WikiOSLayout>
  );
}

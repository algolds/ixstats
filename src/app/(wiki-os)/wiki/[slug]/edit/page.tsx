"use client";
// WikiOS Article Editor Entrypoint — delegates to WikiEditBridge with instant mode support.

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { WikiEditBridge } from "~/components/wiki-os/editor/WikiEditBridge";
import { withBasePath } from "~/lib/base-path";
import { parseWikiSource, wikiReaderPath } from "~/lib/wiki-os/config";

export default function WikiOSEditPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const slug = params.slug;
  const title = useMemo(() => {
    try {
      return decodeURIComponent(slug).replace(/_/g, " ");
    } catch {
      return slug.replace(/_/g, " ");
    }
  }, [slug]);

  // Section edit links open the source editor at the heading they came from.
  const section = searchParams.get("section") ?? undefined;
  const initialMode: "source" | "visual" =
    !section && searchParams.get("mode") === "visual" ? "visual" : "source";

  const handleClose = useCallback(() => {
    router.push(withBasePath(`/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`));
  }, [router, title]);

  // Another wiki's page (?source=) is read-only in WikiOS (ruling E-l′): back to its read view.
  const source = parseWikiSource(searchParams.get("source"));
  const isIxWiki = source === "ixwiki";
  useEffect(() => {
    if (!isIxWiki) router.replace(withBasePath(wikiReaderPath(title, source)));
  }, [isIxWiki, router, title, source]);
  if (!isIxWiki) return null;

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

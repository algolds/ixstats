"use client";
// src/app/(wiki-os)/wiki/[slug]/edit/page.tsx
// WikiOS Article Editor Entrypoint — delegates to WikiEditBridge with instant mode support.

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { WikiEditBridge } from "~/components/wiki-os/editor/WikiEditBridge";
import { withBasePath } from "~/lib/base-path";

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

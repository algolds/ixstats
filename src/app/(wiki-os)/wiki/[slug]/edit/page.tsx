// src/app/(wiki-os)/wiki/[slug]/edit/page.tsx
// WikiOS Article Editor Entrypoint — delegates to WikiEditBridge with instant mode support.

"use client";

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

  const initialMode = (searchParams.get("mode") === "visual" ? "visual" : "source") as
    | "source"
    | "visual";

  const handleClose = useCallback(() => {
    router.push(withBasePath(`/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`));
  }, [router, title]);

  return (
    <WikiOSLayout title={`Editing ${title}`} hideTitleHeading>
      <div className="wikios-editor-page w-full">
        <WikiEditBridge
          title={title}
          initialMode={initialMode}
          onClose={handleClose}
          onSaveSuccess={handleClose}
        />
      </div>
    </WikiOSLayout>
  );
}

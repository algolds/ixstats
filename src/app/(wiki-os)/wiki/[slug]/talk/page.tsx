"use client";
// Legacy WikiOS Talk Page — redirects to the modern WikiOS Margin split-canvas inspector.

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { withBasePath } from "~/lib/base-path";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { ChatBubble as MessageSquare } from "iconoir-react";

export default function TalkPageRedirect() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;
  const title = decodeURIComponent(slug).replace(/_/g, " ");

  useEffect(() => {
    // Redirect to the article with margin inspector triggered
    router.replace(withBasePath(`/wiki/${encodeURIComponent(slug)}?margin=threads`));
  }, [slug, router]);

  return (
    <WikiOSLayout title={`Margin: ${title}`}>
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="rounded-card bg-tint-fill text-tint flex size-12 items-center justify-center">
          <MessageSquare className="h-6 w-6" />
        </div>
        <h3 className="text-title-3 text-label">Opening Margin...</h3>
        <p className="text-footnote text-label-secondary max-w-sm">
          WikiOS has upgraded talk pages to the Margin split-canvas suite. Redirecting to &ldquo;
          {title}&rdquo;...
        </p>
      </div>
    </WikiOSLayout>
  );
}

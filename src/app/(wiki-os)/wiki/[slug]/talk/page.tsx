"use client";
// src/app/(wiki-os)/wiki/[slug]/talk/page.tsx
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
        <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-sky-400">
          <MessageSquare className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-100">Opening Margin...</h3>
        <p className="max-w-sm text-xs text-slate-400">
          WikiOS has upgraded talk pages to the Margin split-canvas suite. Redirecting to &ldquo;
          {title}&rdquo;...
        </p>
      </div>
    </WikiOSLayout>
  );
}

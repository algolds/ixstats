// src/app/(wiki-os)/wiki/[slug]/talk/page.tsx
// Legacy WikiOS Talk Page — redirects to the modern WikiOS Margin split-canvas inspector.

"use client";

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
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center p-8">
        <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 animate-pulse">
          <MessageSquare className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-100">Opening Margin...</h3>
        <p className="text-xs text-slate-400 max-w-sm">
          WikiOS has upgraded talk pages to the Margin split-canvas suite. Redirecting to &ldquo;{title}&rdquo;...
        </p>
      </div>
    </WikiOSLayout>
  );
}

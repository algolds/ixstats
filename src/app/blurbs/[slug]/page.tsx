"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { withBasePath } from "~/lib/base-path";
import { WikiOSLayout } from "~/components/wikios/shared/WikiOSLayout";
import { BlurbPromptDetail } from "~/components/blurbs/BlurbPromptDetail";
import { BlurbsNav } from "~/components/blurbs/BlurbsNav";

export default function BlurbDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  usePageTitle({ title: "Blurb" });

  return (
    <WikiOSLayout>
      <div className="mx-auto max-w-3xl py-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link
              href={withBasePath("/blurbs")}
              className="transition-colors hover:text-foreground"
            >
              Blurbs
            </Link>
            <ChevronRight className="h-3 w-3 opacity-50" />
            <span className="text-foreground">{slug.replace(/-/g, " ")}</span>
          </div>
          <BlurbsNav />
        </div>
        <BlurbPromptDetail slug={slug} />
      </div>
    </WikiOSLayout>
  );
}

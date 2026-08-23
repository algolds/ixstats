"use client";

import { use } from "react";
import Link from "next/link";
import { NavArrowRight as ChevronRight } from "iconoir-react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { withBasePath } from "~/lib/base-path";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { BlurbPromptDetail } from "~/components/thinkpages/blurbs/BlurbPromptDetail";
import { BlurbsNav } from "~/components/thinkpages/blurbs/BlurbsNav";

export default function BlurbDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  usePageTitle({ title: "Blurb" });

  return (
    <WikiOSLayout>
      <div className="mx-auto max-w-3xl py-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Link
              href={withBasePath("/blurbs")}
              className="hover:text-foreground transition-colors"
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

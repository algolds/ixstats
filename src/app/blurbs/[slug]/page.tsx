"use client";

import { use } from "react";
import Link from "next/link";
import { usePageTitle } from "~/hooks/usePageTitle";
import { withBasePath } from "~/lib/base-path";
import { BlurbPromptDetail } from "~/components/blurbs/BlurbPromptDetail";

export default function BlurbDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  usePageTitle({ title: "Blurb" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4">
        <Link
          href={withBasePath("/blurbs")}
          className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          &larr; All prompts
        </Link>
      </div>

      <BlurbPromptDetail slug={slug} />
    </div>
  );
}

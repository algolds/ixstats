"use client";

import Link from "next/link";
import { usePageTitle } from "~/hooks/usePageTitle";
import { withBasePath } from "~/lib/base-path";
import { BlurbPromptList } from "~/components/blurbs/BlurbPromptList";

export default function BlurbsPage() {
  usePageTitle({ title: "Blurbs" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">
          Blurbs
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Weekly prompts to share your country&apos;s culture, flavor, and lore.
          Responses are saved to your country&apos;s profile.
        </p>
      </div>

      <BlurbPromptList />

      <div className="mt-8 text-center">
        <Link
          href={withBasePath("/thinkpages")}
          className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          Discuss on ThinkPages &rarr;
        </Link>
      </div>
    </div>
  );
}

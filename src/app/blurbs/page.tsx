"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { BlurbPromptList } from "~/components/blurbs/BlurbPromptList";
import { BlurbsNav } from "~/components/blurbs/BlurbsNav";

export default function BlurbsPage() {
  usePageTitle({ title: "Blurbs" });

  return (
    <WikiOSLayout>
      <div className="mx-auto max-w-3xl py-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Blurbs</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Weekly prompts to share your country&apos;s culture, flavor, and lore.
            </p>
          </div>
          <BlurbsNav />
        </div>
        <BlurbPromptList />
      </div>
    </WikiOSLayout>
  );
}

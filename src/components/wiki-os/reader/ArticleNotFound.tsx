"use client";

import { WIKI_SOURCES, type WikiSource } from "~/lib/wiki-os/config";
import { Button } from "~/components/ui/button";

/**
 * The reader's "no such page" state. Only an IxWiki page can be created from WikiOS, and only by a
 * signed-in user (`canCreate`, default true).
 */
export function ArticleNotFound({
  title,
  wikiSource,
  onCreate,
  canCreate = true,
}: {
  title: string;
  wikiSource: WikiSource;
  onCreate: () => void;
  canCreate?: boolean;
}) {
  return (
    <div className="wikios-error rounded-card border-separator bg-surface border p-6">
      <h2 className="text-title-3 text-red mb-2">Article not found</h2>
      <p className="text-body text-label-secondary">
        The page &ldquo;{title}&rdquo; does not exist on {WIKI_SOURCES[wikiSource].name}.
      </p>
      {wikiSource === "ixwiki" && canCreate && (
        <div className="mt-4 flex gap-3">
          <Button onClick={onCreate}>Create this page</Button>
        </div>
      )}
    </div>
  );
}

"use client";

import { WIKI_SOURCES, type WikiSource } from "~/lib/wiki-os/config";

/** The reader's "no such page" state. Only an IxWiki page can be created from WikiOS. */
export function ArticleNotFound({
  title,
  wikiSource,
  onCreate,
}: {
  title: string;
  wikiSource: WikiSource;
  onCreate: () => void;
}) {
  return (
    <div className="wikios-error rounded-card border-separator bg-surface border p-6">
      <h2 className="text-title-3 text-red mb-2">Article not found</h2>
      <p className="text-body text-label-secondary">
        The page &ldquo;{title}&rdquo; does not exist on {WIKI_SOURCES[wikiSource].name}.
      </p>
      {wikiSource === "ixwiki" && (
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onCreate}
            className="wikios-action-btn rounded-control bg-tint text-caption text-on-tint hover:bg-tint cursor-pointer px-4 py-2 font-semibold transition-colors"
          >
            Create this page
          </button>
        </div>
      )}
    </div>
  );
}

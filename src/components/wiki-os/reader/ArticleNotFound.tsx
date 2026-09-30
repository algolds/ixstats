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
    <div className="wikios-error facet-hierarchy-child rounded-lg p-6">
      <h2 className="mb-2 text-lg font-semibold text-red-400">Article not found</h2>
      <p className="text-sm text-zinc-400">
        The page &ldquo;{title}&rdquo; does not exist on {WIKI_SOURCES[wikiSource].name}.
      </p>
      {wikiSource === "ixwiki" && (
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onCreate}
            className="wikios-action-btn cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-500"
          >
            Create this page
          </button>
        </div>
      )}
    </div>
  );
}

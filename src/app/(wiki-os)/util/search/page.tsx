"use client";
// src/app/(wiki-os)/wiki/search/page.tsx
// WikiOS Search Page — full search results

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [searchTerm, setSearchTerm] = useState(initialQuery);

  const { data: results, isLoading } = api.wikios.search.useQuery(
    { query: searchTerm, limit: 50 },
    { enabled: searchTerm.length >= 1, staleTime: 60_000 }
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSearchTerm(query);
    },
    [query]
  );

  return (
    <WikiOSLayout title="Search">
      <div className="wikios-special-page">
        <form onSubmit={handleSubmit} className="wikios-fullsearch-form">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles..."
            className="wikios-fullsearch-input"
            autoFocus
          />
          <button type="submit" className="wikios-action-btn">
            Search
          </button>
        </form>

        {isLoading && (
          <div className="wikios-loading min-h-[100px]">
            <div className="wikios-loading-spinner" />
          </div>
        )}

        {results && results.length > 0 && (
          <div className="wikios-search-results-page">
            <p className="wikios-search-count">
              {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{searchTerm}
              &rdquo;
            </p>
            <ul className="wikios-search-results-list">
              {results.map((item) => (
                <li key={item.title} className="wikios-search-result-item">
                  <Link
                    href={withBasePath(
                      `/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`
                    )}
                    className="wikios-search-result-title-link"
                  >
                    {item.title}
                  </Link>
                  {"snippet" in item && (item as { snippet?: string }).snippet && (
                    <p className="wikios-search-result-excerpt">
                      {(item as { snippet: string }).snippet}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {results && results.length === 0 && searchTerm && (
          <div className="wikios-no-results">
            <p className="text-zinc-400">No results found for &ldquo;{searchTerm}&rdquo;.</p>
            <p className="mt-2 text-sm text-zinc-500">
              Try a different search term, or{" "}
              <a
                href={`/wiki/index.php?search=${encodeURIComponent(searchTerm)}`}
                className="text-blue-400 underline"
              >
                search on MediaWiki
              </a>
              .
            </p>
          </div>
        )}
      </div>
    </WikiOSLayout>
  );
}

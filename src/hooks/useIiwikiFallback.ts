"use client";
// The reader's fallback for an IIWiki page the server could not render: the reader's browser renders it
// (lib/wiki-os/iiwiki-browser-render.ts). Any server error counts, "not found" included: a server Cloudflare
// refused cannot read the page at all, so it cannot tell a missing page from a refused one.

import { useQuery } from "@tanstack/react-query";
import type { WikiSource } from "~/lib/wiki-os/config";
import { renderIiwikiInBrowser } from "~/lib/wiki-os/iiwiki-browser-render";

const RENDER_STALE_MS = 10 * 60 * 1000;

export function useIiwikiFallback(title: string, wikiSource: WikiSource, serverFailed: boolean) {
  const active = wikiSource === "iiwiki" && serverFailed;
  const query = useQuery({
    queryKey: ["wikios", "iiwiki-browser-render", title],
    // Shaped here, once, as the server's answer (another wiki's page has no categories, date or authors here):
    // the query keeps that one object, so the reader's props stay the same object from render to render.
    queryFn: async ({ signal }) => {
      const page = await renderIiwikiInBrowser(title, signal);
      return page && { ...page, categories: [] as string[], lastModified: null, authorInfo: null };
    },
    enabled: active,
    retry: false,
    staleTime: RENDER_STALE_MS,
  });
  return {
    /** Whether the fallback, not the server's answer, decides what the reader shows. */
    active,
    article: active ? (query.data ?? undefined) : undefined,
    loading: active && query.isLoading,
    missing: active && query.data === null,
    failed: active && query.isError,
    retry: () => void query.refetch(),
  };
}

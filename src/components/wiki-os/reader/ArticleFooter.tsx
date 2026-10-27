"use client";

import React from "react";
import { getWikiBaseUrl, type WikiSource } from "~/lib/wiki-os/config";

export function ArticleFooter({
  title,
  lastModified,
  wikiSource,
}: {
  title: string;
  lastModified: string | null;
  /** The wiki the page lives on (default the main wiki). */
  wikiSource?: WikiSource;
}) {
  // The main wiki's pages are read here already; only a sister wiki's page has an original elsewhere.
  const sourceUrl =
    wikiSource && wikiSource !== "ixwiki"
      ? `${getWikiBaseUrl(wikiSource).replace(/\/$/, "")}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`
      : null;

  return (
    <div className="wikios-article-footer">
      {lastModified && (
        <p className="wikios-last-modified">
          Last modified:{" "}
          {new Date(lastModified).toLocaleDateString("en-US", {
            timeZone: "UTC",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      )}
      {sourceUrl && (
        <div className="wikios-footer-links">
          <a href={sourceUrl} className="wikios-footer-link" target="_blank" rel="noopener">
            View on original wiki
          </a>
        </div>
      )}
    </div>
  );
}

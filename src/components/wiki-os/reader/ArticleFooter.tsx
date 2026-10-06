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
  /** The wiki the page lives on (default IxWiki). */
  wikiSource?: WikiSource;
}) {
  const mwBaseUrl = getWikiBaseUrl(wikiSource);
  const mwUrl = `${mwBaseUrl.replace(/\/$/, "")}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

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
      <div className="wikios-footer-links">
        <a href={mwUrl} className="wikios-footer-link" target="_blank" rel="noopener">
          View on original wiki
        </a>
      </div>
    </div>
  );
}

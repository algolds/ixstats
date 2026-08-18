"use client";

import React from "react";

export function ArticleFooter({
  title,
  lastModified,
}: {
  title: string;
  lastModified: string | null;
}) {
  const mwBaseUrl = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com/";
  const mwUrl = `${mwBaseUrl.replace(/\/$/, "")}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

  return (
    <div className="wikios-article-footer">
      {lastModified && (
        <p className="wikios-last-modified">
          Last modified:{" "}
          {new Date(lastModified).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      )}
      <div className="wikios-footer-links">
        <a href={mwUrl} className="wikios-footer-link" target="_blank" rel="noopener">
          View on Original Wiki
        </a>
      </div>
    </div>
  );
}

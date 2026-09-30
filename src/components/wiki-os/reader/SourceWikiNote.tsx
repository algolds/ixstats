"use client";

import { Lock } from "iconoir-react";
import { WIKI_SOURCES, type WikiSource } from "~/lib/wiki-os/config";

/** Another wiki's page shown in WikiOS (ruling E-l): read only here, editable on its own wiki. Nothing for IxWiki. */
export function SourceWikiNote({ title, wikiSource }: { title: string; wikiSource: WikiSource }) {
  if (wikiSource === "ixwiki") return null;
  const { name, baseUrl } = WIKI_SOURCES[wikiSource];
  const origin = baseUrl.replace(/\/+$/u, "");
  return (
    <p className="text-muted-foreground mt-2 mb-3 flex items-center gap-1.5 px-1 text-xs">
      <Lock className="h-3 w-3 shrink-0" aria-hidden />
      <span>From {name} — read only ·</span>
      <a
        href={`${origin}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`}
        target="_blank"
        rel="noreferrer"
        className="hover:text-foreground underline-offset-4 hover:underline"
      >
        open on {new URL(origin).host}
      </a>
    </p>
  );
}

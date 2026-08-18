"use client";

import { useMemo } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { WikiHtmlContent } from "~/components/wiki/WikiLinkPreview";
import { parseWikitextToHtml } from "~/lib/wiki/wikitext-parser";
import { titleToWikiOSRoute } from "~/lib/wiki-os/url-compat";

export { parseWikitextToHtml };

export function InlineWikiArticlePreview({
  title,
  wiki = "ixwiki",
}: {
  title: string;
  wiki?: "ixwiki" | "iiwiki";
}) {
  const { data: intro } = api.wiki.getIntro.useQuery(
    { title, wiki },
    { enabled: !!title, staleTime: 30 * 60_000 }
  );

  const formattedHtml = useMemo(() => {
    if (!intro?.text) return "";
    return parseWikitextToHtml(intro.text, wiki);
  }, [intro?.text, wiki]);

  if (!formattedHtml) return null;

  const wikiHref = titleToWikiOSRoute(title);

  return (
    <div className="group/preview mt-2 flex items-start gap-2.5 rounded-xl border border-teal-500/20 bg-teal-500/[0.04] p-2.5 shadow-sm transition-all duration-150 hover:border-teal-500/35 hover:bg-teal-500/[0.08]">
      <div className="mt-0.5 h-full min-h-[2rem] w-0.5 shrink-0 rounded-full bg-teal-500/60 group-hover/preview:bg-teal-400" />
      <div className="min-w-0 flex-1">
        <WikiHtmlContent
          html={formattedHtml}
          className="line-clamp-2 text-[11px] leading-relaxed font-normal tracking-tight text-foreground/80 group-hover/preview:text-foreground [&_a]:transition-colors"
        />
      </div>
      <Link
        href={wikiHref}
        className="text-teal-400/80 hover:text-teal-300 ml-1.5 shrink-0 text-[10px] font-semibold transition-colors active:scale-95"
      >
        Read →
      </Link>
    </div>
  );
}

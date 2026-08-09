"use client";

import { useMemo } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { WikiHtmlContent } from "~/components/wiki/WikiLinkPreview";
import { titleToWikiOSRoute } from "~/lib/wiki-os/url-compat";
import { resolveImageUrl, getImageUrl } from "~/lib/wiki-image-url";

export function parseWikitextToHtml(wikitext: string, wikiSource: string = "ixwiki"): string {
  if (!wikitext) return "";

  let text = wikitext;

  // 1. Strip ref tags: <ref>...</ref> or <ref ... />
  text = text.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "");
  text = text.replace(/<ref\b[^>]*\/>/gi, "");

  // 2. Strip templates: {{...}}
  text = text.replace(/\{\{[\s\S]*?\}\}/g, "");

  // 3. Convert wikitext images: [[File:name.jpg|thumb|200px|Caption]] or [[Image:name.png|...]]
  text = text.replace(/\[\[(?:File|Image):([^\]]+)\]\]/gi, (_match, content) => {
    const parts = content.split("|").map((p: string) => p.trim());
    if (parts.length === 0 || !parts[0]) return "";

    const rawFileName = parts[0];
    const imageUrl = resolveImageUrl(rawFileName, wikiSource as any) ?? getImageUrl(rawFileName);
    if (!imageUrl) return "";

    const captionParts = parts.slice(1).filter((p: string) => {
      const lower = p.toLowerCase();
      if (
        lower === "thumb" ||
        lower === "thumbnail" ||
        lower === "frame" ||
        lower === "framed" ||
        lower === "frameless" ||
        lower === "border" ||
        lower === "left" ||
        lower === "right" ||
        lower === "center" ||
        lower === "none" ||
        /^\d+px$/i.test(lower) ||
        /^upright(=[\d.]+)?$/i.test(lower) ||
        lower.startsWith("alt=") ||
        lower.startsWith("link=")
      ) {
        return false;
      }
      return true;
    });

    const caption = captionParts.join(" | ");

    return `<figure class="my-2.5 overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-md backdrop-blur-md transition-all">
      <img src="${imageUrl}" alt="${caption || rawFileName}" class="max-h-48 w-full object-cover rounded-t-xl" loading="lazy" />
      ${caption ? `<figcaption class="p-2 text-[10px] text-muted-foreground/90 font-medium tracking-tight bg-white/[0.03] border-t border-white/5 leading-tight">${caption}</figcaption>` : ""}
    </figure>`;
  });

  // 4. Convert wikitext bold+italic: '''''text'''''
  text = text.replace(/'''''((?:(?!''''')[\s\S])+)'''''/g, "<strong><em>$1</em></strong>");

  // 5. Convert wikitext bold: '''text'''
  text = text.replace(/'''((?:(?!''')[\s\S])+)'''/g, "<strong>$1</strong>");

  // 6. Convert wikitext italic: ''text''
  text = text.replace(/''((?:(?!'')[\s\S])+)''/g, "<em>$1</em>");

  // 7. Convert wikitext piped internal links: [[Target Page|Display Label]]
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_match, page, label) => {
    const route = titleToWikiOSRoute(page.trim());
    return `<a href="${route}" class="text-teal-400 font-semibold hover:underline">${label.trim()}</a>`;
  });

  // 8. Convert wikitext simple internal links: [[Target Page]]
  text = text.replace(/\[\[([^\]]+)\]\]/g, (_match, page) => {
    const p = page.trim();
    const route = titleToWikiOSRoute(p);
    return `<a href="${route}" class="text-teal-400 font-semibold hover:underline">${p}</a>`;
  });

  // 9. Convert wikitext external links: [http://example.com Display Label]
  text = text.replace(
    /\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-teal-400 hover:underline">$2</a>'
  );

  return text.trim();
}

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

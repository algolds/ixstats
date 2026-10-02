"use client";

import { useMemo } from "react";
import Link from "next/link";
import { OpenNewWindow as ExternalLink } from "iconoir-react";
import { api } from "~/trpc/react";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import {
  normalizeWikiImageUrl,
  extractLeadImageFromWikitext,
  extractLeadImageFromHtml,
  isNoticeOrUtilityIcon,
} from "~/lib/wiki-os/transformers/image-url";
import { Button } from "~/components/ui/button";
import { WikiArticleActions } from "./WikiArticleActions";
import { Card } from "~/components/ui/card";

export { parseWikitextToHtml };

export function InlineWikiArticlePreview({
  title,
  wiki = "ixwiki",
}: {
  title: string;
  wiki?: "ixwiki" | "iiwiki";
}) {
  const cleanTitle = useMemo(() => {
    try {
      return decodeURIComponent(title).replace(/_/g, " ").trim();
    } catch {
      return title.replace(/_/g, " ").trim();
    }
  }, [title]);

  // ─── Queries ─────────────────────────────────────────────────────────────────
  // Article text intro
  const { data: intro } = api.wikios.getIntro.useQuery(
    { title: cleanTitle, wiki },
    { enabled: !!cleanTitle, staleTime: 30 * 60_000 }
  );

  // Eligible article images
  const { data: pageImages } = api.wikios.getPageImages.useQuery(
    { title: cleanTitle },
    { enabled: !!cleanTitle, staleTime: 30 * 60_000 }
  );

  const formattedHtml = useMemo(() => {
    const raw = intro?.text || intro?.intro || "";
    if (!raw) return "";
    return parseWikitextToHtml(raw, wiki);
  }, [intro?.text, intro?.intro, wiki]);

  const leadImage = useMemo(() => {
    // 1. Check pageImages from API query
    if (pageImages && Array.isArray(pageImages) && pageImages.length > 0) {
      const eligible =
        pageImages.find(
          (img: any) =>
            img &&
            (img.thumbUrl || img.url) &&
            !isNoticeOrUtilityIcon(img.title || img.url || img.thumbUrl) &&
            !img.title?.toLowerCase().endsWith(".svg") &&
            !img.title?.toLowerCase().includes("flag") &&
            !img.title?.toLowerCase().includes("icon")
        ) ||
        pageImages.find(
          (img: any) =>
            img &&
            (img.thumbUrl || img.url) &&
            !isNoticeOrUtilityIcon(img.title || img.url || img.thumbUrl)
        ) ||
        pageImages[0];

      const rawUrl = eligible?.thumbUrl || eligible?.url || null;
      if (rawUrl) {
        const normalized = normalizeWikiImageUrl(rawUrl);
        if (normalized) return normalized;
      }
    }

    // 2. Fallback: extract genuine lead image from raw wikitext / intro text
    const rawText = intro?.text || intro?.intro || "";
    if (rawText) {
      const fromWikitext = extractLeadImageFromWikitext(rawText);
      if (fromWikitext) {
        const normalized = normalizeWikiImageUrl(fromWikitext);
        if (normalized) return normalized;
      }
      const fromHtml = extractLeadImageFromHtml(rawText);
      if (fromHtml) {
        const normalized = normalizeWikiImageUrl(fromHtml);
        if (normalized) return normalized;
      }
    }

    return null;
  }, [pageImages, intro?.text, intro?.intro]);

  if (!formattedHtml && !leadImage) return null;

  const wikiHref = titleToWikiOSRoute(cleanTitle);

  return (
    <Card variant="inset" padding="sm" className="mt-2 sm:p-4">
      {/* Content & lead image */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {formattedHtml && (
            <WikiHtmlContent
              html={formattedHtml}
              className="text-label text-callout line-clamp-3 [&_a]:transition-colors"
            />
          )}
        </div>

        {/* Lead image thumbnail */}
        {leadImage && (
          <Link
            href={wikiHref}
            className="border-separator bg-fill-4 rounded-row focus-visible:outline-tint relative h-20 w-28 shrink-0 overflow-hidden border focus-visible:outline-2 focus-visible:outline-offset-2 sm:h-22 sm:w-32"
            title={`View ${cleanTitle}`}
          >
            <img
              src={leadImage}
              alt={cleanTitle}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </Link>
        )}
      </div>

      {/* ── Action toolbar, margin composer, repost ── */}
      <WikiArticleActions
        title={cleanTitle}
        trailing={
          <Button asChild variant="secondary" size="sm" className="rounded-full">
            <Link href={wikiHref}>
              <span>Open in Wiki</span>
              <ExternalLink aria-hidden />
            </Link>
          </Button>
        }
      />
    </Card>
  );
}

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { OpenNewWindow as ExternalLink } from "iconoir-react";
import { api } from "~/trpc/react";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { Button } from "~/components/ui/button";
import { WikiArticleActions } from "./WikiArticleActions";
import { useWikiLeadImage } from "./useWikiLeadImage";
import { WikiLeadThumb } from "./WikiLeadThumb";
import { decodeWikiTitle } from "./externalLinks";
import { Card } from "~/components/ui/card";

export function InlineWikiArticlePreview({
  title,
  wiki = "ixwiki",
}: {
  title: string;
  wiki?: "ixwiki" | "iiwiki";
}) {
  const cleanTitle = decodeWikiTitle(title);

  const { data: intro } = api.wikios.getIntro.useQuery(
    { title: cleanTitle, wiki },
    { enabled: !!cleanTitle, staleTime: 30 * 60_000 }
  );

  const formattedHtml = useMemo(() => {
    const raw = intro?.text || intro?.intro || "";
    if (!raw) return "";
    return parseWikitextToHtml(raw, wiki);
  }, [intro?.text, intro?.intro, wiki]);

  const leadImage = useWikiLeadImage(cleanTitle, intro?.text || intro?.intro || "");

  if (!formattedHtml && !leadImage) return null;

  const wikiHref = titleToWikiOSRoute(cleanTitle);

  return (
    <Card variant="well" padding="sm" className="mt-2 sm:p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {formattedHtml && (
            <WikiHtmlContent
              html={formattedHtml}
              className="text-label text-callout line-clamp-3 [&_a]:transition-colors"
            />
          )}
        </div>

        {leadImage && (
          <WikiLeadThumb
            image={leadImage}
            href={wikiHref}
            title={cleanTitle}
            className="sm:h-22 sm:w-32"
          />
        )}
      </div>

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

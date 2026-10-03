import { useMemo } from "react";
import { api } from "~/trpc/react";
import {
  normalizeWikiImageUrl,
  extractLeadImageFromWikitext,
  extractLeadImageFromHtml,
  isNoticeOrUtilityIcon,
} from "~/lib/wiki-os/transformers/image-url";

interface PageImage {
  title?: string;
  url?: string;
  thumbUrl?: string;
}

const usable = (img: PageImage | undefined): img is PageImage =>
  !!img && !!(img.thumbUrl || img.url);

/** The first real article image: an eligible page image, else one embedded in the intro text. */
export function useWikiLeadImage(title: string, introText: string): string | null {
  const { data: pageImages } = api.wikios.getPageImages.useQuery(
    { title },
    { enabled: !!title, staleTime: 30 * 60_000 }
  );

  return useMemo(() => {
    const images = (Array.isArray(pageImages) ? pageImages : []) as PageImage[];
    const label = (img: PageImage) => img.title || img.url || img.thumbUrl;
    const eligible =
      images.find((img) => {
        const name = img.title?.toLowerCase();
        return (
          usable(img) &&
          !isNoticeOrUtilityIcon(label(img)) &&
          !name?.endsWith(".svg") &&
          !name?.includes("flag") &&
          !name?.includes("icon")
        );
      }) ??
      images.find((img) => usable(img) && !isNoticeOrUtilityIcon(label(img))) ??
      images[0];

    const fromPage = normalizeWikiImageUrl(eligible?.thumbUrl || eligible?.url || null);
    if (fromPage) return fromPage;

    for (const extract of [extractLeadImageFromWikitext, extractLeadImageFromHtml]) {
      const embedded = normalizeWikiImageUrl(extract(introText));
      if (embedded) return embedded;
    }
    return null;
  }, [pageImages, introText]);
}

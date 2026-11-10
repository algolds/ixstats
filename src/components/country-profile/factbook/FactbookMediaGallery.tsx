"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bank,
  BookStack,
  Clock,
  Coins,
  Globe,
  Group,
  NavArrowRight,
  OpenBook,
  Shield,
} from "iconoir-react";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import type { ProfileMediaArticle } from "~/app/countries/[slug]/_utils/profileLayer";
import { CardFace } from "~/components/cards/face/CardFace";
import { CardsLogomark } from "~/lib/navigation/icons/CardsLogomark";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import { cardSheetHref } from "~/lib/cards/face/sheet-link";
import { CARD_HUB_PATHS } from "~/lib/cards/hub-routes";
import { countryTabHref } from "~/lib/country/country-routes";
import { classifyArticleTopic, cleanSummary, type ArticleTopic } from "~/lib/country/article-topics";
import { stripHtml } from "~/lib/utils/sanitize-html";

const TOPIC_BADGES: Record<ArticleTopic, { label: string; icon: React.ReactNode }> = {
  history: { label: "History", icon: <Clock /> },
  state: { label: "State & law", icon: <Bank /> },
  economy: { label: "Economy", icon: <Coins /> },
  defense: { label: "Defense", icon: <Shield /> },
  diplomacy: { label: "Diplomacy", icon: <Globe /> },
  geography: { label: "Geography", icon: <Globe /> },
  society: { label: "Society", icon: <Group /> },
  culture: { label: "Culture", icon: <OpenBook /> },
  dossier: { label: "Dossier", icon: <OpenBook /> },
};

function ArticleSpotlightTile({ article }: { article: ProfileMediaArticle }) {
  const resolvedUrl = article.imageUrl ? proxyCardArtwork(article.imageUrl) : null;
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = Boolean(resolvedUrl && failed !== resolvedUrl);
  const isVector = Boolean(resolvedUrl && /\.svg(?:$|\?)/i.test(resolvedUrl));
  const summary = cleanSummary(article.summary);
  const topic = TOPIC_BADGES[classifyArticleTopic(article.title)];

  return (
    <Link
      href={`/wiki/${encodeURIComponent(article.slug)}`}
      data-slot="factbook-lore-card"
      className="facet-well facet-press facet-lift focus-visible:outline-tint rounded-row group/article flex min-w-0 flex-col justify-between overflow-hidden focus-visible:outline-2"
    >
      {showImage && resolvedUrl ? (
        <div className="border-separator bg-fill-4 relative h-28 w-full overflow-hidden border-b">
          {/* oxlint-disable-next-line nextjs/no-img-element -- remote wiki lead image */}
          <img
            src={resolvedUrl}
            alt={stripHtml(article.title)}
            loading="lazy"
            onError={() => setFailed(resolvedUrl)}
            className={
              isVector
                ? "duration-drift ease-out-facet size-full object-contain p-3 transition-transform motion-safe:group-hover/article:scale-[1.04]"
                : "duration-drift ease-out-facet size-full object-cover transition-transform motion-safe:group-hover/article:scale-[1.04]"
            }
          />
          <span className="facet-well rounded-control-sm text-caption text-label absolute top-2 left-2 px-1.5 py-0.5 font-medium">
            {topic.label}
          </span>
          {article.readingTime > 0 && (
            <span className="facet-well rounded-control-sm text-caption text-label-secondary absolute top-2 right-2 px-1.5 py-0.5 tabular-nums">
              {`${article.readingTime} min`}
            </span>
          )}
        </div>
      ) : (
        <div className="border-separator/60 flex items-center justify-between gap-2 border-b px-3 pt-3 pb-2">
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="facet-recess text-tint rounded-control-sm grid size-6 shrink-0 place-items-center [:where(&)_svg]:size-3.5"
            >
              {topic.icon}
            </span>
            <Badge variant="secondary">{topic.label}</Badge>
          </span>
          {article.readingTime > 0 && (
            <span className="text-caption text-label-secondary shrink-0 tabular-nums">
              {`${article.readingTime} min read`}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-1 flex-col justify-between gap-2 p-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-subheadline text-label line-clamp-1 font-medium">
            {stripHtml(article.title)}
          </h3>
          {summary && <p className="text-caption text-label-secondary line-clamp-2">{summary}</p>}
        </div>
        <span className="text-caption text-tint inline-flex items-center gap-1 font-medium">
          Read more
          <NavArrowRight aria-hidden className="size-3 shrink-0" />
        </span>
      </div>
    </Link>
  );
}

/**
 * FactbookMediaGallery — rich media strips below the 3-column Factbook bento grid:
 * 1. Canonical Encyclopedia & Lore Spotlight (dynamically linked sub-articles from the country's Wiki page).
 * 2. National Collectibles (`IxVault` trading cards with `data-card-rarity` edges and gems).
 */
export function FactbookMediaGallery({ layer }: { layer: CountryProfileLayer }) {
  const articles = layer.media?.articles.slice(0, 6) ?? [];
  const cards = layer.media?.cards.slice(0, 6) ?? [];

  if (articles.length === 0 && cards.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {articles.length > 0 && (
        <Card padding="md" className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                className="facet-recess text-tint rounded-control-sm grid size-8 shrink-0 place-items-center [:where(&)_svg]:size-4"
              >
                <BookStack />
              </span>
              <div className="min-w-0">
                <h2 className="text-title-3 text-label truncate">Country Lore</h2>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild className="shrink-0">
              <Link href={countryTabHref("lore", layer.slug)}>
                Explore lore
                <NavArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleSpotlightTile key={article.id} article={article} />
            ))}
          </div>
        </Card>
      )}

      {cards.length > 0 && (
        <Card padding="md" content="collectible" className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                className="facet-recess text-tint rounded-control-sm grid size-8 shrink-0 place-items-center [:where(&)_svg]:size-4"
              >
                <CardsLogomark />
              </span>
              <div className="min-w-0">
                <h2 className="text-title-3 text-label truncate">National collectibles</h2>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild className="shrink-0">
              <Link href="/vault">
                Open in Vault
                <NavArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
          {/* The Vault's own faces at shelf size, in a swipeable row like the realm shelves. */}
          <ul className="-m-1 flex snap-x [scrollbar-width:none] gap-3 overflow-x-auto p-1">
            {cards.map((face) => (
              <li
                key={face.cardId}
                data-slot="factbook-collectible-card"
                className="shrink-0 snap-start"
              >
                <CardFace
                  face={face}
                  size="S"
                  href={cardSheetHref(CARD_HUB_PATHS.explore, face.cardId)}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

"use client";

/**
 * StoryPinModal — Immersive full reading experience for story pins.
 *
 * Desktop: Centered overlay modal (max-w-3xl, max-h-[85vh]).
 * Mobile: Full-screen bottom sheet.
 *
 * Renders rich markdown content, wiki integration, image gallery,
 * storyline timeline, and related pins.
 */

import { Skeleton } from "~/components/ui/skeleton";
import { memo } from "react";
import {
  OpenBook as BookOpen,
  OpenNewWindow as ExternalLink,
  MapPin,
  NavArrowRight as ChevronRight,
  NavArrowLeft as ChevronLeft,
  Eye,
} from "iconoir-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import remarkGfm from "remark-gfm";

import { STORY_PIN_COLORS } from "~/lib/maps/story-pin-icons";
import { TimelineEraBadge } from "~/components/maps/shared/TimelineEraBadge";

// Extracted Subcomponents, Hooks, and Helpers
import { useStoryPinModalState } from "~/components/maps/core/hooks/useStoryPinModalState";
import { StoryPinLightbox } from "~/components/maps/core/components/StoryPinLightbox";
import { StorylineTimeline } from "~/components/maps/core/components/StorylineTimeline";
import { RelatedPinCard } from "~/components/maps/core/components/RelatedPinCard";
import { getCategoryIcon, IMPORTANCE_LABELS } from "~/components/maps/core/utils/story-pin-helpers";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetCard } from "~/components/ui/facet-container";
import { FACET_PROSE } from "~/components/maps/shared/facet-prose";
import { cn } from "~/lib/utils/cn";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface StoryPinModalProps {
  pinId: string;
  onClose: () => void;
  onFlyTo?: (lng: number, lat: number) => void;
  onNavigateToPin?: (pinId: string) => void;
}

export const StoryPinModal = memo(function StoryPinModal({
  pinId,
  onClose,
  onFlyTo,
  onNavigateToPin,
}: StoryPinModalProps) {
  const state = useStoryPinModalState({
    pinId,
    onClose,
    onFlyTo,
    onNavigateToPin,
  });

  if (state.isLoading) {
    return (
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent size="wide" className="overflow-y-auto p-8">
          <SheetTitle className="sr-only">Loading story</SheetTitle>
          <Skeleton className="rounded-control-sm h-6 w-48" />
          <div className="mt-2 space-y-3">
            <Skeleton className="rounded-row h-40 w-full" />
            <Skeleton className="h-4 w-3/4 rounded-xs" />
            <Skeleton className="h-4 w-1/2 rounded-xs" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!state.data?.pin) return null;

  const { pin, wikiEnrichment, relatedPins } = state.data;
  const category = pin.category;
  // Category colour is map data (it matches the pin drawn on the map).
  const color = STORY_PIN_COLORS[category];
  const CategoryIcon = getCategoryIcon(category);
  const photos = (pin.photos as string[] | null) ?? [];
  const heroImage =
    pin.thumbnailUrl ?? wikiEnrichment?.thumbnailUrl ?? (photos.length > 0 ? photos[0] : null);
  const storyline = pin.storyline;
  const hasStoryline = storyline && storyline.pins && storyline.pins.length > 1;
  const currentStorylineIdx = hasStoryline ? storyline.pins.findIndex((p) => p.id === pin.id) : -1;
  const wikiIsInternal =
    !!wikiEnrichment?.wikiUrl &&
    (wikiEnrichment.wikiUrl.startsWith("/") || wikiEnrichment.wikiUrl.includes("/wiki/"));

  return (
    <>
      {state.lightboxSrc && (
        <StoryPinLightbox
          src={state.lightboxSrc}
          alt="Story pin image"
          onClose={() => state.setLightboxSrc(null)}
        />
      )}

      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent size="wide" className="flex flex-col gap-0 overflow-hidden p-0">
          {/* ── Hero / Header ── */}
          <div className="shrink-0">
            {heroImage && (
              <div className="h-48 w-full overflow-hidden sm:h-56">
                <img src={heroImage} alt={pin.title} className="h-full w-full object-cover" />
              </div>
            )}

            <div className="px-5 pt-4 pr-12 pb-4">
              {/* Category + Importance badges */}
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  <CategoryIcon style={color ? { color } : undefined} aria-hidden />
                  {category}
                </Badge>
                {pin.importance >= 1 && (
                  <Badge variant="yellow">{IMPORTANCE_LABELS[pin.importance]}</Badge>
                )}
              </div>
              <SheetTitle className="text-title-2 sm:text-title-1">{pin.title}</SheetTitle>
              {/* Country + Timeline */}
              <div className="text-footnote mt-1 flex flex-wrap items-center gap-2">
                <span className="text-label-secondary">{pin.country.name}</span>
                {(pin.ixTimeYear != null || pin.eraLabel) && (
                  <TimelineEraBadge
                    eraLabel={pin.eraLabel ?? undefined}
                    ixTimeYear={pin.ixTimeYear ?? undefined}
                    category={category}
                  />
                )}
              </div>
              {/* Storyline breadcrumb */}
              {hasStoryline && (
                <p className="text-label-secondary text-footnote mt-1">
                  {storyline.title} · Event {currentStorylineIdx + 1} of {storyline.pins.length}
                </p>
              )}
            </div>
          </div>

          {/* ── Scrollable Body ── */}
          <div className="border-separator min-h-0 flex-1 overflow-y-auto border-t">
            <div className="flex flex-col gap-6 p-5 lg:flex-row">
              {/* Main content column */}
              <div className="min-w-0 flex-1 space-y-5">
                {pin.content && (
                  <div
                    className={cn(
                      FACET_PROSE,
                      "prose-sm prose-p:text-label prose-img:rounded-control"
                    )}
                  >
                    {pin.contentFormat === "markdown" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{pin.content}</ReactMarkdown>
                    ) : (
                      pin.content.split("\n\n").map((para, i) => <p key={i}>{para}</p>)
                    )}
                  </div>
                )}

                {/* Wiki integration section */}
                {wikiEnrichment?.intro && (
                  <FacetCard variant="inset" className="p-4">
                    <Eyebrow className="mb-2 flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5" aria-hidden />
                      From IxWiki
                    </Eyebrow>
                    <p className="text-label text-footnote leading-relaxed">
                      {wikiEnrichment.intro}
                    </p>
                    {wikiEnrichment.wikiUrl &&
                      (wikiIsInternal ? (
                        <Button asChild variant="link" size="xs" className="mt-1 px-0">
                          <Link href={wikiEnrichment.wikiUrl}>Read full article</Link>
                        </Button>
                      ) : (
                        <Button asChild variant="link" size="xs" className="mt-1 px-0">
                          <a
                            href={wikiEnrichment.wikiUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Read full article <ExternalLink aria-hidden />
                          </a>
                        </Button>
                      ))}
                  </FacetCard>
                )}

                {/* Image gallery */}
                {(photos.length > 0 ||
                  (wikiEnrichment?.images && wikiEnrichment.images.length > 0)) && (
                  <div>
                    <Eyebrow className="mb-2 flex items-center gap-1">
                      <Eye className="h-3 w-3" aria-hidden /> Gallery
                    </Eyebrow>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {/* User photos first */}
                      {photos.map((url, i) => (
                        <button
                          type="button"
                          key={`photo-${i}`}
                          onClick={() => state.setLightboxSrc(url)}
                          className="border-separator rounded-control shrink-0 overflow-hidden border transition-transform hover:scale-105"
                        >
                          <img
                            src={url}
                            alt={`${pin.title} image ${i + 1}`}
                            className="h-24 w-32 object-cover"
                          />
                        </button>
                      ))}
                      {/* Wiki images */}
                      {wikiEnrichment?.images?.slice(0, 8).map((img, i) => (
                        <button
                          type="button"
                          key={`wiki-${i}`}
                          onClick={() => state.setLightboxSrc(img.url)}
                          className="border-separator rounded-control shrink-0 overflow-hidden border transition-transform hover:scale-105"
                        >
                          <img
                            src={img.thumbUrl || img.url}
                            alt={img.title}
                            className="h-24 w-32 object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar (desktop: right column, mobile: below) */}
              <div className="w-full space-y-4 lg:w-60 lg:shrink-0">
                {hasStoryline && (
                  <StorylineTimeline
                    pins={storyline.pins}
                    currentPinId={pin.id}
                    storylineTitle={storyline.title}
                    storylineColor={storyline.color}
                    onNavigate={state.handleNavigatePin}
                  />
                )}

                {relatedPins && relatedPins.length > 0 && (
                  <div>
                    <Eyebrow className="mb-2 block">Related events</Eyebrow>
                    <div className="space-y-2">
                      {relatedPins.slice(0, 5).map((rp) => (
                        <RelatedPinCard key={rp.id} pin={rp} onNavigate={state.handleNavigatePin} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Footer Actions ── */}
          <div className="border-separator flex shrink-0 flex-wrap items-center gap-2 border-t px-5 py-3">
            {wikiEnrichment?.wikiUrl &&
              (wikiIsInternal ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={wikiEnrichment.wikiUrl}>
                    <BookOpen aria-hidden />
                    Read on IxWiki
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <a href={wikiEnrichment.wikiUrl} target="_blank" rel="noopener noreferrer">
                    <BookOpen aria-hidden />
                    Read on IxWiki
                  </a>
                </Button>
              ))}
            {pin.country.slug && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/countries/${pin.country.slug}`}>
                  View {pin.country.name}
                  <ExternalLink aria-hidden />
                </Link>
              </Button>
            )}
            <Button
              size="sm"
              onClick={state.handleFlyTo}
              className="bg-blue text-on-blue hover:bg-blue/90"
            >
              <MapPin aria-hidden />
              Fly to location
            </Button>
            {hasStoryline && currentStorylineIdx > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => state.handleNavigatePin(storyline.pins[currentStorylineIdx - 1].id)}
              >
                <ChevronLeft aria-hidden />
                Previous
              </Button>
            )}
            {hasStoryline && currentStorylineIdx < storyline.pins.length - 1 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => state.handleNavigatePin(storyline.pins[currentStorylineIdx + 1].id)}
              >
                Next
                <ChevronRight aria-hidden />
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
});

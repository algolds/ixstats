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

import { memo } from "react";
import {
  X,
  Calendar,
  BookOpen,
  ExternalLink,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Eye,
} from "lucide-react";
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
import { CATEGORY_ICONS, IMPORTANCE_LABELS } from "~/components/maps/core/utils/story-pin-helpers";

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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-card w-full max-w-3xl rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="bg-muted h-6 w-48 animate-pulse rounded" />
            <button
              onClick={onClose}
              className="text-muted-foreground hover:bg-muted rounded-full p-1.5"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-6 space-y-3">
            <div className="bg-muted h-40 w-full animate-pulse rounded-xl" />
            <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
            <div className="bg-muted h-4 w-1/2 animate-pulse rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!state.data?.pin) return null;

  const { pin, wikiEnrichment, relatedPins } = state.data;
  const category = pin.category;
  const color = STORY_PIN_COLORS[category] ?? "#6b7280";
  const photos = (pin.photos as string[] | null) ?? [];
  const heroImage =
    pin.thumbnailUrl ?? wikiEnrichment?.thumbnailUrl ?? (photos.length > 0 ? photos[0] : null);
  const storyline = pin.storyline;
  const hasStoryline = storyline && storyline.pins && storyline.pins.length > 1;
  const currentStorylineIdx = hasStoryline ? storyline.pins.findIndex((p) => p.id === pin.id) : -1;

  return (
    <>
      {state.lightboxSrc && (
        <StoryPinLightbox
          src={state.lightboxSrc}
          alt="Story pin image"
          onClose={() => state.setLightboxSrc(null)}
        />
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-card relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          style={{ animation: "modalFadeIn 0.2s ease-out" }}
        >
          {/* ── Hero / Header ── */}
          <div className="relative shrink-0">
            {heroImage ? (
              <div className="relative h-48 w-full overflow-hidden sm:h-56">
                <img src={heroImage} alt={pin.title} className="h-full w-full object-cover" />
                <div className="from-card via-card/40 absolute inset-0 bg-gradient-to-t to-transparent" />
              </div>
            ) : (
              <div
                className="h-24 w-full"
                style={{ background: `linear-gradient(135deg, ${color}20, ${color}08)` }}
              />
            )}

            {/* Header content overlaying hero */}
            <div
              className={`${heroImage ? "absolute right-0 bottom-0 left-0" : ""} px-5 pt-3 pb-4`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {/* Category + Importance badges */}
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      {CATEGORY_ICONS[category]} {category}
                    </span>
                    {pin.importance >= 1 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        {IMPORTANCE_LABELS[pin.importance]}
                      </span>
                    )}
                  </div>
                  {/* Title */}
                  <h2
                    className={`text-xl leading-tight font-bold ${heroImage ? "text-white drop-shadow-lg" : "text-foreground"} sm:text-2xl`}
                  >
                    {pin.title}
                  </h2>
                  {/* Country + Timeline */}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className={heroImage ? "text-white/80" : "text-muted-foreground"}>
                      {pin.country.name}
                    </span>
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
                    <p
                      className="text-muted-foreground mt-1 text-[10px]"
                      style={{ color: storyline.color ?? color }}
                    >
                      {storyline.title} · Event {currentStorylineIdx + 1} of {storyline.pins.length}
                    </p>
                  )}
                </div>
                {/* Close button */}
                <button
                  onClick={onClose}
                  className={`shrink-0 rounded-full p-1.5 transition-colors ${
                    heroImage
                      ? "bg-black/30 text-white hover:bg-black/50"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Scrollable Body ── */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-6 p-5 lg:flex-row">
              {/* Main content column */}
              <div className="min-w-0 flex-1 space-y-5">
                {/* Content */}
                {pin.content && (
                  <div className="prose prose-sm dark:prose-invert prose-headings:text-foreground prose-p:text-foreground/85 prose-a:text-blue-600 prose-img:rounded-lg max-w-none">
                    {pin.contentFormat === "markdown" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{pin.content}</ReactMarkdown>
                    ) : (
                      pin.content.split("\n\n").map((para, i) => <p key={i}>{para}</p>)
                    )}
                  </div>
                )}

                {/* Wiki integration section */}
                {wikiEnrichment?.intro && (
                  <div className="rounded-xl border border-amber-200/50 bg-amber-50/50 p-4 dark:border-amber-800/30 dark:bg-amber-900/10">
                    <div className="mb-2 flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-[10px] font-semibold tracking-wider text-amber-600 uppercase">
                        From IxWiki
                      </span>
                    </div>
                    <p className="text-foreground/80 text-xs leading-relaxed">
                      {wikiEnrichment.intro}
                    </p>
                    {wikiEnrichment.wikiUrl &&
                      (wikiEnrichment.wikiUrl.startsWith("/") ||
                      wikiEnrichment.wikiUrl.includes("/wiki/") ? (
                        <Link
                          href={wikiEnrichment.wikiUrl}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 hover:underline"
                        >
                          Read full article
                        </Link>
                      ) : (
                        <a
                          href={wikiEnrichment.wikiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 hover:underline"
                        >
                          Read full article <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                  </div>
                )}

                {/* Image gallery */}
                {(photos.length > 0 ||
                  (wikiEnrichment?.images && wikiEnrichment.images.length > 0)) && (
                  <div>
                    <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                      <Eye className="mr-1 inline h-3 w-3" /> Gallery
                    </h4>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {/* User photos first */}
                      {photos.map((url, i) => (
                        <button
                          key={`photo-${i}`}
                          onClick={() => state.setLightboxSrc(url)}
                          className="border-border/30 shrink-0 overflow-hidden rounded-lg border transition-transform hover:scale-105"
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
                          key={`wiki-${i}`}
                          onClick={() => state.setLightboxSrc(img.url)}
                          className="border-border/30 shrink-0 overflow-hidden rounded-lg border transition-transform hover:scale-105"
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
                {/* Storyline timeline */}
                {hasStoryline && (
                  <StorylineTimeline
                    pins={storyline.pins}
                    currentPinId={pin.id}
                    storylineTitle={storyline.title}
                    storylineColor={storyline.color}
                    onNavigate={state.handleNavigatePin}
                  />
                )}

                {/* Related pins */}
                {relatedPins && relatedPins.length > 0 && (
                  <div>
                    <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                      Related Events
                    </h4>
                    <div className="space-y-1.5">
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
          <div className="border-border/30 shrink-0 border-t px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {wikiEnrichment?.wikiUrl &&
                (wikiEnrichment.wikiUrl.startsWith("/") ||
                wikiEnrichment.wikiUrl.includes("/wiki/") ? (
                  <Link
                    href={wikiEnrichment.wikiUrl}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300"
                  >
                    <BookOpen className="h-3 w-3" />
                    Read on IxWiki
                  </Link>
                ) : (
                  <a
                    href={wikiEnrichment.wikiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300"
                  >
                    <BookOpen className="h-3 w-3" />
                    Read on IxWiki
                  </a>
                ))}
              {pin.country.slug && (
                <Link
                  href={`/countries/${pin.country.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300"
                >
                  View {pin.country.name}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
              <button
                onClick={state.handleFlyTo}
                className="bg-muted text-foreground hover:bg-muted/80 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              >
                <MapPin className="h-3 w-3" />
                Fly to location
              </button>
              {/* Storyline prev/next */}
              {hasStoryline && currentStorylineIdx > 0 && (
                <button
                  onClick={() =>
                    state.handleNavigatePin(storyline.pins[currentStorylineIdx - 1].id)
                  }
                  className="bg-muted text-foreground hover:bg-muted/80 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  <ChevronLeft className="h-3 w-3" />
                  Previous
                </button>
              )}
              {hasStoryline && currentStorylineIdx < storyline.pins.length - 1 && (
                <button
                  onClick={() =>
                    state.handleNavigatePin(storyline.pins[currentStorylineIdx + 1].id)
                  }
                  className="bg-muted text-foreground hover:bg-muted/80 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  Next
                  <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes modalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </>
  );
});

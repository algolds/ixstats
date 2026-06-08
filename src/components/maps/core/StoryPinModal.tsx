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

import { useEffect, useCallback, useState, memo } from "react";
import {
  X,
  Calendar,
  BookOpen,
  ExternalLink,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  Eye,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import remarkGfm from "remark-gfm";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });
import { api } from "~/trpc/react";
import { STORY_PIN_COLORS } from "~/lib/story-pin-icons";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StoryPinModalProps {
  pinId: string;
  onClose: () => void;
  onFlyTo?: (lng: number, lat: number) => void;
  onNavigateToPin?: (pinId: string) => void;
}

// ─── Category icons (emoji fallback for modal header) ────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  battle: "\u2694\uFE0F",
  founding: "\uD83C\uDFF0",
  treaty: "\uD83D\uDCDC",
  cultural: "\uD83C\uDFAD",
  religious: "\u2721\uFE0F",
  trade: "\uD83E\uDE99",
  naval: "\u2693",
  settlement: "\uD83C\uDFD8\uFE0F",
  government: "\uD83C\uDFDB\uFE0F",
  biography: "\uD83D\uDC64",
  linguistic: "\uD83D\uDCAC",
  upheaval: "\u26A1",
  natural: "\uD83C\uDF3F",
  exploration: "\uD83E\uDDED",
};

const IMPORTANCE_LABELS = ["", "Major Event", "Legendary"];

// ─── Lightbox ────────────────────────────────────────────────────────────────

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ─── Storyline Timeline ──────────────────────────────────────────────────────

function StorylineTimeline({
  pins,
  currentPinId,
  storylineTitle,
  storylineColor,
  onNavigate,
}: {
  pins: Array<{
    id: string;
    title: string;
    ixTimeYear: number | null;
    eraLabel: string | null;
    category: string;
  }>;
  currentPinId: string;
  storylineTitle: string;
  storylineColor: string | null;
  onNavigate?: (pinId: string) => void;
}) {
  const color = storylineColor ?? "#6366f1";
  const currentIdx = pins.findIndex((p) => p.id === currentPinId);

  return (
    <div className="border-border/50 bg-card/50 rounded-xl border p-4">
      <h4 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
        {storylineTitle}
      </h4>
      <div className="relative space-y-0">
        {pins.map((pin, i) => {
          const isCurrent = pin.id === currentPinId;
          return (
            <div key={pin.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
              {/* Vertical line */}
              {i < pins.length - 1 && (
                <div
                  className="absolute top-4 left-[7px] h-full w-0.5"
                  style={{ backgroundColor: isCurrent || i < currentIdx ? color : `${color}33` }}
                />
              )}
              {/* Dot */}
              <div
                className={`relative z-10 mt-0.5 shrink-0 rounded-full border-2 ${isCurrent ? "h-4 w-4" : "h-3 w-3"}`}
                style={{
                  borderColor: color,
                  backgroundColor: isCurrent || i <= currentIdx ? color : "transparent",
                }}
              />
              {/* Content */}
              <button
                onClick={() => !isCurrent && onNavigate?.(pin.id)}
                disabled={isCurrent}
                className={`min-w-0 text-left transition-colors ${
                  isCurrent ? "cursor-default" : "hover:text-foreground cursor-pointer"
                }`}
              >
                <p
                  className={`truncate text-xs leading-tight ${isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"}`}
                >
                  {pin.title}
                </p>
                {pin.ixTimeYear != null && (
                  <p className="text-muted-foreground/70 text-[10px]">
                    Year {pin.ixTimeYear}
                    {pin.eraLabel ? ` \u00B7 ${pin.eraLabel}` : ""}
                  </p>
                )}
              </button>
            </div>
          );
        })}
      </div>
      {pins.length > 1 && (
        <p className="text-muted-foreground/60 mt-2 text-[10px]">
          Event {currentIdx + 1} of {pins.length}
        </p>
      )}
    </div>
  );
}

// ─── Related Pin Card ────────────────────────────────────────────────────────

function RelatedPinCard({
  pin,
  onNavigate,
}: {
  pin: {
    id: string;
    title: string;
    category: string;
    ixTimeYear: number | null;
    thumbnailUrl: string | null;
  };
  onNavigate?: (pinId: string) => void;
}) {
  const color = STORY_PIN_COLORS[pin.category] ?? "#6b7280";
  return (
    <button
      onClick={() => onNavigate?.(pin.id)}
      className="border-border/30 bg-card/30 hover:bg-card/60 flex items-center gap-2.5 rounded-lg border p-2 text-left transition-colors"
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {CATEGORY_ICONS[pin.category] ?? "\uD83D\uDCCC"}
      </div>
      <div className="min-w-0">
        <p className="text-foreground truncate text-xs font-medium">{pin.title}</p>
        {pin.ixTimeYear != null && (
          <p className="text-muted-foreground text-[10px]">Year {pin.ixTimeYear}</p>
        )}
      </div>
    </button>
  );
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

export const StoryPinModal = memo(function StoryPinModal({
  pinId,
  onClose,
  onFlyTo,
  onNavigateToPin,
}: StoryPinModalProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Fetch full pin data with wiki enrichment
  const { data, isLoading } = api.geoFeatures.getStoryPinFull.useQuery(
    { pinId },
    { staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
  );

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleFlyTo = useCallback(() => {
    if (!data?.pin?.coordinates) return;
    const coords = data.pin.coordinates as [number, number];
    onFlyTo?.(coords[0], coords[1]);
    onClose();
  }, [data, onFlyTo, onClose]);

  const handleNavigatePin = useCallback(
    (targetPinId: string) => {
      onNavigateToPin?.(targetPinId);
    },
    [onNavigateToPin]
  );

  if (isLoading) {
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

  if (!data?.pin) return null;

  const { pin, wikiEnrichment, relatedPins } = data;
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
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="Story pin image"
          onClose={() => setLightboxSrc(null)}
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
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                        style={{ backgroundColor: `${color}15`, color }}
                      >
                        <Calendar className="h-3 w-3" />
                        {pin.ixTimeYear != null && `Year ${pin.ixTimeYear}`}
                        {pin.ixTimeYear != null && pin.eraLabel && " \u00B7 "}
                        {pin.eraLabel}
                      </span>
                    )}
                  </div>
                  {/* Storyline breadcrumb */}
                  {hasStoryline && (
                    <p
                      className="text-muted-foreground mt-1 text-[10px]"
                      style={{ color: storyline.color ?? color }}
                    >
                      {storyline.title} \u00B7 Event {currentStorylineIdx + 1} of{" "}
                      {storyline.pins.length}
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
                      wikiEnrichment.wikiUrl.includes("/w/") ? (
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
                          onClick={() => setLightboxSrc(url)}
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
                          onClick={() => setLightboxSrc(img.url)}
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
                    onNavigate={handleNavigatePin}
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
                        <RelatedPinCard key={rp.id} pin={rp} onNavigate={handleNavigatePin} />
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
                wikiEnrichment.wikiUrl.includes("/w/") ? (
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
                onClick={handleFlyTo}
                className="bg-muted text-foreground hover:bg-muted/80 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              >
                <MapPin className="h-3 w-3" />
                Fly to location
              </button>
              {/* Storyline prev/next */}
              {hasStoryline && currentStorylineIdx > 0 && (
                <button
                  onClick={() => handleNavigatePin(storyline.pins[currentStorylineIdx - 1].id)}
                  className="bg-muted text-foreground hover:bg-muted/80 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  <ChevronLeft className="h-3 w-3" />
                  Previous
                </button>
              )}
              {hasStoryline && currentStorylineIdx < storyline.pins.length - 1 && (
                <button
                  onClick={() => handleNavigatePin(storyline.pins[currentStorylineIdx + 1].id)}
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
